# PROSES.md — Jurnal Pembangunan SCM Galunggung Frozen Food

Catatan ini ditulis oleh agent (Claude Code) selama pembangunan aplikasi, sebagai bahan laporan UAS.
Setiap milestone memuat: **apa yang dikerjakan & keputusan teknis**, **masalah & perbaikannya**, dan **bagian yang butuh campur tangan pemilik proyek**.

- Agent: Claude Code (model Claude Opus 5.5), dijalankan di aplikasi desktop Claude (tab Code), Windows 11.
- Mulai: Jumat, 20 Nov 2026. Tenggat: Kamis, 26 Nov 2026, 18.00 WIB.
- Repo lokal: `D:\LAB\scm-frozen-food`

---

## Tahap 0 — Perencanaan (20 Nov 2026)

Agent tidak langsung menulis kode. Ia lebih dulu menyusun rencana (skema database, daftar halaman, urutan milestone) dan menunggu persetujuan.

**Keputusan yang diambil bersama:**

| Topik | Keputusan | Alasan |
|---|---|---|
| Stack | Next.js + Supabase + Vercel (sesuai usulan pemilik) | Alternatif "lebih sederhana" ditolak. Web statis + `localStorage` membuat data hanya ada di satu browser, jadi dosen akan melihat aplikasi kosong. SQLite di Vercel hilang karena Vercel tidak punya disk permanen. Supabase justru jalan terpendek: DB + login + hosting DB satu paket. |
| ORM | Tanpa ORM, cukup `@supabase/ssr` + SQL | Satu lapisan lebih sedikit untuk dipelajari & di-debug |
| Logika stok | Fungsi Postgres (`terima_po`, `catat_produksi`, `kirim_pesanan`) | Berjalan dalam satu transaksi, jadi stok tidak bisa ter-update setengah jalan |
| Gudang | Tidak ada tabel `gudang`. Gudang bahan = `bahan_baku.stok`, gudang barang jadi = `produk.stok`, riwayat di `mutasi_stok` | Cukup untuk 1 lokasi UMKM (prinsip YAGNI) |
| Agen restock | Berbasis aturan (ROP + kebutuhan pesanan), tanpa LLM | Tanpa API key, tanpa biaya, dan hasilnya bisa diperiksa ulang |
| Data contoh | Frozen food (brief sempat menyebut "bordir"; dikonfirmasi sebagai salah ketik) | Konsisten dengan studi kasus |
| Model S4 (milik pemilik) | Opsional di M8b: dijalankan offline, hasil diimpor ke tabel `forecast_permintaan`, baru dipakai kalau MAE ≥10% lebih baik dari rata-rata bergerak | Per 20 Nov, S4 masih kalah dari interpolasi linear. Aplikasi tidak boleh bergantung padanya. |

**Rumus agen restock yang direncanakan:**
1. Kekurangan produk = Σ(pesanan berstatus diproses) − stok produk (diambil kalau positif)
2. Kebutuhan bahan = kekurangan produk × BOM (diambil maksimum dengan ramalan selama lead time)
3. Qty pesan = kebutuhan + reorder_point − stok − qty di PO draft/dikirim (diambil kalau positif)
4. Dikelompokkan per supplier, lalu dibuat 1 PO **DRAFT** per supplier (tetap menunggu persetujuan admin)

**Campur tangan pemilik:** menyetujui rencana, mengoreksi data contoh (frozen food), dan memutuskan S4 sebagai opsional.

---

## M0 — Setup proyek (20 Nov 2026)

