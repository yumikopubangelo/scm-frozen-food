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

---

## M2 — Login, proteksi halaman, dan kerangka tampilan (20–21 Nov 2026)

### Yang dikerjakan
- **Login admin** dengan Supabase Auth (email + password): halaman `/login`, Server Action `login`/`logout`, dan pesan error berbahasa Indonesia.
- **Proteksi tiga lapis**: `src/proxy.ts` (pengganti middleware di Next 16) memperbarui sesi dan mengalihkan pengguna yang belum login, `wajibLogin()` di layout server memverifikasi ulang, dan database (GRANT + RLS dari M1) menolak role anon.
- **Kerangka tampilan**: route group `src/app/(app)/` dengan sidebar tetap di desktop (≥ 1024 px) dan laci menu ☰ di HP. Ditambah 10 menu, halaman sementara "dibangun di milestone Mx" untuk menu yang belum jadi, halaman error, dan kerangka loading.
- **Dashboard sementara**: 4 angka (bahan kritis, produk kritis, PO berjalan, pesanan berjalan) langsung dari Supabase. Tujuannya membuktikan jalur data untuk admin yang login.
- Kelas tampilan bersama di `globals.css` (`.card`, `.input`, `.btn-*`) dan ikon `lucide-react`.
- `docs/login-dan-layout.md`: penjelasan untuk pemilik proyek.

### Keputusan teknis
1. **`getClaims()`, bukan `getSession()`**, untuk memeriksa login di server. `getSession()` hanya membaca cookie yang bisa dipalsukan, sedangkan `getClaims()` memverifikasi tanda tangan JWT. Peringatan ini tertulis di dokumentasi library Supabase sendiri.
2. **Proxy bukan satu-satunya pengaman.** Dokumentasi Next.js 16 menyebut proxy hanya untuk pengecekan "optimistis", jadi layout server memeriksa ulang.
3. **Login lewat Server Action + `useActionState`**, pola resmi Next untuk form dengan pesan error. Hasilnya tidak perlu API route terpisah dan tidak perlu klien Supabase di browser.
4. **Pesan error login sengaja umum** ("Email atau password salah") supaya orang tidak bisa menebak email yang terdaftar. Parameter `?next=` hanya menerima path internal untuk mencegah *open redirect*.
5. **Pendaftaran publik wajib dimatikan.** Kebijakan RLS "authenticated boleh semua" hanya aman kalau tidak ada orang asing yang bisa membuat akun. Agent memverifikasinya lewat endpoint `/auth/v1/settings` (`disable_signup: true`) tanpa membuat akun percobaan.
6. **Screenshot laporan di-crop** supaya email admin di footer sidebar tidak ikut masuk ke repo yang nanti publik.

### Masalah & perbaikan
| Masalah | Penyebab | Perbaikan |
|---|---|---|
| `next build` gagal: `Cannot find module '../../../src/app/page.js'` | Tipe hasil generate dev server (`.next/dev/types`) masih menunjuk lokasi lama setelah `page.tsx` dipindah ke `(app)/` | Hentikan dev server, hapus `.next`, build ulang |
| TypeScript: `'bahan.data' is possibly 'null'` | TS tidak menyempitkan tipe setelah `if (galat) throw` yang menggabungkan 4 error | `const daftarBahan = bahan.data ?? []` |
| Lint `react-hooks/set-state-in-effect` | Laci menu ditutup lewat `useEffect` yang memantau URL, sehingga render dua kali | Laci ditutup di `onClick` link |
| (dicegah sebelum terjadi) `@apply btn` di Tailwind v4 | Di v4, kelas buatan sendiri harus didaftarkan dengan `@utility` supaya bisa di-`@apply` | `@utility btn { ... }` |
| Pemilik login, tapi panel browser agent masih di halaman login | Login dilakukan di browser lain (Chrome), padahal sesi tiap browser terpisah. Agent memastikan lewat log server (ada login sukses + halaman terlindungi 200) dan cookie panel (kosong), sehingga bukan bug sesi hilang. | Pemilik login ulang di panel browser agent |
| Pindah halaman pertama kali terasa diam ±3 detik | Dev server meng-compile halaman saat pertama dibuka; tidak ada indikator loading | Ditambah `loading.tsx` (kerangka abu-abu). Di produksi halaman sudah ter-compile. |

