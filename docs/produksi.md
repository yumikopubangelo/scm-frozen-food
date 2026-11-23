# Produksi — penjelasan untuk pemilik proyek

> Berkas: `src/app/(app)/produksi/` (`page.tsx`, `baru/`, `[id]/`, `form-produksi.tsx`, `actions.ts`), `src/lib/hitung-produk.ts`, fungsi database `catat_produksi` di `supabase/migrations/0002_fungsi_stok.sql`.

## 1. Apa yang terjadi saat produksi dicatat

Contoh: produksi 20 pak Cireng Isi Ayam Pedas. Resepnya per pak: tapioka 0,25 kg, ayam 0,06 kg, bawang putih 0,005 kg, daun bawang 0,01 kg, bumbu 0,005 kg, plastik 1 pcs.

```
GUDANG BAHAN BAKU                         GUDANG BARANG JADI
tapioka      − 0,25 × 20 = − 5 kg    ┐
ayam         − 0,06 × 20 = − 1,2 kg  │
bawang putih − 0,005 × 20 = − 0,1 kg ├──▶  Cireng  + 20 pak
daun bawang  − 0,01 × 20 = − 0,2 kg  │
bumbu        − 0,005 × 20 = − 0,1 kg │
plastik      − 1 × 20 = − 20 pcs     ┘
```

Semua langkah itu dikerjakan **satu fungsi database** (`catat_produksi`) dalam **satu transaksi**:
1. cek BOM tidak kosong;
2. cek **semua** bahan cukup. Kalau ada yang kurang, tolak dan sebut *semua* bahan yang kurang sekaligus;
3. buat baris `produksi` dengan nomor `PRD-YYMMDD-0001`;
4. kurangi setiap bahan (6 baris mutasi "keluar") dan tambah stok produk (1 baris mutasi "masuk").

Kalau langkah 4 gagal di tengah jalan, misalnya ada yang mengubah stok bersamaan, semua langkah batal. Stok tidak pernah setengah berkurang.

## 2. Form produksi dengan pratinjau

`form-produksi.tsx` menghitung **sebelum** disimpan, memakai data BOM yang sudah dimuat:

| Ditampilkan | Rumus |
|---|---|
| Bisa diproduksi maks. | `min over bahan ⌊stok ÷ qty_per_unit⌋` (tombol "Maks" mengisinya) |
| Dipakai per bahan | `qty_per_unit × jumlah`, dibulatkan 2 desimal **seperti di database** |
| Sisa setelah produksi | `stok − dipakai` |
| Kurang | `max(0, dipakai − stok)`, baris merah |

Kalau ada bahan yang kurang, tombol "Catat produksi" **nonaktif** dan muncul tautan ke pembuatan PO. Database tetap menjadi pengaman terakhir: walaupun tombol entah bagaimana tetap terklik, `catat_produksi` menolak.

**Tanggal produksi** boleh tanggal lampau (misalnya baru dicatat besok pagi), tapi tidak boleh masa depan. Ini divalidasi di server dengan zod dan memakai tanggal WIB.

## 3. Galat pecahan biner (bug yang ditemukan di M5)

Komputer menyimpan angka desimal dalam bentuk biner, sehingga sebagian pecahan tidak tepat:

```js
0.3 / 0.1   // 2.9999999999999996  (bukan 3)
0.7 / 0.1   // 6.999999999999999   (bukan 7)
Math.floor(0.3 / 0.1)  // 2  ← SALAH, seharusnya 3
```

Rumus kapasitas produksi di M3 memakai `Math.floor(stok / qty_per_unit)`, jadi kadang kurang 1 pak. Pemindaian kombinasi stok × resep yang realistis menemukan **526 kasus** seperti ini. **Perbaikan:** `bagiBulatBawah(a, b) = Math.floor(a / b + 1e-9)`. Toleransi 0,000000001 jauh lebih kecil dari ketelitian stok (0,01), jadi tidak pernah membulatkan ke atas secara keliru. Ada unit test untuk kasus 0,3/0,1 dan 0,7/0,1.

Hal yang sama berlaku untuk pembulatan: `bulat2(x) = Math.round(x × 100 + ε) / 100`, sehingga 7 × 0,005 = 0,035 dibulatkan menjadi **0,04**, sama persis dengan `round(0.035, 2)` di Postgres.

## 4. Daftar & detail

- **Daftar produksi:** ringkasan **hasil 30 hari terakhir per produk** (batang horizontal), filter produk, dan paginasi 25 per halaman (±1.630 batch).
- **Detail batch:** hasil (+qty, stok produk sesudahnya), daftar bahan yang keluar dari gudang, **perkiraan biaya bahan** dan nilai jual hasil.
  - *Catatan jujur:* biaya memakai harga bahan **saat ini**, karena harga pada tanggal produksi tidak disimpan. Untuk akuntansi sungguhan, harga per mutasi perlu dicatat. Ini disebut juga di halaman.
- Dari halaman produk ada tombol **"Catat produksi"** yang langsung memilih produk itu.

## 5. Halaman error vs 404

Saat M5 dikerjakan, Supabase sempat mengalami gangguan: API gateway membalas **HTTP 555** setelah 10 detik, sementara database-nya sendiri sehat. Halaman detail lalu menampilkan **"404 tidak ditemukan"**, karena error query diabaikan dan data `null` dianggap "tidak ada". Ini menyesatkan.

**Perbaikan:** `cekGalatMuat(...)` di `lib/galat-db.ts` dipasang di keenam halaman detail. Kalau query gagal, yang tampil adalah halaman error ("Terjadi kesalahan saat memuat halaman" + tombol coba lagi), bukan 404.

## 6. "Kalau aku mau mengubah X, sentuh berkas mana?"

| Mau mengubah | Berkas |
|---|---|
| rumus pratinjau / kapasitas | `src/lib/hitung-produk.ts` (+ tesnya di `hitung-produk.test.ts`) |
| larangan tanggal masa depan | skema zod di `produksi/actions.ts` |
| aturan stok saat produksi | fungsi `catat_produksi` lewat **migrasi baru** |
| rentang ringkasan (30 hari) | `dari30` di `produksi/page.tsx` |
