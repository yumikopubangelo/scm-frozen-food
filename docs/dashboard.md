# Dashboard & Mutasi Stok — penjelasan untuk pemilik proyek

> Berkas: `src/app/(app)/page.tsx` (dashboard), `src/app/(app)/mutasi-stok/page.tsx`, `src/components/grafik.tsx`, `src/lib/grafik.ts`, fungsi database `mutasi_harian` di `supabase/migrations/0005_ringkasan_mutasi.sql`.

## 1. Isi dashboard dan asal angkanya

| Bagian | Rumus / sumber |
|---|---|
| Bahan di bawah reorder point | `stok < reorder_point` (tabel `bahan_baku`) |
| …belum ada PO | bahan kritis yang **tidak muncul** di item PO berstatus draft/dikirim |
| Produk di bawah stok minimum | `stok < stok_minimum` (tabel `produk`) |
| PO terlambat | status *dikirim* dan `tanggal_dikirim + lead_time_hari supplier < hari ini` |
| Pesanan siap kirim | pesanan *diproses* yang **setiap** produknya `stok ≥ qty` (sama dengan aturan di M6) |
| Kolom "Dipesan" stok barang jadi | Σ qty produk itu di semua pesanan *diproses* |
| Grafik arus barang jadi | per hari: Σ mutasi produk sumber `produksi` (masuk) dan `pesanan` (keluar), satuan pak |
| Grafik nilai bahan baku | per hari: Σ qty × `harga_satuan` mutasi bahan sumber `po` (masuk) dan `produksi` (terpakai) |

Catatan:
- PostgREST tidak bisa membandingkan dua kolom (`stok < reorder_point`) di filter, jadi penyaringan kritis dilakukan di server Next.js. Datanya hanya puluhan baris, jadi ini tidak masalah.
- **Rupiah untuk bahan** karena satuannya berbeda-beda (kg, liter, butir, pcs), sehingga "3 kg + 40 butir" tidak bermakna. Harga yang dipakai adalah harga satuan **saat ini**; harga historis per mutasi tidak disimpan. Jadi grafik ini adalah **perkiraan nilai**, bukan laporan keuangan.
- **Saldo awal dan stok opname tidak ikut di grafik dashboard**, karena bukan arus barang sungguhan. Keduanya tetap tampil di halaman Mutasi stok.

## 2. Kenapa grafik dihitung di database?

```
mutasi_harian(30)  →  30 baris: tanggal | produk_masuk | produk_keluar | bahan_masuk_rp | bahan_keluar_rp
```

- Satu bulan bisa berisi **>1.600 mutasi**, padahal PostgREST (API Supabase) memotong hasil di **1.000 baris**. Kalau dijumlahkan di aplikasi, angkanya diam-diam kurang.
- Postgres menjumlahkan semuanya dan hanya mengirim 30 baris.
- `generate_series` memastikan hari tanpa transaksi tetap muncul sebagai 0, jadi sumbu tanggal tidak bolong.
- Tanggal dihitung dalam **WIB** (`waktu at time zone 'Asia/Jakarta'`). Mutasi pukul 00.51 WIB tanggal 21 masuk ke tanggal 21, bukan tanggal 20 (yang berlaku kalau memakai UTC).
- Fungsinya `SECURITY INVOKER` (bawaan), artinya berjalan dengan hak pengguna yang login, sehingga RLS tetap berlaku. Fungsi ini hanya membaca.
- Tes DB #20 memastikan total grafik = total buku besar.

## 3. Kenapa SVG buatan sendiri, bukan pustaka grafik?

| | SVG sendiri (dipilih) | Recharts / Chart.js |
|---|---|---|
| JavaScript ke browser | 0 KB (Server Component) | ±100 KB+ |
| Tampil | langsung bersama HTML | setelah hidrasi |
| Tooltip | `<title>` bawaan browser (sederhana) | interaktif, beranimasi |
| Kode | ±180 baris, bisa dibaca | API pustaka |

Hanya dua jenis grafik yang dibutuhkan (batang berkelompok dan garis tangga), jadi SVG sendiri lebih ringan. Kalau nanti butuh zoom atau grafik interaktif, baru pertimbangkan pustaka.

**Skala sumbu Y** (`skalaRapi` di `lib/grafik.ts`): nilai tertinggi dibulatkan ke atas memakai deret langkah 1–2–2,5–5 × 10ⁿ, sehingga label selalu "rapi" (0, 50, 100 …, bukan 0, 47, 94 …). Contoh: max 237 → langkah 50 → sumbu 0–250. Ada unit test, termasuk jebakan float `0,1 + 0,2`.

## 4. Halaman Mutasi stok

- Semua filter disimpan di URL (`?barang=p-2&sumber=po&dari=…&sampai=…&hal=…`), jadi bisa di-bookmark dan tetap jalan tanpa JavaScript.
- `barang=b-3` berarti bahan baku id 3, `p-2` berarti produk id 2 (satu dropdown untuk dua tabel).
- Rentang bawaan: 30 hari terakhir. Kalau "dari" > "sampai", keduanya ditukar.
- **Grafik riwayat stok** muncul kalau satu barang dipilih dan jenis = semua:
  - Bentuknya **tangga**, karena stok berubah seketika per kejadian, tidak bergerak mulus.
  - Titik awal = `stok_setelah` dari mutasi terakhir **sebelum** rentang; titik akhir = stok sekarang. Jadi garis mencakup seluruh rentang.
  - Kalau rentang berisi >1.000 mutasi, yang diambil adalah 1.000 **terbaru** (ditandai peringatan).
  - Garis putus-putus kuning = reorder point (bahan) atau stok minimum (produk).
- Keterangan tiap baris adalah tautan ke dokumen asalnya (PO / produksi / pesanan) lewat `ref_id`.

## 5. Jebakan yang ditemui

1. **`?hal=` melebihi jumlah halaman → error PGRST103.** Contohnya sedang di halaman 5 lalu filter dipersempit. Ini bug lama yang juga ada di daftar PO, produksi, dan pesanan. Perbaikannya, `kembaliKeHalaman1()` mengarahkan ke halaman 1 dengan filter yang sama.
2. **Halaman melebar di ponsel.** Item `grid` punya `min-width: auto`, sehingga tidak bisa lebih sempit dari isinya walau tabel dibungkus `overflow-x-auto`. Perbaikannya `[&>*]:min-w-0` pada grid.
3. **`.tabel` lebar minimum 640 px.** Cocok untuk halaman daftar, tetapi kartu setengah layar di dashboard jadi tergulung. Dashboard memakai `tabel min-w-0`.
4. **TypeScript "excessively deep".** Tipe query builder Supabase terlalu dalam untuk fungsi generik, jadi tipenya dipersempit ke metode yang dipakai saja.

## 6. "Kalau aku mau mengubah X, sentuh berkas mana?"

| Mau mengubah | Berkas |
|---|---|
| rentang grafik dashboard (30 hari) | `HARI_GRAFIK` di `(app)/page.tsx` |
| warna grafik | properti `warna` di `seri={…}` (`page.tsx`) |
| jenis mutasi yang dihitung di grafik | `ms.sumber in (...)` di fungsi `mutasi_harian` → lewat **migrasi baru** |
| jumlah baris per halaman mutasi | `PER_HALAMAN` di `mutasi-stok/page.tsx` |
| label jenis mutasi | `SUMBER` di `mutasi-stok/page.tsx` |