### Hasil tes
- `npm run build`, `npm run lint`, `tsc --noEmit`: lulus. 11 route dinamis + Proxy aktif.
- Buka `/purchase-order` tanpa login → dialihkan ke `/login?next=%2Fpurchase-order`.
- Login dengan email/password palsu buatan agent → "Email atau password salah.", email tetap terisi, password dikosongkan.
- Setelan Supabase: `disable_signup: true`; 1 akun admin terkonfirmasi.
- Setelah pemilik login: dashboard menampilkan **9/16 bahan kritis, 3/8 produk kritis, 3 PO berjalan, 8 pesanan berjalan**. Angkanya cocok dengan isi database hasil seed M1, jadi jalur data untuk role authenticated terbukti.
- Desktop 1280 px: sidebar tetap, menu aktif tersorot, navigasi ke `/bahan-baku` berhasil.
- Mobile 375 px: header + tombol ☰, laci menu terbuka dengan latar gelap, klik link menutup laci, kartu dashboard tersusun satu kolom.
- **Belum diuji di browser**: tombol "Keluar". Sengaja tidak diklik supaya sesi panel tetap terpakai untuk M3–M8; akan diuji di M9.
- Screenshot: `m2-login.jpg`, `m2-login-salah.jpg`, `m2-dashboard-desktop.png`, `m2-halaman-placeholder.png`, `m2-menu-mobile.png`, `m2-dashboard-mobile.png`.

### Campur tangan pemilik
- Mematikan "Allow new users to sign up" dan membuat akun admin (Auto Confirm) di dashboard Supabase.
- Login di panel browser agent (agent tidak boleh mengetik password asli).

---

## M3 — Master data (supplier, bahan baku, produk, reseller) & BOM (21 Nov 2026)

### Yang dikerjakan
- **CRUD empat entitas** dengan pola yang sama: daftar + pencarian, form tambah dengan **kode otomatis** (SUP-09, BB-17, PJ-09, RSL-13), form ubah, dan hapus dengan konfirmasi.
  - **Supplier:** jumlah bahan yang dipasok, daftar bahan dan status stoknya.
  - **Reseller:** filter tipe toko/reseller, saran kota dari data yang ada, ringkasan jumlah dan nilai pesanan.
  - **Bahan baku:** badge Aman/Kritis/Habis, filter "hanya di bawah reorder point", nilai persediaan, supplier utama, daftar produk yang memakai bahan ini.
  - **Produk & BOM:** **editor resep** (tambah bahan, ubah jumlah per pak, hapus), **biaya bahan per pak**, **margin kotor**, dan **kapasitas produksi** dari stok sekarang beserta bahan pembatasnya.
- **Stok opname** di halaman bahan dan produk, lewat fungsi `sesuaikan_stok`. Selisihnya dicatat di mutasi.
- Komponen bersama: `Field`/`Pilihan`/`TombolSimpan` (form), `Tabel`, `Badge`, `Pencarian`, `BannerOk`, `TombolHapus`, `StokOpname`.
- Pustaka: `validasi.ts` (zod), `galat-db.ts` (kode error Postgres → kalimat Indonesia), `format.ts` (Rupiah, angka, tanggal), `cari.ts`, `hitung-produk.ts`.
- **Unit test pertama (Vitest): 15 tes** untuk validasi, pencarian, dan kode otomatis.
- Migrasi **`0004_lindungi_riwayat_stok.sql`**.
- `docs/master-data.md`.

### Keputusan teknis
1. **Satu pola, empat entitas** (`page` / `baru` / `[id]` / `form-xxx` / `actions`). Agak berulang, tapi tiap berkas pendek dan mudah dibaca. Agent sengaja tidak membuat "CRUD generik" berbasis konfigurasi, karena lebih sulit dipahami pemilik proyek.
2. **Validasi di server dengan zod.** Validasi di browser bisa dilewati, sedangkan database tetap menjadi pengaman terakhir (`unique`, `check`, FK).
3. **Koma desimal gaya Indonesia** diterima di semua input angka (`0,25`) dan ditampilkan kembali dengan koma.
4. **Isian tidak hilang saat error.** React 19 mengosongkan form setelah action, jadi action mengembalikan isian terakhir dan `key={versi}` membuat input dibuat ulang dengan nilai itu.
5. **Data bertransaksi tidak bisa dihapus.** Supplier dengan PO, bahan dengan riwayat, dan sejenisnya ditolak database dengan pesan yang jelas. Laporan masa lalu harus tetap utuh.
6. **Kolom stok tidak ada di form.** Stok hanya berubah lewat transaksi atau stok opname yang tercatat.
7. **Biaya bahan & kapasitas produksi** dihitung dari BOM. Ini informasi SCM yang langsung berguna dan menjadi dasar agen restock (bahan pembatas = bahan yang harus dibeli).