### Yang dikerjakan
- Membuat proyek dengan `create-next-app@16.4.6` (TypeScript, Tailwind v4, ESLint, App Router, folder `src/`, alias `@/*`). Repo git langsung dibuat oleh create-next-app.
- Memasang `@supabase/supabase-js` dan `@supabase/ssr` (belum dipakai, disiapkan untuk M1–M2).
- Menyiapkan struktur folder: `src/lib/supabase`, `src/components`, `supabase/migrations`, `scripts`, `docs/screenshots`.
- Membuat `.env.example` (template variabel tanpa nilai) dan menambahkan pengecualian `!.env.example` di `.gitignore`.
- Mengganti halaman bawaan dengan halaman sementara berbahasa Indonesia yang menampilkan alur rantai pasok. `lang="id"` dan judul aplikasi diatur di `layout.tsx`.
- Menulis `CLAUDE.md` (konteks untuk agent anggota kelompok lain), `README.md`, dan jurnal ini.

### Keputusan teknis
1. **Next.js 16, bukan versi yang "dikenal" agent.** create-next-app membuat berkas `AGENTS.md` yang memperingatkan bahwa versi ini punya *breaking changes* dan meminta agent membaca dokumentasi di `node_modules/next/dist/docs/`. Agent membacanya dan menemukan dua hal penting:
   - `middleware.ts` sekarang bernama **`proxy.ts`** (akan dipakai di M2 untuk proteksi login).
   - Template bawaan menyalakan **`cacheComponents`** dan `partialPrefetching`.
2. **`cacheComponents` dimatikan.** Dengan fitur ini, setiap pembacaan cookie (misalnya sesi login) harus dibungkus `<Suspense>`, kalau tidak jadi *build error*. Semua halaman aplikasi admin ini membaca sesi login dan data per request, jadi tidak ada yang bisa di-prerender. Mematikannya membuat model mentalnya sederhana: halaman yang memakai cookie otomatis dirender dinamis. Alasannya ditulis sebagai komentar di `next.config.ts`.
3. **Tema terang saja.** Template bawaan punya mode gelap otomatis. Untuk aplikasi admin, satu tema berarti lebih sedikit kelas CSS yang perlu dirawat.
4. **Nama variabel Supabase memakai format baru** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (key `sb_publishable_...`), dan `DATABASE_URL` disiapkan khusus untuk skrip migrasi lokal, tidak dipasang di Vercel.
5. **Aset bawaan dihapus** (`next.svg`, `vercel.svg`, dll.) karena tidak dipakai.

### Masalah & perbaikan
| Masalah | Penyebab | Perbaikan |
|---|---|---|
| `create-next-app` memakan ~4 menit | Mengunduh 360 paket | Ditunggu saja; bukan error |
| Peringatan `eslint@9.39.5 deprecated` | Versi bawaan eslint-config-next | Dibiarkan. Hanya peringatan, lint tetap jalan. Tidak di-upgrade supaya tidak bentrok dengan konfigurasi Next. |
| Pola `.env*` di `.gitignore` ikut mengabaikan `.env.example` | Pola bawaan terlalu luas | Tambah baris `!.env.example` |
| Preview browser gagal: "No .claude/launch.json found" | Alat preview mencari konfigurasi di folder sesi (`D:\LAB`), bukan di folder proyek | Konfigurasi dipindah ke `D:\LAB\.claude\launch.json` dengan `npm --prefix scm-frozen-food run dev` (di luar repo, tidak di-commit) |

### Hasil tes
- `npm run build` → sukses (Compiled successfully, 2 route statis)
- `npm run lint` → tanpa error
- `npx tsc --noEmit` → tanpa error
- Cek visual di browser: desktop dan mobile (375 px) tampil rapi. Alur rantai pasok tersusun mendatar di desktop dan menurun di HP.
  - `docs/screenshots/m0-beranda-desktop.jpg`
  - `docs/screenshots/m0-beranda-mobile.jpg`

### Campur tangan pemilik
Tidak ada. Langkah berikutnya (M1) butuh pemilik membuat project Supabase.

---

## M1 — Skema database, fungsi stok, dan data contoh (20 Nov 2026)

