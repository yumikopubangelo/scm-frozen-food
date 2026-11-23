@AGENTS.md

# CLAUDE.md — konteks proyek untuk agent

Baca berkas ini dulu sebelum mengubah kode. Catatan proses lengkap (keputusan, error, perbaikan) ada di `PROSES.md`.

## Ringkasan proyek

Aplikasi web **Supply Chain Management (SCM)** untuk UMKM frozen food fiktif **"Galunggung Frozen Food"** di Tasikmalaya. Dibuat untuk tugas UAS (Sistem Informasi), tenggat **Kamis 26 Nov 2026, 18.00 WIB**.

Alur rantai pasok yang dimodelkan:

```
supplier → gudang bahan baku → produksi → gudang barang jadi → reseller/toko
```

Fitur MVP: login admin (1 role), master data (supplier, bahan baku, produk, reseller), BOM, Purchase Order (draft → dikirim → diterima), batch produksi, pesanan reseller & pengiriman (diproses → dikirim → diterima), dashboard, dan **agen restock** (berbasis aturan, membuat DRAFT PO yang tetap menunggu persetujuan admin).

Opsional (M8b): ramalan permintaan dari model S4 milik pemilik proyek, dijalankan **offline**, hasilnya diimpor ke tabel `forecast_permintaan`. Aplikasi WAJIB tetap jalan tanpa S4 (bawaan: rata-rata bergerak).

## Stack

| Lapisan | Pilihan |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript + React 19 |
| Styling | Tailwind CSS v4 (tema terang saja) |
| Database & Auth | Supabase (Postgres + Supabase Auth), klien `@supabase/ssr` |
| Hosting | Vercel (aplikasi) + Supabase cloud (DB); kode di GitHub |

**Produksi: https://scm-frozen-food.vercel.app** — Vercel auto-deploy setiap push ke `main`. Env Vercel hanya `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (JANGAN pasang `DATABASE_URL`). Lokal & produksi memakai database Supabase yang SAMA: uji yang mengubah data = mengubah data produksi.

**Penting — Next.js 16 berbeda dari versi lama:** baca dokumentasi di `node_modules/next/dist/docs/` sebelum menulis kode (lihat `AGENTS.md`). Contoh: `middleware.ts` diganti `proxy.ts`. `cacheComponents` sengaja dimatikan di `next.config.ts` (alasan di PROSES.md M0).

## Struktur folder

