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

---

## M4 — Purchase Order: draft → dikirim → diterima (21 Nov 2026)

### Yang dikerjakan
- **Daftar PO**: tab status dengan jumlah per status, filter nomor & supplier, **paginasi** 25 per halaman (±790 PO), badge PO buatan agen, dan keterangan "Perkiraan tiba / **Terlambat N hari** / Diterima tgl".
- **Form PO baru**: pilih supplier, lalu **baris bahan dinamis** (tambah/hapus). Bahan milik supplier tampil di grup teratas; harga terisi otomatis; stok & reorder point ditampilkan; subtotal/total dihitung langsung. Link `?supplier=<id>` memilih supplier otomatis.
- **Detail PO**: linimasa (Dibuat → Dikirim → Diterima, dengan perkiraan tiba), tombol aksi sesuai status (**Kirim ke supplier**, **Terima barang**, **Batalkan**), **edit item selama draft** (ubah jumlah/harga, hapus, tambah bahan), daftar "Masuk gudang bahan baku" setelah diterima (+qty → stok baru), catatan PO, dan tombol **pesan WhatsApp** ke supplier.
- Tampilan khusus draft dari **agen restock** (M8): penjelasan + tombol "Setujui & kirim ke supplier".
- Komponen baru: `TombolAksi`, `Paginasi`, `TabStatus`, `BadgeStatus`; `lib/status.ts`; `hariIni()` (WIB), `tambahHari()`, `selisihHari()`, `nomorWa()`.
- **9 unit test baru** (total 24): tanggal WIB di batas tengah malam, pergantian bulan/tahun, normalisasi nomor WA, format angka.
- `docs/purchase-order.md`.

### Keputusan teknis
1. **Semua perubahan status lewat fungsi database** (`kirim_po`, `terima_po`, `batalkan_po`). Hasilnya atomik, tidak bisa diterima dua kali (kunci baris), dan isi PO terkunci setelah dikirim (trigger).
2. **"Kirim ke supplier" = persetujuan admin.** Agen restock nanti hanya membuat draft. Tidak ada jalan bagi agen untuk mengirim PO.
3. **Baris dinamis dikirim sebagai JSON** dalam satu kolom tersembunyi, divalidasi zod di server (termasuk tolak bahan ganda), lalu `buat_po` membuat header + item dalam satu transaksi.
4. **Paginasi di server** (`.range()`): PostgREST maksimal mengirim 1.000 baris per request. Tanpa paginasi, PO lama akan "hilang" diam-diam begitu data bertambah.
5. **Tanggal dalam WIB** di aplikasi (`hariIni()`), sama dengan `public.hari_ini()` di database. Dengan UTC, pukul 00.00–07.00 WIB akan dianggap masih kemarin; ada unit test untuk kasus ini.
6. **WhatsApp tanpa API**: cukup link `wa.me` dengan pesan terisi. Tidak perlu API key berbayar, dan pesan tidak terkirim sebelum admin sendiri menekan kirim.

### Masalah & perbaikan
| Masalah | Penyebab | Perbaikan |
|---|---|---|
| (dicegah sebelum terjadi) baris bahan bisa hilang kalau server menolak form | React 19 mereset form setelah `action` selesai; baris disimpan di state React | Form PO memakai `onSubmit` + `startTransition`, yang tidak memicu reset. Diuji: submit tanpa supplier menampilkan "Pilih supplier" dan baris tetap utuh |
| Banner "Data berhasil ditambahkan" tetap tampil setelah PO dikirim/diterima | URL masih `?ok=ditambah` | Action status melakukan redirect ke `?ok=po-dikirim / po-diterima / po-dibatalkan` |
| Teks "dibatalkan" muncul dua kali di PO batal | Paragraf merah + keterangan status | Paragraf merah dihapus |
| Scrollbar vertikal kecil di tab status | Garis bawah tab `-mb-px` menimpa container `overflow-x-auto` | `overflow-y-hidden` |
| Setelah klik simpan, halaman tampak tidak berpindah selama ±5 detik | Dev server meng-compile halaman detail saat pertama dibuka (bukan error) | Dicek ulang: halaman sudah di `/purchase-order/796`. Di produksi halaman sudah ter-compile |
| Id PO melompat 792 → 796 | Tes skenario DB yang di-rollback tetap memakai nomor sequence | Perilaku normal Postgres; dicatat di docs |
| Perintah agent macet ±2 menit | Agent menulis `python3 -` yang menunggu input keyboard | Proses dihentikan, perubahan dijalankan lewat skrip berkas. Dicek: `CLAUDE.md` tidak sempat berubah setengah jalan |