### Yang dikerjakan
- **`0001_skema.sql`**: 13 tabel (supplier, bahan_baku, produk, reseller, bom, purchase_order, po_item, produksi, pesanan, pesanan_item, mutasi_stok, forecast_permintaan, agen_log), 5 enum status, dan indeks.
- **`0002_fungsi_stok.sql`**: 11 fungsi Postgres yang menjadi *satu-satunya* jalan mengubah stok: `buat_po`, `kirim_po`, `terima_po`, `batalkan_po`, `catat_produksi`, `buat_pesanan`, `kirim_pesanan`, `terima_pesanan`, `batalkan_pesanan`, `sesuaikan_stok`, dan inti `_mutasi`. Ditambah 2 trigger penjaga item PO/pesanan.
- **`0003_hak_akses.sql`**: semua hak bawaan dicabut lalu diberikan ulang secara eksplisit, plus RLS di 13 tabel.
- **`seed.sql`**: data usaha fiktif "Galunggung Frozen Food" (8 supplier di sekitar Tasikmalaya, 16 bahan, 8 produk, 12 reseller di Tasik/Ciamis/Banjar/Garut/Pangandaran, 57 baris BOM) dan **simulasi harian 365 hari** yang memanggil fungsi stok yang sama dengan aplikasi.
- **`scripts/db.mjs`**: perintah `npm run db:migrate | db:seed | db:test | db:reset`, dengan pencatatan migrasi di schema `internal`.
- **`scripts/tes-skenario.sql`**: 19 tes end-to-end dalam satu transaksi yang di-rollback.
- **`docs/alur-stok.md`**: penjelasan desain, rumus, dan jebakan untuk pemilik proyek.

### Keputusan teknis
1. **Stok dijaga di level database, bukan hanya di kode aplikasi.** Role `authenticated` tidak diberi hak UPDATE pada kolom `stok`, `status`, dan `nomor`. Perubahan wajib lewat fungsi `SECURITY DEFINER` (dengan `search_path = ''` untuk mencegah pembajakan). Akibatnya, kalau suatu saat ada bug di halaman web, stok tetap tidak bisa rusak lewat jalan pintas.
2. **Kolom stok + buku besar `mutasi_stok`.** Kolom `stok` menjawab "berapa sekarang", buku besar menjawab "kenapa segini" sekaligus menjadi data grafik dashboard. Keduanya selalu diubah bersamaan oleh `_mutasi`.
3. **Stok produk berkurang saat pesanan *dikirim*, bukan saat dibuat.** Pesanan yang masih diproses dihitung sebagai kebutuhan oleh agen restock.
4. **Hak bawaan Supabase dicabut dulu.** Agent sempat mengecek dokumentasi resmi Supabase. Di sana tertulis bahwa hak bawaan berbeda antar-project dan sedang diubah. Mencabut lalu memberi ulang secara eksplisit membuat hasilnya pasti sama.
5. **Riwayat diperpanjang dari 6 menjadi 12 bulan** supaya Ramadan dan Lebaran 2026 (Feb–Mar) ikut tercakup. Pola musiman ditulis eksplisit di `docs/alur-stok.md` §5 dan disebut sebagai **asumsi, bukan data nyata**.
6. **Seed berupa simulasi, bukan angka statis**, karena simulasi memakai fungsi stok yang sama. Riwayat pasti konsisten dengan buku besar, dan seed sekaligus menjadi uji beban (±1.700 pesanan, ±1.630 batch produksi, ±790 PO).
7. **Akhir simulasi sengaja dibuat "admin kewalahan"**: 4 supplier tidak dipesan selama 4 hari terakhir dan barang yang tiba hari ini belum dicatat. Dashboard jadi punya stok kritis dan PO berjalan, dan agen restock punya pekerjaan nyata.
8. **Uji coba dulu di Postgres lokal (PGlite, Postgres versi WebAssembly)** sebelum menyentuh Supabase, karena koneksi Supabase belum siap. Docker tidak berjalan, jadi PGlite dipasang di folder sementara agent, bukan di proyek.

