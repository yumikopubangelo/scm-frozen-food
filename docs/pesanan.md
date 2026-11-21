# Pesanan reseller & pengiriman — penjelasan untuk pemilik proyek

> Berkas: `src/app/(app)/pesanan/` (`page.tsx`, `baru/`, `[id]/`, `form-pesanan.tsx`, `editor-item-pesanan.tsx`, `actions.ts`), `src/lib/hitung-pesanan.ts`, fungsi database di `supabase/migrations/0002_fungsi_stok.sql`.

## 1. Alur bisnis

```
        buat_pesanan()          kirim_pesanan()               terima_pesanan()
 (form) ─────────────▶ DIPROSES ───────────────▶ DIKIRIM ─────────────────▶ DITERIMA
                         │  isi masih bisa         │  stok produk −= qty       stok tidak berubah
                         │  diubah, stok tetap     │  (mutasi_stok "pesanan")
                         └── batalkan_pesanan() ──▶ DIBATALKAN  (hanya sebelum dikirim)
```

| Status | Artinya | Yang bisa dilakukan admin |
|---|---|---|
| Diproses | pesanan masuk, barang masih di gudang | ubah item/jumlah/harga, kirim (kalau stok cukup), batalkan |
| Dikirim | barang sudah keluar gudang barang jadi | konfirmasi diterima |
| Diterima | reseller sudah menerima | – (final) |
| Dibatalkan | tidak jadi, stok tidak pernah berubah | – (final) |

## 2. Skenario utama: kirim → stok turun

1. Admin membuat pesanan (mis. Teh Neng: Dimsum Ayam 15 pak + Siomay 10 pak). Status **Diproses**, stok belum berubah.
2. Halaman detail menampilkan **Cek stok sebelum kirim**: stok sekarang, stok setelah kirim, dan label Cukup / Kurang.
3. Kalau ada yang kurang, tombol kirim tidak muncul. Sebagai gantinya ada peringatan dengan link ke **Catat produksi** untuk produk yang kurang.
4. Kalau semua cukup, admin klik **Kirim pesanan (stok berkurang)**. Fungsi `kirim_pesanan` dalam satu transaksi:
   - mengunci baris pesanan (`for update`) supaya klik ganda tidak mengurangi stok dua kali;
   - memeriksa SEMUA produk (`stok < qty` → ditolak dengan daftar produk yang kurang);
   - menulis satu baris `mutasi_stok` per produk (qty negatif, sumber `pesanan`) yang mengurangi stok;
   - mengubah status menjadi **Dikirim** dan mengisi tanggal kirim.
5. Halaman detail lalu menampilkan **Keluar dari gudang barang jadi**: −qty → stok baru, diambil dari buku besar.
6. Setelah reseller konfirmasi, admin klik **Konfirmasi diterima reseller**. Stok tidak berubah lagi.

Stok pas (stok = jumlah pesanan) boleh dikirim; stok menjadi 0.

## 3. Kenapa stok turun saat dikirim, bukan saat pesanan dibuat?

Karena saat itulah barang benar-benar keluar dari gudang. Pesanan yang masih diproses dihitung sebagai *kebutuhan* (dipakai agen restock M8). Pesanan boleh disimpan walau stok belum cukup; yang dicegah hanya MENGIRIM tanpa stok.

## 4. Pengaman

- **Pratinjau di layar = aturan database.** `cekKirim()` di `lib/hitung-pesanan.ts` memakai aturan yang sama dengan `kirim_pesanan` (`stok >= qty`). Kalau tampilan entah bagaimana salah, database tetap menolak.
- **Isi pesanan terkunci setelah dikirim** oleh trigger `_jaga_item_pesanan`.
- **Status tidak bisa diubah langsung**: role aplikasi hanya punya hak `update (catatan)` di tabel `pesanan`.

## 5. Pengujian

- Unit test `src/lib/hitung-pesanan.test.ts`: kirim 5 dari stok 20 → 15, stok pas → 0, satu produk kurang → seluruh pesanan tidak bisa dikirim, total pesanan.
- Tes skenario DB bagian **4b** (`scripts/tes-skenario.sql`): pesanan 2 produk, ubah jumlah saat diproses, kirim → stok 40 → 25 dan 10 → 0, 2 mutasi keluar, kirim ganda ditolak, item terkunci, status tidak bisa diubah langsung, batal setelah dikirim ditolak.