### Hasil tes
- `tsc`, `lint`, `build`: lulus. **Unit test 24/24. Tes skenario DB 19/19**, termasuk cek buku besar: **21.720 baris = 21.718 sebelumnya + 2 mutasi** dari PO yang diterima saat uji browser. Stok tetap sama dengan total mutasinya.
- **Uji siklus penuh di browser**:
  1. Daftar: Semua 792 · Draft 1 · Dikirim 2 · Diterima 789; 32 halaman; PO 18 Nov ke Pangandaran tampil "Terlambat 1 hari".
  2. PO baru tanpa supplier → "Pilih supplier", baris Bawang merah 2 kg tetap ada. Pilih **Kios Bumbu Bu Imas** → bahan supplier itu pindah ke grup teratas; tambah baris Bawang putih 1 kg → simpan → **PO-261121-0796** (draft, Rp 122.000).
  3. Draft: ubah Bawang putih menjadi 1,5 kg → total Rp 141.000 ✔. Pesan WA: nomor `6285720041104`, isi daftar bahan ✔ (tidak dibuka/dikirim).
  4. **Kirim** → status Dikirim, item terkunci, perkiraan tiba 22 Nov (lead time 1 hari).
  5. **Terima** → status Diterima: **Bawang merah 2 → 4 kg (+2), Bawang putih 2,9 → 4,4 kg (+1,5)** ✔.
  6. PO tes lain (plastik 100 pcs) → **Batalkan** → banner "PO dibatalkan.", tanpa tombol aksi.
- Data yang berubah karena uji: 1 PO diterima (stok Bawang merah & Bawang putih bertambah, tercatat di mutasi) dan 1 PO dibatalkan. Keduanya transaksi sah. Kekurangan telur sengaja tidak disentuh supaya tetap menjadi kasus nyata untuk agen restock.
- Screenshot: `m4-po-daftar.png`, `m4-po-baru-validasi.jpg`, `m4-po-draft.jpg`, `m4-po-diterima.png`.

### Campur tangan pemilik
Tidak ada.

---

## M5 — Produksi: bahan berkurang sesuai BOM, produk bertambah (21–23 Nov 2026)

### Yang dikerjakan
- **Form catat produksi dengan pratinjau langsung**: pilih produk dan jumlah, lalu tabel menunjukkan pemakaian tiap bahan, stok sekarang, dan sisa setelah produksi. Bahan yang kurang ditandai merah, tombol simpan **nonaktif**, dan ada tautan ke pembuatan PO. Tombol "Maks" mengisi kapasitas maksimum. Dropdown produk menampilkan "bisa diproduksi N" untuk tiap produk.
- **Tanggal produksi** boleh lampau, tapi ditolak server kalau di masa depan.
- **Riwayat produksi**: ringkasan hasil 30 hari per produk (batang), filter produk, paginasi (±1.630 batch).
- **Detail batch**: hasil (+qty → stok produk), daftar bahan yang keluar dari gudang beserta stok sesudahnya, perkiraan biaya bahan, nilai jual.
- Tombol **"Catat produksi"** di halaman produk.
- Fungsi `kebutuhanProduksi()`, `bagiBulatBawah()`, `bulat2()` + **7 unit test baru** (total 31).
- `cekGalatMuat()` dipasang di **6 halaman detail**.
- `docs/produksi.md`.

### Keputusan teknis
1. **Pratinjau dihitung di browser, keputusan tetap di database.** Pratinjau memakai rumus yang sama dengan fungsi `catat_produksi`, termasuk pembulatan 2 desimal, tapi database tetap menjadi penjaga terakhir yang menolak kalau bahan kurang.
2. **Biaya batch memakai harga bahan saat ini.** Harga historis tidak disimpan. Ini keterbatasan yang dinyatakan jujur di halaman detail dan di docs. Untuk akuntansi sungguhan, harga per mutasi perlu dicatat.
3. **Agent menguji di tab browser terpisah.** Pemilik sedang memakai aplikasi di tab yang sama, dan aksi agent sempat "berebut" tab. Mulai titik ini agent membuka tab latar sendiri (sesi login tetap sama).