### Masalah & perbaikan
| Masalah | Penyebab | Perbaikan |
|---|---|---|
| Skrip tidak bisa konek ke database | `DATABASE_URL` memakai *Direct connection* (`db.xxx.supabase.co`) yang **hanya IPv6**. Agent mengecek DNS (hanya ada AAAA) dan konektivitas IPv6 jaringan (timeout). | Pakai *Session pooler* (IPv4). `db.mjs` kini menolak URL direct dengan pesan jelas. |
| Agent salah lapor "password masih `[YOUR-PASSWORD]`" | Teks itu ternyata ada di baris komentar `.env.local` yang tersalin dari `.env.example`, bukan di URL | Diralat ke pemilik; validasi di `db.mjs` kini hanya memeriksa nilai URL |
| Setelah "sudah diganti", `.env.local` ternyata belum berubah (terakhir disimpan 19:52) | Kemungkinan file belum disimpan | Agent menyusun sendiri URL pooler dari project ref + password yang sudah ada |
| Host pooler Singapura: `tenant not found` | Project ternyata dibuat di region **Tokyo** (`aws-1-ap-northeast-1`) | Agent mencoba 51 host pooler (17 region × 3 indeks). Pooler menolak project yang salah *sebelum* password dikirim, jadi aman. Ketemu di Tokyo. |
| Tokyo: `password authentication failed` | Password masih diapit **kurung siku** dari template (`[rahasia]`) | Kurung siku dibuang, password di-URL-encode, baris `DATABASE_URL` ditulis ulang (tanpa menampilkan password di log) |
| Uji coba PGlite: `record "s" is not assigned yet` | Alias tabel `s` di query seed bentrok dengan variabel record `s` di blok PL/pgSQL | Alias diganti `sim` |
| (ditemukan saat review) buku besar bisa selisih 0,01 dari stok | Pembulatan ganda: `10 − 0,035 → 9,97` tetapi qty `−0,035 → −0,04` | `_mutasi` membulatkan qty sekali di awal |
| Uji coba pertama: tidak ada PO berstatus "dikirim" di akhir seed | Pembelian berhenti 3 hari sebelum akhir, padahal semua lead time ≤ 3 hari | Logika akhir simulasi diubah (lihat keputusan 7) |
| Kode produk `PRD-01` mirip nomor produksi `PRD-261120-0001` | Penamaan | Kode produk diganti `PJ-01` (produk jadi) |

### Hasil tes
- **Migrasi ke Supabase**: 3 migrasi terpasang (2,2 detik).
- **Seed ke Supabase**: 87,6 detik. Hasilnya 8 supplier, 16 bahan, 8 produk, 12 reseller, 57 BOM, 792 PO, 1.630 produksi, 1.699 pesanan, 21.705 mutasi.
- **19/19 tes skenario LULUS di Supabase**:
  - hak akses: anon ditolak; authenticated tidak bisa mengubah stok/status langsung dan tidak bisa memanggil `_mutasi`;
  - alur PO: draft → dikirim → diterima, stok +10, tidak bisa diterima dua kali, item terkunci setelah dikirim;
  - produksi: 8 bahan berkurang sesuai BOM, ditolak kalau bahan kurang, kegagalan tidak mengubah stok;
  - pesanan: stok berkurang saat dikirim, ditolak kalau stok kurang, bisa dibatalkan sebelum dikirim;
  - **stok setiap barang = total mutasinya** (21.718 baris diperiksa).
- **Data API (HTTP) dengan publishable key tanpa login**: baca `supplier`, baca `mutasi_stok`, dan panggil fungsi semuanya **ditolak** (42501).
- Kondisi data hari ini: 2 PO dikirim (berjalan), 1 PO draft, 9 bahan di bawah reorder point (4 belum dipesan), Lumpia Udang habis (udang kurang), 5 pesanan diproses, 3 pesanan dikirim.

### Campur tangan pemilik
- Membuat project Supabase dan mengisi `.env.local`.
- **Tidak perlu** mengulang pengisian `DATABASE_URL`: agent memperbaikinya sendiri (region Tokyo, kurung siku dihapus). URL dan publishable key aplikasi tidak diubah.
