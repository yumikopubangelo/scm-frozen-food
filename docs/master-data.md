# Master Data & BOM — penjelasan untuk pemilik proyek

> Halaman: Supplier, Bahan baku, Produk & BOM, Reseller.
> Berkas utama: `src/app/(app)/<entitas>/`, `src/lib/validasi.ts`, `src/lib/galat-db.ts`, `src/components/form.tsx`, `src/lib/hitung-produk.ts`.

## 1. Pola yang sama untuk keempat entitas

Setiap entitas punya 5 berkas dengan peran yang sama. Kalau sudah paham Supplier, tiga lainnya tinggal dibaca cepat.

| Berkas | Jenis | Isi |
|---|---|---|
| `page.tsx` | Server Component | daftar + pencarian (`?q=`) + banner sukses (`?ok=`) |
| `baru/page.tsx` | Server Component | form tambah, dengan **kode otomatis** (SUP-09, BB-17, …) |
| `[id]/page.tsx` | Server Component | form ubah + tombol hapus + info terkait |
| `form-xxx.tsx` | Client Component | form memakai `useActionState`; dipakai halaman *baru* dan *ubah* |
| `actions.ts` | Server Action (`"use server"`) | `simpanXxx` (tambah/ubah) dan `hapusXxx` |

Alur simpan:

```
form (browser) ──submit──▶ simpanSupplier(id, prev, formData)   [server]
                             1. bacaForm(skema zod) → kalau salah, kembalikan galat per kolom
                             2. supabase.insert / update        → kalau DB menolak, pesanGalat()
                             3. revalidatePath + redirect("/supplier?ok=ditambah")
```

`simpanSupplier.bind(null, id)` "menempelkan" id ke action. `id = null` berarti tambah, angka berarti ubah. Satu fungsi melayani keduanya.

## 2. Validasi (`src/lib/validasi.ts`)

Validasi dilakukan **di server** memakai **zod**. Validasi di browser bisa dilewati orang yang iseng, sedangkan validasi di server tidak. Database juga punya pengaman terakhir (`check (stok >= 0)`, `unique (kode)`).

| Pembentuk | Aturan | Contoh pesan |
|---|---|---|
| `teksWajib("Nama")` | dipangkas spasinya, tidak boleh kosong | "Nama wajib diisi" |
| `teksOpsional()` | kosong disimpan sebagai `NULL` | – |
| `angkaWajib("Stok", {min, lebihDari})` | menerima **koma atau titik** desimal (`0,25` = `0.25`) | "Stok minimal 0", "harus berupa angka" |
| `bulatWajib("Lead time")` | angka bulat | "harus bilangan bulat" |
| `idOpsional` | pilihan dropdown kosong menjadi `NULL` | – |

**Kenapa isian tidak hilang saat ada error?** React 19 otomatis mengosongkan form setelah action selesai. Karena itu action mengembalikan `nilai` (isian terakhir) dan `versi` (angka baru setiap submit). Komponen `Field` memakai `key={versi}`, sehingga input dibuat ulang dengan `defaultValue` = isian terakhir.

Ada 15 unit test (`npm test`) yang memeriksa aturan ini, termasuk kasus-kasus tepi seperti "kosong", "abc", "0,25", "-5", dan "1,5" untuk bilangan bulat.

## 3. Pesan error database (`src/lib/galat-db.ts`)

| Kode Postgres | Arti | Pesan ke admin |
|---|---|---|
| `23505` | data kembar (unique) | "Kode itu sudah dipakai. Gunakan kode lain." |
| `23503` | masih dirujuk tabel lain (foreign key) | "Tidak bisa dihapus karena masih dipakai di purchase order…" |
| `23514` | melanggar `check` | "Nilai tidak valid (misalnya angka negatif)." |
| `42501` | tidak punya hak | "Anda tidak punya izin… Coba login ulang." |
| `P0001` | `raise exception` dari fungsi stok | pesannya sudah bahasa Indonesia, diteruskan apa adanya |

**Aturan hapus.** Data master yang sudah punya riwayat transaksi tidak bisa dihapus. Supplier dengan PO, bahan yang ada di BOM/PO/mutasi, dan produk yang pernah diproduksi/dipesan semuanya ditolak database (`ON DELETE RESTRICT`). Ini disengaja: laporan masa lalu harus tetap utuh. Data baru yang belum dipakai (misalnya salah input) tetap bisa dihapus.

## 4. Stok tidak bisa diedit di form

Form bahan baku dan produk **tidak punya kolom stok**. Database juga menolaknya, karena role aplikasi tidak punya hak `UPDATE stok` (lihat `docs/alur-stok.md` §4). Stok hanya berubah lewat:
1. penerimaan PO (M4), produksi (M5), dan pengiriman pesanan (M6);
2. **stok opname** (`src/lib/aksi-stok.ts`): admin mengisi hasil hitung fisik, lalu fungsi `sesuaikan_stok` mencatat **selisihnya** sebagai mutasi `penyesuaian`. Kalau angkanya sama, tidak ada yang dicatat.

Bahan atau produk baru mulai dengan stok 0.

## 5. Rumus di halaman Produk (`src/lib/hitung-produk.ts`)