### Masalah & perbaikan
| Masalah | Penyebab | Perbaikan |
|---|---|---|
| **Bug M3:** kapasitas produksi kadang kurang 1 pak | `Math.floor(0.3 / 0.1)` = 2, karena 0,3/0,1 = 2,9999… di pecahan biner. Pemindaian kombinasi realistis menemukan **526 kasus** | `bagiBulatBawah(a,b) = Math.floor(a/b + 1e-9)` + unit test. Contoh tes awal agent (0,6/0,15) ternyata bukan kasus bermasalah; diganti 0,3/0,1 dan 0,7/0,1 setelah dicek |
| **Supabase gangguan** (20–21 Nov): halaman detail menampilkan **404** | API gateway Supabase membalas **HTTP 555** setelah 10 detik untuk Auth & REST, padahal Postgres sehat (pooler 0,75 dtk, PostgREST tersambung). Status page Supabase: "All Systems Operational". Halaman mengabaikan error query, jadi data `null` dianggap "tidak ada" | Diagnosis dari header respons (`sb-gateway-version`, `sb-project-ref` → berasal dari gateway Supabase, bukan jaringan lokal). Perbaikan kode: `cekGalatMuat()` membuat gangguan tampil sebagai halaman error. Gangguannya sendiri di luar kendali; per 23 Nov sudah pulih (200, 1,5 dtk) |
| Agent sempat salah diagnosis | Variabel shell mengambil dua hostname karena `.env.local` memuat contoh URL di baris komentar | Diagnosis diulang dengan Node yang membaca nilai variabel sebenarnya |
| **Berkas M5 tampak "hilang"** setelah 2 hari | Pemilik membuat repo GitHub, meng-commit kerja M5 yang belum di-commit sebagai "initial commit" di `main`, push, lalu checkout branch `M4` | Agent membaca `git reflog` dan isi commit tersebut (14 berkas M5 utuh), lalu pindah ke `main`. Riwayat yang sudah di-push tidak diubah |
| **Bug M2:** dua menu tersorot di halaman Produksi | `pathname.startsWith("/produk")` juga cocok untuk `/produksi` | Cocok persis atau `href + "/"` |
| Sesi login panel kedaluwarsa | Lewat 2 hari + refresh token gagal saat gateway gangguan | Pemilik login ulang |
| Hampir menekan tombol yang salah | Tombol submit pertama di halaman adalah "Keluar" (sidebar), bukan "Catat produksi" | Agent hanya men-scroll ke sana, lalu memilih tombol berdasarkan label persis. Pelajaran: jangan memilih `button[type=submit]` pertama |
| Simpan pertama tampak tidak berpindah halaman | Halaman detail di-compile saat pertama dibuka (dev) | Agent **tidak** mengklik ulang (risiko produksi tercatat dua kali), melainkan mengecek database: tercatat tepat 1 kali |

### Hasil tes
- `tsc`, `lint`, `build`: lulus. **Unit test 31/31. Tes skenario DB 19/19**, dengan buku besar **21.727 = 21.720 + 7 mutasi** dari produksi uji (6 bahan keluar + 1 produk masuk) ✔.
- **Uji di browser**:
  1. Produksi **20 pak Cireng**: pratinjau tapioka −5 kg (21,4 → 16,4), ayam −1,2 kg (37,5 → 36,3), plastik −20 (600 → 580), daun bawang −0,2, bawang putih −0,1, bumbu −0,1; stok Cireng 84 → 104. Disimpan sebagai **PRD-261123-1636**, dan halaman detail menunjukkan angka yang sama persis. Biaya Rp 7.560/pak sama dengan biaya BOM di M3 ✔.
  2. **Dimsum 10 pak** (telur habis): baris Telur merah "kurang 0,1 kg", tombol nonaktif, ada tautan PO ✔.
  3. **Tanggal besok** dipaksa masuk lewat skrip, lalu server menolak: "Tanggal produksi tidak boleh di masa depan"; jumlah tetap terisi. Database: 0 produksi bertanggal masa depan ✔.
  4. Riwayat: 1.631 batch / 66 halaman; ringkasan 30 hari tampil; sidebar hanya menyorot "Produksi" setelah perbaikan.
- Screenshot: `m5-form-pratinjau.jpg`, `m5-bahan-kurang.jpg`, `m5-produksi-daftar.png`, `m5-produksi-detail.png`.