### Masalah & perbaikan
| Masalah | Penyebab | Perbaikan |
|---|---|---|
| **Data seed tidak realistis:** Bakso Sapi biaya bahan Rp 48.700 > harga jual Rp 45.000 (margin −8%) | Resep seed memakai 0,35 kg sapi × Rp 130.000. Baru terlihat setelah kolom "Biaya bahan" dibuat | Resep dikoreksi lewat **editor BOM di aplikasi** menjadi 0,25 kg sapi + 0,15 kg tapioka (±50% daging), sehingga margin 19%. `seed.sql` disamakan |
| **Desain M1:** menghapus bahan ikut menghapus riwayat stoknya | `mutasi_stok` memakai `ON DELETE CASCADE` | Migrasi `0004` mengganti menjadi `RESTRICT` |
| Isian angka kosong tampil "harus berupa angka", bukan "wajib diisi" | `z.coerce.number()` memberi fungsi error nilai yang sudah dikonversi (`NaN`) | Konversi sendiri di `preprocess`, lalu `z.number()`; ditambah unit test |
| Tabel tampil tanpa gaya (header tengah, tanpa padding) di dev server | Cache persisten Turbopack (`.next/dev`, 179 MB) menyimpan `globals.css` versi lama. Agent memastikan lewat: CSS produksi berisi `.tabel`, CSS dev tidak; restart biasa tidak cukup | Hentikan dev server, hapus `.next/dev`, jalankan ulang |
| `PageProps<"/supplier/[id]">` error TypeScript | Tipe rute dibuat Next dari folder yang ada; rute baru belum terdaftar | `npx next typegen` |
| `npm audit`: 2 critical + 1 moderate | Agent memasang Vitest 3 (versi lama) | Upgrade ke Vitest 5. Ini butuh `@types/node` ≥ 22 (dari template: 20), yang memang cocok dengan Node 22 di komputer dan Vercel. Hasilnya **0 kerentanan** |
| Angka tersimpan tampil "0.25" padahal admin mengetik "0,25" | `String(number)` memakai titik | `Field` dan editor BOM menampilkan koma |
| Pesan stok opname "37.5" dan "selisihnya tercatat" walau tidak ada selisih | Angka tidak diformat; kalimat terlalu yakin | Diformat `angka()`, kalimat diubah menjadi "kalau ada selisih…" |
| Klik hapus lewat skrip tidak bereaksi | Skrip berjalan sebelum React selesai memasang handler (halaman baru dimuat) | Diulang dengan klik sungguhan setelah halaman siap. Data dicek langsung di DB: SUP-01 dan 85 PO-nya utuh |
| Agent salah menulis skrip `perl` sehingga link tabel menjadi `/PLACEHOLDER` | Kesalahan agent sendiri saat menambah lebar kolom | Diperbaiki dengan edit tepat. Dicek `grep`: tidak ada sisa |
| Nama bahan terpotong 3 baris, kode `SUP-01` terbelah | Kolom terlalu sempit di lebar panel | `min-w-44` untuk kolom nama, `whitespace-nowrap` untuk kode/telepon/angka |

### Hasil tes
- `tsc`, `lint`, `build`: lulus. **Unit test 15/15. Tes skenario DB 19/19** (diulang setelah migrasi 0004).
- **Uji di browser (panel agent, sudah login)**:
  - Supplier: form kosong/salah menampilkan "Nama supplier wajib diisi" dan "Lead time harus berupa angka", isian tetap ada, kode otomatis `SUP-09`. Simpan menampilkan banner "Data berhasil ditambahkan." Ubah kode menjadi `SUP-01` menampilkan "Kode itu sudah dipakai". Hapus supplier tes berhasil. **Hapus SUP-01 ditolak**: "masih dipakai di purchase order" (dicek di DB: 85 PO utuh).
  - Bahan baku: filter kritis menampilkan **9 bahan** (sama dengan dashboard), Telur "Habis", format angka Indonesia (`0,6`, `1.300`). Stok opname dengan angka negatif ditolak; dengan angka sama "37,5" (koma) berhasil tanpa mutasi baru.
  - Produk: daftar dengan biaya bahan, margin, dan kapasitas. Produk tes dibuat, langsung diarahkan ke halaman resep ("Resep masih kosong"). Tambah bahan tanpa memilih menampilkan "Pilih bahan". Tambah daging ayam 0,2 kg menghasilkan biaya Rp 10.400 dan kapasitas 187 pak (⌊37,5/0,2⌋) ✔. Hapus baris resep lalu hapus produk berhasil.
  - Reseller: filter tipe toko menampilkan 7 toko. Detail RSL-01: 207 pesanan, total Rp 161.864.000, saran 6 kota.
  - Mobile 375 px: halaman tidak melebar (lebar dokumen = 375); hanya tabel yang bisa digeser di dalam kartunya.
- Data tes (SUP-09, Produk Tes) sudah dihapus lagi. Satu-satunya perubahan data yang disengaja adalah koreksi resep Bakso Sapi.
- Screenshot: `m3-validasi-form.jpg`, `m3-hapus-ditolak.png`, `m3-bahan-baku.png`, `m3-produk-daftar.png`, `m3-produk-bom.png`.

### Campur tangan pemilik
Tidak ada.