**Biaya bahan per pak** (HPP bahan):

```
biaya = Σ ( qty_per_unit × harga_satuan_bahan )
```

Contoh Bakso Sapi isi 25: daging sapi 0,25 kg × Rp 130.000 = Rp 32.500; tapioka 0,15 kg × Rp 12.000 = Rp 1.800; ditambah bawang, bumbu, dan plastik, totalnya **Rp 36.300**. Harga jual Rp 45.000, jadi **margin kotor Rp 8.700 (19%)**.
Angka ini *batas bawah* HPP, karena belum termasuk tenaga kerja, listrik freezer, dan susut.

**Kapasitas produksi dari stok sekarang**:

```
kapasitas = min over bahan di BOM ( ⌊ stok_bahan ÷ qty_per_unit ⌋ )
```

Bahan yang paling cepat habis disebut *bottleneck* dan ditampilkan sebagai "dibatasi …". Contoh: daging sapi 14,5 kg ÷ 0,25 = 58 pak, sedangkan tapioka 21,4 ÷ 0,15 = 142 pak. Jadi kapasitasnya **58 pak, dibatasi daging sapi**.
Saat ini lima produk berkapasitas 0 karena **telur habis**. Ini bahan nyata untuk agen restock di M8.

**Temuan berkat rumus ini:** resep bakso di seed awal memakai 0,35 kg sapi, sehingga biaya bahannya Rp 48.700, *lebih mahal* dari harga jual Rp 45.000 (margin −8%). Resep dikoreksi menjadi 0,25 kg sapi + 0,15 kg tapioka (±50% daging, wajar untuk bakso frozen kelas UMKM). Koreksinya dilakukan lewat editor BOM di aplikasi, lalu `seed.sql` ikut disamakan.

## 6. Pencarian (`src/lib/cari.ts`)

Kotak cari berupa form GET biasa (kata kunci masuk ke URL `?q=`), jadi tetap jalan tanpa JavaScript dan bisa di-bookmark. Filter dikirim ke PostgREST sebagai `kode.ilike.%kata%,nama.ilike.%kata%`. Karakter `, ( ) * % \` dibuang dari kata kunci karena punya arti khusus di sintaks filter. Tanpa itu, pengguna bisa "menyuntikkan" filter lain, mirip SQL injection.

Filter yang membandingkan **dua kolom** (stok < reorder point) tidak didukung filter PostgREST, jadi disaring di server setelah data diambil. Datanya hanya puluhan baris, jadi tidak masalah.

## 7. Jebakan yang ditemui

1. **`z.coerce` menyembunyikan isian kosong.** Dengan `z.coerce.number()`, fungsi pesan error menerima nilai yang *sudah dikonversi* (`NaN`), sehingga isian kosong dan "abc" sama-sama tampil "harus berupa angka". **Perbaikan:** konversi sendiri di `preprocess`, lalu validasi dengan `z.number()` biasa. Ada unit test untuk ini.
2. **CSS lama dari cache Turbopack.** Kelas `.tabel` sudah ada di `globals.css` dan di hasil `next build`, tapi tidak muncul di dev server, bahkan setelah server di-restart. Penyebabnya, cache persisten di `.next/dev` menyimpan versi lama. **Perbaikan:** hentikan dev server, hapus `.next/dev`, lalu jalankan ulang.
3. **Riwayat stok bisa ikut terhapus.** Di M1, `mutasi_stok` memakai `ON DELETE CASCADE`, sehingga menghapus bahan ikut menghapus riwayat stoknya diam-diam. **Perbaikan:** migrasi `0004_lindungi_riwayat_stok.sql` mengganti aturan itu menjadi `RESTRICT`.
4. **Angka tampil dengan titik.** Isian yang sudah tersimpan tampil "0.25", padahal admin mengetik "0,25". **Perbaikan:** komponen `Field` menampilkan angka dengan koma.
5. **Tipe rute belum dibuat.** `PageProps<"/supplier/[id]">` error sampai `npx next typegen` dijalankan, karena Next membuat tipe rute dari folder yang ada.
6. **Dependensi dev rentan.** Vitest 3 punya laporan kerentanan (`npm audit`: 2 critical, 1 moderate). Upgrade ke Vitest 5 butuh `@types/node` ≥ 22, yang memang sesuai dengan Node 22 di komputer dan di Vercel. Hasilnya 0 kerentanan.

## 8. "Kalau aku mau mengubah X, sentuh berkas mana?"

| Mau mengubah | Berkas |
|---|---|
| menambah kolom di form supplier | migrasi baru (kolom DB) + `supplier/actions.ts` (skema zod) + `form-supplier.tsx` (Field) + `page.tsx` (kolom tabel) |
| pesan error validasi | `src/lib/validasi.ts` |
| pesan error database | `src/lib/galat-db.ts` |
| pilihan satuan bahan | `SATUAN_BAHAN` di `src/lib/tipe.ts` |
| rumus biaya / kapasitas produksi | `src/lib/hitung-produk.ts` |
| warna badge Aman/Kritis/Habis | `BadgeStok` di `src/components/ui.tsx` |