### Campur tangan pemilik
- Membuat repo GitHub dan push. Ini lebih awal dari rencana M9 dan dilakukan sendiri oleh pemilik.
- Login ulang di panel browser setelah sesi kedaluwarsa.

---

## M6 — Pesanan reseller & pengiriman (23 Nov 2026)

### Yang dikerjakan
- **Daftar pesanan**: tab status dengan jumlah, filter nomor & reseller, paginasi (±1.700 pesanan), dan tanda **"Siap kirim" / "Stok kurang"** untuk pesanan yang masih diproses.
- **Form pesanan baru**: pilih reseller, lalu baris produk dinamis. Harga terisi dari harga jual dan stok ditampilkan. Memesan melebihi stok diperbolehkan dengan peringatan, karena pesanan adalah permintaan; yang dicegah adalah mengirim tanpa stok.
- **Detail pesanan**: linimasa (masuk → dikirim → diterima), **Kirim (stok berkurang)**, **Konfirmasi diterima**, **Batalkan** (hanya sebelum dikirim), edit isi selama diproses, peringatan "Belum bisa dikirim" + tautan *Catat produksi*, daftar "Keluar dari gudang barang jadi", catatan, dan **pesan WhatsApp ke reseller** yang isinya mengikuti status.
- Halaman reseller: tombol **Catat pesanan** dan **Riwayat pesanan**.
- Form catatan dipindah menjadi komponen bersama `CatatanDokumen` (dipakai PO & pesanan).
- `docs/pesanan.md`.

### Keputusan teknis
1. **Stok produk berkurang saat dikirim.** Pesanan diproses = kebutuhan, yang dipakai agen restock di M8.
2. **"Siap kirim" diperiksa per pesanan, bukan alokasi gabungan.** Lebih sederhana dan cukup untuk UMKM. Keterbatasannya ditulis di docs.
3. **Tombol "Kirim" sengaja tidak dinonaktifkan** walau stok kurang. Tampilan bisa basi; database tetap penjaga terakhir dan pesannya jelas. Ini berbeda dengan form produksi (M5), yang menonaktifkan tombol karena pratinjaunya dihitung saat itu juga.
4. **Batal hanya sebelum dikirim.** Retur adalah alur lain (di luar MVP).

### Masalah & perbaikan
| Masalah | Penyebab | Perbaikan |
|---|---|---|
| Form di tab uji agent tidak bereaksi (harga tidak terisi) | Agent menguji di **tab latar**. Chrome menunda hidrasi React, dan konten di dalam batas `loading.tsx` dihidrasi belakangan. Diagnosis: elemen form tidak punya properti `__reactFiber…`, sidebar punya; tidak ada error di konsol/log | Tab uji ditampilkan (front) selama pengujian form. Agent kini menunggu hidrasi sebelum berinteraksi. Bukan bug aplikasi |
| Screenshot memuat email admin | Diambil penuh, sehingga footer sidebar ikut | Area footer ditutup dengan Pillow sebelum commit. Aturan ditambahkan ke `CLAUDE.md` |
| `python -c` multi-baris gagal | Perintah `python` di komputer ini berupa skrip pembungkus Windows | Pakai berkas skrip (`.py`) |

### Hasil tes
- `tsc`, `lint`, `build`: lulus. **Unit test 31/31. Tes DB 19/19**; buku besar **21.729 = 21.727 + 2** (Cireng & Bakso keluar) ✔.
- **Uji siklus penuh di browser**:
  1. Daftar: Diproses 5 (2 "Siap kirim", 3 "Stok kurang" karena telur habis), Dikirim 3, Diterima 1.691; 68 halaman.
  2. Pesanan baru tanpa reseller → "Pilih reseller"; baris Cireng 10 & Bakso 5 tetap utuh; total Rp 375.000 ✔.
  3. Reseller **Warung Bu Yati Cipedes** → **PSN-261123-1712** (diproses). WA: nomor `62852…`, isi "sedang disiapkan" + daftar produk ✔ (tidak dibuka/dikirim).
  4. Edit Bakso 5 → 6: total Rp 420.000 ✔.
  5. **Kirim** → **Cireng 104 → 94, Bakso 64 → 58**; isi terkunci; banner "Pesanan dikirim…" ✔.
  6. **Konfirmasi diterima** → status Diterima, tidak ada aksi tersisa ✔.
  7. Pesanan seed **PSN-261120-1697** (Lumpia 2 pak, stok 0): halaman menampilkan "Belum bisa dikirim"; klik Kirim → **ditolak database**: "Stok produk tidak cukup untuk dikirim: Lumpia Udang isi 8 (pesan 2, stok 0)"; status tetap diproses ✔.
