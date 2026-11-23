// Jalankan satu kueri SELECT dan cetak hasilnya sebagai tabel (alat bantu dev).
//   node scripts/kueri.mjs "select ..."
import pg from "pg";
process.loadEnvFile(".env.local");
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const r = await c.query(process.argv[2]);
  const hasil = Array.isArray(r) ? r.at(-1) : r;
  console.table(hasil.rows);
} finally {
  await c.end();
}
