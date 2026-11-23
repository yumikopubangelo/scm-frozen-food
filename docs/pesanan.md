# Pesanan Reseller & Pengiriman — penjelasan untuk pemilik proyek

> Berkas: `src/app/(app)/pesanan/` (`page.tsx`, `baru/`, `[id]/`, `form-pesanan.tsx`, `editor-item-pesanan.tsx`, `actions.ts`), fungsi database `buat_pesanan`, `kirim_pesanan`, `terima_pesanan`, `batalkan_pesanan` di `0002_fungsi_stok.sql`.

## 1. Alur

```
             buat_pesanan()          kirim_pesanan()               terima_pesanan()
 (form) ───────────────▶ DIPROSES ───────────────────▶ DIKIRIM ───────────────────▶ DITERIMA
                           │  isi bisa diubah            stok produk −= qty           (stok tidak berubah lagi)
                           │  stok BELUM berubah         (mutasi_stok sumber "pesanan")
                           └── batalkan_pesanan() ──▶ DIBATALKAN   (hanya sebelum dikirim)
```

**Kenapa stok berkurang saat dikirim, bukan saat pesanan dicatat?**
- Pesanan adalah *permintaan*. Barang baru benar-benar keluar dari gudang barang jadi saat dikirim.
- Pesanan yang masih diproses dihitung sebagai **kebutuhan** oleh agen restock (M8): kebutuhan produk = Σ pesanan diproses − stok.
- Memesan melebihi stok **diperbolehkan** (form hanya memberi peringatan kuning). Yang dicegah adalah **mengirim** tanpa stok.

**Pesanan yang sudah dikirim tidak bisa dibatalkan.** Barangnya sudah keluar gudang. Retur memerlukan alur tersendiri (di luar MVP), misalnya stok opname.

## 2. Pemeriksaan "siap kirim"

Di daftar pesanan, setiap pesanan berstatus *diproses* diberi tanda:

```
Siap kirim  ⟺  untuk SETIAP produk di pesanan: stok produk ≥ jumlah dipesan
```

Pemeriksaan ini **per pesanan**, bukan gabungan. Kalau dua pesanan sama-sama butuh 30 pak Cireng dan stok 40, keduanya tampil "siap kirim", tapi hanya yang dikirim pertama yang berhasil. Untuk UMKM kecil cara ini cukup jelas. Alokasi stok antarpesanan bisa jadi pengembangan berikutnya.

Di halaman detail, produk yang kurang ditandai merah, disertai kalimat "Belum bisa dikirim: …" dan tautan **Catat produksi** untuk produk tersebut.

Tombol "Kirim" sengaja **tidak dinonaktifkan**. Tampilan bisa saja basi (stok berubah setelah halaman dibuka), sedangkan **database-lah penjaga yang sebenarnya**. Saat diuji, database menolak dengan pesan *"Stok produk tidak cukup untuk dikirim: Lumpia Udang isi 8 (pesan 2, stok 0)"* dan pesanan tetap berstatus diproses.

## 3. Form & edit pesanan

- Pola sama dengan PO: baris dinamis di state React → JSON → `buat_pesanan` (satu transaksi), `onSubmit` + `startTransition` supaya baris tidak hilang kalau server menolak.
- Harga terisi otomatis dari **harga jual** produk dan boleh diubah, misalnya untuk harga khusus reseller.
- Selama *diproses*, isi pesanan bisa diubah (jumlah/harga/tambah/hapus produk). Setelah dikirim, trigger database `_jaga_item_pesanan` menolak perubahan.
- Dari halaman reseller ada tombol **Catat pesanan** (reseller langsung terpilih) dan **Riwayat pesanan** (daftar terfilter).

## 4. WhatsApp ke reseller

Tombol "Kabari reseller via WhatsApp" membuka `wa.me` dengan pesan berisi daftar produk dan total. Isi pesan menyesuaikan status: *sedang disiapkan* saat diproses, *sudah kami kirim* saat dikirim. Pesan tidak terkirim otomatis.

## 5. Jebakan yang ditemui

1. **Halaman tidak terhidrasi di tab latar.** Saat agent menguji di tab browser di belakang, form tidak bereaksi: harga tidak terisi dan label tidak berubah. Pemeriksaan menunjukkan elemen form belum punya properti React (`__reactFiber…`), sedangkan sidebar sudah. Penyebabnya, Chrome menunda pekerjaan *hydration* di tab yang tidak tampil, dan konten di dalam batas `loading.tsx` dihidrasi belakangan. Begitu tab ditampilkan, form langsung hidup. Ini **bukan bug aplikasi**, karena pengguna sungguhan selalu melihat tabnya. Agent sekarang menunggu hidrasi selesai sebelum berinteraksi.
2. **Screenshot memuat email admin.** Satu screenshot diambil penuh sehingga footer sidebar (email) ikut. Area itu ditutup dengan Pillow sebelum masuk repo.

## 6. "Kalau aku mau mengubah X, sentuh berkas mana?"

| Mau mengubah | Berkas |
|---|---|
| aturan "siap kirim" | `siap` di `pesanan/page.tsx` |
| teks WhatsApp ke reseller | `teksWa` di `pesanan/[id]/page.tsx` |
| boleh batal setelah dikirim (retur) | fungsi `batalkan_pesanan` + stok kembali, lewat **migrasi baru** |
| harga default pesanan | `pilihProduk` di `form-pesanan.tsx` (sekarang: harga jual) |