- Data yang berubah karena uji: 1 pesanan baru diterima (stok Cireng & Bakso berkurang, tercatat di mutasi). Pesanan seed tidak diubah.
- Screenshot: `m6-pesanan-daftar.png`, `m6-pesanan-baru-validasi.jpg`, `m6-pesanan-dikirim.png`.

### Campur tangan pemilik
- Memberi izin push M5 ke GitHub.

## M7 — Dashboard & buku besar mutasi stok (23 Nov 2026)

### Yang dikerjakan
- **Dashboard lengkap** (`/`):
  - 4 kartu yang bisa diklik: bahan di bawah ROP (+ berapa yang belum punya PO), produk di bawah stok minimum, PO berjalan (draft/dikirim/**terlambat**), pesanan berjalan (diproses/siap kirim/dikirim).
  - Banner kuning "N bahan kritis belum punya PO" dengan tombol **Jalankan agen restock** (halaman agen menyusul di M8).
  - **Grafik pergerakan stok 30 hari**: (1) arus barang jadi dalam pak, diproduksi vs dikirim; (2) nilai bahan baku dalam rupiah, diterima dari PO vs terpakai produksi.
  - Tabel **bahan kritis**, diurutkan dari yang paling jauh di bawah ROP, dengan kolom "sedang dipesan" atau tautan **Buat PO**. Tabel **stok barang jadi** dibandingkan pesanan yang belum dikirim, dengan tautan produksi kalau kurang.
  - Daftar **PO berjalan** (perkiraan tiba, badge terlambat, badge agen) dan **pesanan berjalan** (siap kirim / stok kurang).
- **Halaman Mutasi stok** (`/mutasi-stok`): buku besar semua pergerakan stok dengan filter barang, jenis, dan rentang tanggal (bawaan 30 hari), paginasi 50 baris, tautan ke dokumen asal (PO/produksi/pesanan). Kalau satu barang dipilih, muncul **grafik riwayat stok** (garis tangga) dengan garis ROP/stok minimum.
- Tombol **Riwayat stok** di halaman detail bahan baku dan produk.
- Migrasi `0005_ringkasan_mutasi.sql`: fungsi `mutasi_harian(p_hari)` untuk grafik.
- Komponen `components/grafik.tsx` (SVG) + `lib/grafik.ts` (skala sumbu, unit-tested). Alat bantu dev `scripts/kueri.mjs`.
- `docs/dashboard.md`.

### Keputusan teknis
1. **Grafik SVG buatan sendiri, bukan Recharts.** Rencana awal memakai Recharts, tetapi hanya dua jenis grafik sederhana yang dibutuhkan. SVG di Server Component = 0 KB JavaScript tambahan, tampil langsung tanpa menunggu hidrasi, dan tooltip cukup dengan `<title>` bawaan browser. Konsekuensinya, tooltip lebih sederhana (tanpa animasi).
2. **Agregasi harian di database** (`mutasi_harian`), bukan di aplikasi. 30 hari bisa berisi >1.000 mutasi, padahal PostgREST memotong di 1.000 baris; agregasi di Postgres hanya mengirim 30 baris. Fungsinya `SECURITY INVOKER` (hanya membaca), jadi RLS tetap berlaku.
3. **Nilai bahan dalam rupiah.** Bahan punya satuan berbeda (kg, liter, butir), jadi tidak bisa dijumlah langsung. Nilai = qty × harga satuan *saat ini* (perkiraan; harga historis tidak disimpan per mutasi).
4. **Saldo awal & stok opname tidak dihitung sebagai arus** di grafik dashboard, karena bukan barang yang benar-benar masuk/keluar. Keduanya tetap tampil di halaman Mutasi stok.
5. **Grafik riwayat stok berbentuk tangga**, karena stok berubah per kejadian, bukan bergerak mulus. Titik awal diambil dari mutasi terakhir sebelum rentang, supaya garis dimulai dari stok yang benar.

### Masalah & perbaikan
| Masalah | Penyebab | Perbaikan |
|---|---|---|
| `tsc`: *Type instantiation is excessively deep* | Fungsi filter generik menerima tipe query builder Supabase yang sangat dalam | Tipe dipersempit ke 3 metode yang dipakai (`eq`, `gte`, `lt`) |
| `?hal=99` → halaman error "PGRST103 Requested range not satisfiable" | Nomor halaman melebihi jumlah data, misalnya setelah filter dipersempit saat sedang di halaman 5. **Bug lama yang juga ada di daftar PO, produksi, dan pesanan** | Helper `kembaliKeHalaman1()` di `galat-db.ts`: arahkan ke halaman 1 dengan filter yang sama. Dipasang di keempat halaman daftar |
| Dashboard di ponsel melebar ke 698 px (perlu geser ke samping) | Kartu tabel ada di dalam `grid`; item grid punya `min-width: auto` sehingga tidak bisa lebih sempit dari isi tabelnya, walau tabel dibungkus `overflow-x-auto` | `[&>*]:min-w-0` pada grid (dashboard & detail produk) |
| Tabel kecil dashboard tergulung ke samping di desktop | `.tabel` punya `min-w-[640px]` (cocok untuk halaman daftar, terlalu lebar untuk kartu setengah layar) | `tabel min-w-0` khusus di dashboard |
| Tanggal "dari" > "sampai" | Isian pengguna | Ditukar otomatis |

### Hasil tes
- `tsc`, `lint`, `build`: lulus. **Unit test 36/36** (+5 untuk skala grafik). **Tes DB 20/20**: tes baru memastikan total grafik 30 hari = buku besar.
- **Uji browser** (1400×1000 dan ponsel 375 px):
  1. Dashboard: 10/16 bahan kritis (8 belum ada PO), 3/8 produk kritis, PO 1 draft · 2 dikirim · **2 terlambat**, pesanan 5 diproses (2 siap) · 3 dikirim. Grafik 30 hari: diproduksi 3.720 pak vs dikirim 3.733 pak; bahan diterima Rp 66,2 jt vs terpakai Rp 69,4 jt.
  2. Mutasi stok tanpa filter: 1.624 mutasi dalam 30 hari, 33 halaman.
  3. Filter Siomay: grafik tangga + garis stok minimum; stok akhir di grafik (42) = stok di master ✔. Filter "Terima PO" 20–23 Nov: tepat 2 baris (PO-261121-0796, uji M4) ✔.
  4. `?hal=99` dengan tanggal terbalik → diarahkan ke halaman 1, tanggal ditukar ✔. PO `?status=draft&hal=50` → halaman 1 ✔.
  5. Ponsel: lebar dokumen = 375 px di dashboard, mutasi stok, dan detail produk (tidak ada geser samping) ✔.
- Screenshot: `m7-dashboard-atas.jpg`, `m7-dashboard-bawah.jpg`, `m7-mutasi-stok.jpg` (footer email ditutup).

### Campur tangan pemilik
- Memberi izin push M6 ke GitHub.

## M8 — Agen restock (24 Nov 2026)

### Yang dikerjakan
- **Otak agen** `lib/agen-restock.ts`: fungsi murni `hitungRencana()`. Untuk tiap bahan menghitung kebutuhan dari pesanan reseller yang kekurangan stok (diturunkan lewat BOM) dan dari ramalan selama lead time, lalu mengambil yang terbesar. Bahan dipesan bila proyeksi < reorder point. Qty dibulatkan per satuan (lembar/100, pcs/50), dikelompokkan **satu draft PO per supplier**, dan setiap baris diberi **alasan tertulis**. 11 unit test.
- **Migrasi `0006_agen_restock.sql`**:
  - `rata_permintaan_harian(28)`: rata-rata bergerak 28 hari penuh, otomatis memakai ramalan S4 kalau ada (pintu untuk M8b).
  - `simpan_hasil_agen()`: membuat semua draft PO + `agen_log` dalam satu transaksi, dengan kunci anti klik ganda.
- **Halaman `/agen-restock`**:
  - Empat langkah cara kerja agen (amati, hitung, usulkan, admin menyetujui).
  - Ringkasan data yang diamati, termasuk barang jadi yang kurang untuk pesanan.
  - Usulan per supplier dengan tabel stok/ROP, sedang dipesan, kebutuhan (dari pesanan/ramalan), proyeksi, usulan + biaya, dan alasan yang bisa dibuka.
  - Tombol **"Buat N draft PO"**, banner hasil dengan tautan ke tiap draft, dan riwayat agen.
- Draft PO dari agen memakai alur M4 yang sudah ada: label "dibuat agen restock" dan tombol "Setujui & kirim ke supplier".
- `docs/agen-restock.md`.

### Keputusan teknis
1. **Berbasis aturan, tanpa LLM.** Keputusan pembelian harus bisa diaudit dan diulang. Setiap angka bisa ditelusuri ke rumus, dan alasannya ditulis per bahan. *Human-in-the-loop*: agen hanya membuat **draft**, pengiriman ke supplier tetap lewat tombol admin.
2. **Kebutuhan = maks(pesanan, ramalan), bukan jumlah.** Pesanan yang sudah masuk adalah bagian dari permintaan yang diramalkan, jadi menjumlahkan keduanya berarti menghitung dua kali.
3. **Logika di TypeScript murni, penyimpanan di Postgres.** Rumus mudah diuji unit dan dibaca; database menjamin atomisitas, kunci, dan hak akses (`agen_log` hanya bisa ditulis lewat fungsi).
4. **Server menghitung ulang + "sidik" pratinjau.** Browser tidak mengirim jumlah apa pun, hanya sidik rencana yang dilihat admin. Kalau hasil hitung ulang berbeda, simpan ditolak, sehingga yang disimpan = persis yang dilihat.
5. **Pintu S4 dibuat sekarang** (di `rata_permintaan_harian`), sehingga M8b cukup mengimpor baris `forecast_permintaan` tanpa mengubah kode agen.

### Masalah & perbaikan
| Masalah | Penyebab | Perbaikan |
|---|---|---|
| Tes DB "klik ganda tidak membuat PO kedua" gagal (menghitung 0) | Tesnya salah: `created_at` = `now()` = waktu **awal transaksi**, lebih awal dari `clock_timestamp()` yang dicatat tes | Hitung berdasarkan `id >= PO pertama`. Fungsi agen sendiri sengaja memakai `clock_timestamp()` untuk waktu log, karena alasan yang sama |
| Konsol menampilkan error PGRST103 di halaman Mutasi stok | Sisa log dari uji `?hal=99` di M7 **sebelum** perbaikan; bukan error baru | Tidak perlu perubahan (dicek ulang) |

### Hasil tes
- `tsc`, `lint`, `build`: lulus. **Unit test 47/47** (+11 agen). **Tes DB 23/23** (+3: agen hanya membuat draft bersumber agen + log; rencana basi/klik ganda ditolak dan tidak membuat PO kedua; `authenticated` tidak bisa menulis `agen_log` langsung).
- **Uji di browser**:
  1. Pratinjau: 10/16 bahan di bawah ROP; kekurangan Dimsum 10 pak & Lumpia 12 pak; usulan **9 bahan dari 6 supplier, Rp 2.512.000**. Udang kupas (sudah ada PO 7 kg) dan ikan tenggiri (PO 30 kg) **tidak** dipesan lagi ✔. Telur: 0/5 kg → 7 kg ✔ (sesuai hitungan manual di docs).
  2. **Buat 6 draft PO** → PO-261124-0805…0810, semua *draft*, sumber *agen*, total di DB = pratinjau ✔. Halaman PO menampilkan label agen + "Setujui & kirim ke supplier" ✔.
  3. Dijalankan lagi → "Tidak ada bahan yang perlu dipesan" (tidak dobel) ✔. Dashboard: "10/16 · semua sudah dipesan" ✔.
  4. **Data berubah saat pratinjau terbuka**: draft Kios Bumbu dibatalkan sehingga agen mengusulkannya lagi, lalu dibuat PO manual daun bawang 1 kg saat pratinjau masih terbuka. Klik "Buat 1 draft PO" → **ditolak**: "Data stok/pesanan/PO berubah sejak pratinjau ditampilkan…" ✔. PO uji dibatalkan, halaman dimuat ulang, dijalankan → PO-261124-0816 ✔.
- Data yang tertinggal untuk demo: **6 draft PO agen** (0805, 0807–0810, 0816) menunggu persetujuan; 0806 & 0815 (uji) dibatalkan.
- Screenshot: `m8-agen-pratinjau.jpg`, `m8-agen-hasil.jpg`, `m8-draft-po-agen.jpg`.

### Campur tangan pemilik
- Memberi izin push M7 ke GitHub.
