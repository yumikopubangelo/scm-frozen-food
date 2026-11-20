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

**Penting — Next.js 16 berbeda dari versi lama:** baca dokumentasi di `node_modules/next/dist/docs/` sebelum menulis kode (lihat `AGENTS.md`). Contoh: `middleware.ts` diganti `proxy.ts`. `cacheComponents` sengaja dimatikan di `next.config.ts` (alasan di PROSES.md M0).

## Struktur folder

```
src/
  proxy.ts             # (Next 16 = pengganti middleware) refresh sesi + redirect ke /login
  app/
    login/             # halaman login + Server Action login/logout (di luar group, tanpa sidebar)
    (app)/             # route group: SEMUA halaman yang wajib login; layout.tsx = cek login + sidebar
      page.tsx         # dashboard
      supplier/        # pola CRUD (sama untuk reseller, bahan-baku, produk):
        page.tsx       #   daftar + cari ?q= + banner ?ok=
        baru/page.tsx  #   form tambah (kode otomatis)
        [id]/page.tsx  #   form ubah + hapus + info terkait
        form-supplier.tsx  # client form (useActionState), dipakai baru & ubah
        actions.ts     #   Server Action simpan (id null = tambah) & hapus
      produk/editor-bom.tsx  # editor resep (BOM) per produk
  components/
    navigasi.ts        # daftar menu sidebar (satu-satunya sumber)
    app-shell.tsx      # sidebar desktop + laci menu mobile
    judul-halaman.tsx  # JudulHalaman, SegeraHadir
    form.tsx           # Field, Pilihan, TombolSimpan, PesanForm (pakai StatusForm)
    ui.tsx             # Tabel, Badge, BadgeStok, Pencarian, BannerOk, TombolTambah, Kembali
    tombol-hapus.tsx   # hapus + konfirmasi + tampilkan pesan error FK
    stok-opname.tsx    # form stok opname (rpc sesuaikan_stok)
  lib/
    auth.ts            # wajibLogin(): verifikasi sesi di server (getClaims)
    supabase/          # server.ts (klien per request), proxy.ts (updateSession)
    validasi.ts        # skema zod: teksWajib, angkaWajib (koma desimal), bacaForm -> StatusForm
    galat-db.ts        # kode error Postgres -> kalimat Indonesia
    format.ts          # rupiah(), angka(), tanggal(), kodeBerikutnya()
    cari.ts            # filterCari() aman untuk PostgREST .or()
    hitung-produk.ts   # biaya bahan per pak, kapasitas produksi dari BOM
    aksi-stok.ts       # Server Action stok opname
    tipe.ts            # tipe baris tabel
    *.test.ts          # unit test Vitest (npm test)
supabase/
  migrations/          # SQL skema + fungsi stok, diberi nomor urut (0001_..., 0002_...)
  seed.sql             # data contoh (frozen food Tasikmalaya)
scripts/               # skrip lokal: jalankan migrasi, tes skenario SQL
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
npm run db:test              # 19 tes skenario stok (di-rollback)
npm run db:reset -- --ya     # HAPUS semua objek aplikasi (dev saja)
```

Akun admin dibuat manual di Supabase Dashboard → Authentication → Users → Add user.

## Status milestone

| # | Milestone | Status |
|---|---|---|
| M0 | Setup proyek | selesai |
| M1 | Skema DB + fungsi stok + seed | selesai |
| M2 | Login + layout | selesai |
| M3 | Master data + BOM | selesai |
| M4 | Purchase Order | belum |
| M5 | Produksi | belum |
| M6 | Pesanan & pengiriman | belum |
| M7 | Dashboard | belum |
| M8 | Agen restock (+ M8b S4 opsional) | belum |
| M9 | Deploy GitHub + Vercel | belum |
| M10 | Ringkasan akhir | belum |