```
src/
  proxy.ts             # (Next 16 = pengganti middleware) refresh sesi + redirect ke /login
  app/
    login/             # halaman login + Server Action login/logout (di luar group, tanpa sidebar)
    (app)/             # route group: SEMUA halaman yang wajib login; layout.tsx = cek login + sidebar
      page.tsx         # dashboard: kartu, grafik 30 hari (rpc mutasi_harian), stok kritis, PO & pesanan berjalan
      agen-restock/    # data.ts (AMATI: muatRencana), page.tsx (pratinjau usulan per supplier + riwayat), actions.ts (hitung ulang + sidik -> rpc simpan_hasil_agen)
      mutasi-stok/     # buku besar mutasi + filter barang/jenis/tanggal + grafik riwayat stok 1 barang
      supplier/        # pola CRUD (sama untuk reseller, bahan-baku, produk):
        page.tsx       #   daftar + cari ?q= + banner ?ok=
        baru/page.tsx  #   form tambah (kode otomatis)
        [id]/page.tsx  #   form ubah + hapus + info terkait
        form-supplier.tsx  # client form (useActionState), dipakai baru & ubah
        actions.ts     #   Server Action simpan (id null = tambah) & hapus
      produk/editor-bom.tsx  # editor resep (BOM) per produk
      produksi/        # daftar (ringkasan 30 hari + paginasi), baru (pratinjau kebutuhan bahan), [id] (bahan keluar, perkiraan biaya)
      pesanan/         # daftar (tab status, siap kirim/stok kurang), baru (baris dinamis), [id] (kirim/terima/batal, edit saat diproses, WA reseller)
      purchase-order/  # daftar (tab status + paginasi), baru (baris dinamis -> JSON), [id] (linimasa, aksi status, edit item saat draft, WA)
  components/
    navigasi.ts        # daftar menu sidebar (satu-satunya sumber)
    app-shell.tsx      # sidebar desktop + laci menu mobile
    judul-halaman.tsx  # JudulHalaman, SegeraHadir
    form.tsx           # Field, Pilihan, TombolSimpan, PesanForm (pakai StatusForm)
    ui.tsx             # Tabel, Badge, BadgeStok, Pencarian, BannerOk, TombolTambah, Kembali
    tombol-hapus.tsx   # hapus + konfirmasi + tampilkan pesan error FK
    stok-opname.tsx    # form stok opname (rpc sesuaikan_stok)
    catatan.tsx        # CatatanDokumen: form catatan PO/pesanan
    tombol-aksi.tsx    # tombol + konfirmasi untuk Server Action status (kirim/terima/batal)
    paginasi.tsx       # Paginasi (.range + count) & TabStatus
    grafik.tsx         # GrafikBatang & GrafikStok: SVG murni di Server Component (tanpa pustaka grafik)
  lib/
    auth.ts            # wajibLogin(): verifikasi sesi di server (getClaims)
    supabase/          # server.ts (klien per request), proxy.ts (updateSession)
    validasi.ts        # skema zod: teksWajib, angkaWajib (koma desimal), bacaForm -> StatusForm
    galat-db.ts        # kode error Postgres -> kalimat Indonesia; kembaliKeHalaman1() untuk ?hal= kelewat
    agen-restock.ts    # OTAK agen: hitungRencana() (murni, diuji), kelipatanSatuan, sidikRencana
    grafik.ts          # skalaRapi() sumbu Y, angkaRingkas() (rb/jt)
    format.ts          # rupiah(), angka(), tanggal(), hariIni() WIB, tambahHari(), nomorWa(), kodeBerikutnya()
    cari.ts            # filterCari() aman untuk PostgREST .or()
    hitung-produk.ts   # biaya bahan/pak, kapasitas, kebutuhanProduksi; bagiBulatBawah (tahan galat float)
    aksi-stok.ts       # Server Action stok opname
    tipe.ts            # tipe baris tabel
    status.ts          # label/warna/arti status PO & pesanan
    *.test.ts          # unit test Vitest (npm test)
supabase/
  migrations/          # SQL skema + fungsi stok, diberi nomor urut (0001_..., 0002_...)
  seed.sql             # data contoh (frozen food Tasikmalaya)
scripts/               # skrip lokal: jalankan migrasi, tes skenario SQL, kueri.mjs (SELECT cepat ke DB)
docs/                  # penjelasan logika (alur stok, rumus agen) + screenshots/ untuk laporan
PROSES.md              # jurnal pembangunan per milestone (bahan laporan UAS)
```

## Konvensi kode

