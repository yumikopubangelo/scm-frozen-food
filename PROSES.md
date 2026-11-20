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
