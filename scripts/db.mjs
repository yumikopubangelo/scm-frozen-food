// scripts/db.mjs — menjalankan SQL ke database Supabase dari komputer lokal.
//
//   npm run db:migrate         jalankan migrasi di supabase/migrations yang belum pernah jalan
//   npm run db:seed            isi data contoh (supabase/seed.sql)
//   npm run db:test            uji skenario stok (scripts/tes-skenario.sql, di-ROLLBACK)
//   npm run db:reset -- --ya   HAPUS semua objek aplikasi (khusus pengembangan)
//   npm run db:sql -- <file>   jalankan satu file SQL apa saja
//
// Koneksi memakai DATABASE_URL dari .env.local (Session pooler Supabase).
// Variabel ini hanya untuk skrip lokal; aplikasi web TIDAK memakainya.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("File .env.local tidak ditemukan. Salin dari .env.example lalu isi nilainya.");
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? "";
if (!url || url.includes("YOUR-PASSWORD")) {
  console.error("DATABASE_URL belum diisi atau masih berisi [YOUR-PASSWORD].");
  process.exit(1);
}
if (/@db\.[a-z0-9]+\.supabase\.co/.test(url)) {
  console.error(
    "DATABASE_URL masih memakai Direct connection (db.xxx.supabase.co) yang hanya IPv6.\n" +
      "Pakai Session pooler (host aws-...pooler.supabase.com) dari tombol Connect di dashboard.",
  );
  process.exit(1);
}

// SSL dipakai (enkripsi), tapi sertifikat server tidak diverifikasi karena
// ditandatangani CA milik Supabase, bukan CA publik. Setara sslmode=require.
// Cukup untuk skrip pengembangan; verifikasi penuh butuh unduh root cert Supabase.
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
client.on("notice", (n) => console.log("  " + n.message));

async function jalankanFile(path) {
  const sql = readFileSync(path, "utf8");
  console.log(`> ${path}`);
  await client.query(sql);
}

async function migrate() {
  // Catatan migrasi disimpan di schema "internal" yang tidak dibuka ke Data API.
  await client.query(`
    create schema if not exists internal;
    revoke all on schema internal from public;
    create table if not exists internal.skema_migrasi (
      nama text primary key,
      dijalankan_pada timestamptz not null default now()
    );`);
  const sudah = new Set(
    (await client.query("select nama from internal.skema_migrasi")).rows.map((r) => r.nama),
  );
  const dir = "supabase/migrations";
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let jumlah = 0;
  for (const f of files) {
    if (sudah.has(f)) continue;
    await client.query("begin");
    try {
      await jalankanFile(join(dir, f));
      await client.query("insert into internal.skema_migrasi (nama) values ($1)", [f]);
      await client.query("commit");
      jumlah++;
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  console.log(jumlah ? `${jumlah} migrasi dijalankan.` : "Semua migrasi sudah terpasang.");
}

const [perintah, ...args] = process.argv.slice(2);
const mulai = Date.now();
try {
  await client.connect();
  switch (perintah) {
    case "migrate":
      await migrate();
      break;
    case "seed":
      await client.query("begin");
      await jalankanFile("supabase/seed.sql");
      await client.query("commit");
      break;
    case "test":
      await jalankanFile("scripts/tes-skenario.sql");
      console.log("Semua tes skenario LULUS (perubahan di-rollback).");
      break;
    case "reset":
      if (!args.includes("--ya")) {
        console.error("Ini menghapus SEMUA tabel & data aplikasi. Ulangi dengan: npm run db:reset -- --ya");
        process.exitCode = 1;
        break;
      }
      await jalankanFile("supabase/reset.sql");
      break;
    case "sql":
      if (!args[0]) throw new Error("Sebutkan file SQL: npm run db:sql -- path/ke/file.sql");
      await jalankanFile(args[0]);
      break;
    default:
      console.error("Perintah: migrate | seed | test | reset | sql <file>");
      process.exitCode = 1;
  }
} catch (e) {
  console.error("\nGAGAL:", e.message);
  if (e.where) console.error("Lokasi:", e.where);
  if (e.position) console.error("Posisi karakter:", e.position);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
  console.log(`(${((Date.now() - mulai) / 1000).toFixed(1)} detik)`);
}