- **Bahasa:** nama domain (tabel, kolom, variabel bisnis) dalam **bahasa Indonesia** (`bahan_baku`, `pesanan`, `stok`); istilah framework tetap Inggris (`page.tsx`, `layout`, `action`). Semua teks UI bahasa Indonesia.
- **Database:** `snake_case`; tabel bentuk tunggal (`supplier`, `produk`); PK `id bigint identity`; setiap tabel punya `created_at`.
- **Stok HANYA berubah lewat fungsi Postgres** (`terima_po`, `catat_produksi`, `kirim_pesanan`, …) yang berjalan dalam satu transaksi dan menulis `mutasi_stok`. Ini dipaksa di level database: role `authenticated` tidak punya hak UPDATE kolom `stok`/`status`. Panggil dari aplikasi dengan `supabase.rpc("terima_po", { p_po_id })`. Detail: `docs/alur-stok.md`.
- **Mengubah skema:** buat migrasi baru `supabase/migrations/000N_....sql` (jangan edit migrasi yang sudah terpasang), lalu `npm run db:migrate`. Kalau menambah tabel/fungsi, ingat beri GRANT + RLS seperti di `0003_hak_akses.sql` (hak bawaan sengaja dicabut).
- **Mutasi data** lewat Server Actions (`"use server"`) lalu `revalidatePath`. Pembacaan data di Server Component.
- **Halaman baru:** taruh di `src/app/(app)/<nama>/page.tsx` (otomatis wajib login), tambahkan ke `components/navigasi.ts`, pakai `JudulHalaman` + kelas `.card` `.input` `.btn-primary` dari `globals.css`. Screenshot untuk laporan JANGAN menampilkan email admin (footer sidebar) — crop.
- **Keamanan:** RLS menyala di semua tabel; hanya pengguna `authenticated` yang boleh baca/tulis. Jangan pernah commit secret — pakai `.env.local` (lokal) dan Environment Variables Vercel (produksi). `DATABASE_URL` hanya untuk skrip lokal.
- **Format angka/tanggal:** `Intl` dengan locale `id-ID` (Rp, tanggal Indonesia). Input angka menerima koma desimal; `Field` menampilkan angka dengan koma.
- **Perubahan status dokumen** selalu `supabase.rpc(...)` lalu `redirect(...?ok=<aksi>)` supaya banner sesuai. Form dengan baris dinamis (state React) pakai `onSubmit` + `startTransition`, BUKAN `action=`, agar React 19 tidak mereset form.
- **Halaman daftar berpaginasi** panggil `kembaliKeHalaman1(error, basePath, params)` sebelum melempar error, supaya `?hal=` yang kelewat (PGRST103) diarahkan ke halaman 1.
- **Grid berisi tabel/grafik** (`grid lg:grid-cols-2`) beri `[&>*]:min-w-0`, kalau tidak item grid melebar mengikuti isi tabel dan halaman bisa digeser ke samping di ponsel.
- **Agen restock** hanya boleh membuat PO `draft` (sumber `agen`); jangan pernah menambah jalur yang mengirim PO ke supplier tanpa klik admin. Ubah rumus di `lib/agen-restock.ts` + test-nya; penjelasan di `docs/agen-restock.md`.
- **Grafik**: pakai `components/grafik.tsx` (SVG). Data harian yang bisa >1.000 baris diagregasi di Postgres (fungsi), bukan di aplikasi.
- **Halaman detail** wajib `cekGalatMuat(error...)` sebelum `notFound()` — gangguan Supabase harus tampil sebagai error, bukan 404.
- **Pembagian stok** (kapasitas, ⌊a/b⌋) pakai `bagiBulatBawah()`, jangan `Math.floor(a/b)` (0,3/0,1 = 2,999…).
- **Screenshot laporan**: kalau sidebar terlihat, crop di atas footer (email admin) atau tutup area itu sebelum di-commit.
- **Uji di browser**: pakai tab sendiri, tapi tampilkan (front) tab itu saat menguji form — tab latar bisa menunda hidrasi React.
- **Form:** validasi di server dengan zod (`lib/validasi.ts`), kembalikan `StatusForm` (galat per kolom + isian terakhir). Error Supabase selalu lewat `pesanGalat()`. Data yang punya riwayat transaksi tidak bisa dihapus (FK RESTRICT) — itu disengaja.
- **Setiap milestone:** tes (build + lint + skenario), perbarui `PROSES.md`, lalu commit `M<n>: <ringkasan>`.

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local   # isi URL & key Supabase
npm run dev                  # http://localhost:3000
npm run build && npm run lint
npm test                     # unit test Vitest (src/**/*.test.ts)
npx next typegen             # kalau PageProps<"/rute/baru"> error: buat ulang tipe rute

# CSS/halaman di dev server tidak ikut berubah? Hentikan dev server, hapus .next/dev, jalankan ulang.

# database (butuh DATABASE_URL = Session pooler di .env.local)
npm run db:migrate           # pasang migrasi yang belum terpasang
npm run db:seed              # data contoh + simulasi 12 bulan (~1,5 menit)
npm run db:test              # 23 tes skenario stok (di-rollback)
node scripts/kueri.mjs "select ..."   # lihat hasil kueri sebagai tabel
npm run db:reset -- --ya     # HAPUS semua objek aplikasi (dev saja)
```

Akun admin dibuat manual di Supabase Dashboard → Authentication → Users → Add user.

## Git

- Branch kerja: **`main`** (remote `origin` = GitHub `scm-frozen-food`). Branch `M4` = salinan titik M4, jangan dipakai lanjut.
- Jangan rewrite history yang sudah di-push (tidak ada `--force`). Push hanya bila pemilik meminta.

## Status milestone

| # | Milestone | Status |
|---|---|---|
| M0 | Setup proyek | selesai |
| M1 | Skema DB + fungsi stok + seed | selesai |
| M2 | Login + layout | selesai |
| M3 | Master data + BOM | selesai |
| M4 | Purchase Order | selesai |
| M5 | Produksi | selesai |
| M6 | Pesanan & pengiriman | selesai |
| M7 | Dashboard | selesai |
| M8 | Agen restock (+ M8b S4 opsional) | selesai (M8b belum) |
| M9 | Deploy GitHub + Vercel | selesai |
| M10 | Ringkasan akhir | belum |
