# Agen Restock — penjelasan untuk pemilik proyek

> Berkas: `src/lib/agen-restock.ts` (otak agen, fungsi murni + 11 unit test), `src/app/(app)/agen-restock/` (`page.tsx`, `data.ts`, `actions.ts`), fungsi database `rata_permintaan_harian` & `simpan_hasil_agen` di `supabase/migrations/0006_agen_restock.sql`.

## 1. Agen ini apa (dan bukan apa)

Agen restock adalah **agen berbasis aturan** (*rule-based agent*). Siklusnya sama dengan agen pada umumnya:

```
 AMATI ──────────────▶ PUTUSKAN ───────────────▶ BERTINDAK ─────────────▶ MANUSIA MENYETUJUI
 stok, pesanan,         rumus di §2,                buat DRAFT PO             admin buka draft, ubah
 PO berjalan,           per bahan, dengan            per supplier +           bila perlu, lalu
 permintaan harian      alasan tertulis              catat agen_log           "Setujui & kirim"
```

- **Tidak memakai LLM.** Setiap keputusan bisa ditelusuri ke rumus dan alasannya ditampilkan. Untuk urusan uang (pembelian), sifat yang bisa diaudit ini lebih penting daripada "kecerdasan".
- **Tidak pernah mengirim apa pun ke supplier.** Batasnya ada di database: agen hanya bisa membuat PO berstatus `draft` (`buat_po`). Untuk mengirim, admin harus menekan tombol di halaman PO (`kirim_po`). Ini prinsip *human-in-the-loop*.
- "Agentic AI" di judul UAS merujuk ke **cara aplikasi ini dibangun** (oleh agent AI, didokumentasikan di `PROSES.md`). Agen restock adalah fitur *di dalam* aplikasi.

## 2. Rumus

Untuk setiap produk *p* dan bahan *b*:

| Langkah | Rumus | Arti |
|---|---|---|
| 1 | `kurang_p = max(0, Σ pesanan diproses_p − stok_p)` | pak yang belum bisa dikirim ke reseller |
| 2 | `butuhPesanan_b = Σ_p kurang_p × bom(p,b)` | bahan untuk memproduksi kekurangan itu (diturunkan lewat resep, gaya MRP) |
| 3 | `butuhRamalan_b = Σ_p permintaanHarian_p × leadTime_b × bom(p,b)` | bahan yang akan terpakai selama menunggu barang datang dari supplier |
| 4 | `kebutuhan_b = max(butuhPesanan_b, butuhRamalan_b)` | **maks, bukan jumlah**: pesanan yang sudah masuk adalah bagian dari permintaan yang diramalkan, jadi menjumlahkannya berarti menghitung dua kali |
| 5 | `proyeksi_b = stok_b + dalamPO_b − kebutuhan_b` | perkiraan stok setelah kebutuhan terpenuhi, dengan PO yang sedang berjalan ikut dihitung |
| 6 | pesan bila `proyeksi_b < reorderPoint_b` | aturan reorder point klasik |
| 7 | `qty_b = ⌈kebutuhan_b + ROP_b − stok_b − dalamPO_b⌉` | isi sampai stok aman (ROP) **setelah** kebutuhan terpenuhi (*order-up-to*) |

- **Pembulatan:** kg/liter/butir ke atas ke bilangan bulat; `lembar` per 100 dan `pcs` per 50 (dibeli per bal/pak). Ini sama dengan aturan ROP di `seed.sql`. Pembulatan memakai toleransi 1e-9, sehingga `3,0000000000000004` tetap 3, bukan 4.
- **Pengelompokan:** satu draft PO per **supplier utama** bahan (`bahan_baku.supplier_id`). Bahan tanpa supplier ditandai merah dan tidak dibuatkan PO.
- **Tidak memesan dobel:** `dalamPO` mencakup PO *draft* dan *dikirim*. Menjalankan agen dua kali berturut-turut → yang kedua tidak mengusulkan apa-apa (sudah diuji).

### Contoh nyata (data 24 Nov 2026)
**Telur ayam:** stok 0, ROP 5 kg, supplier lead time 1 hari.
- Permintaan harian produk ber-telur (rata-rata 28 hari) × 1 hari × resep = **1,88 kg** (lebih besar dari kebutuhan pesanan).
- Proyeksi = 0 + 0 − 1,88 = −1,88 < 5, jadi pesan ⌈1,88 + 5 − 0 − 0⌉ = **7 kg** (Rp 196.000).

**Udang kupas:** stok 0,6, ROP 3, tetapi **sudah ada PO 7 kg** yang dikirim. Proyeksi = 0,6 + 7 − kebutuhan ≥ 3, jadi **aman**, tidak dipesan lagi.

## 3. Permintaan harian (ramalan)

`rata_permintaan_harian(28)` di database:
- **Bawaan, rata-rata bergerak:** total pak *dikirim* selama **28 hari penuh** terakhir ÷ 28. Hari ini tidak dihitung karena belum selesai; kalau ikut dihitung, angkanya terlalu rendah di pagi hari.
- **Kalau ada ramalan S4** (M8b, opsional): baris `forecast_permintaan` bersumber `s4` untuk 14 hari ke depan dipakai sebagai gantinya, per produk. Halaman agen menampilkan badge "ramalan S4". Aplikasi tetap jalan normal tanpa S4.
- Dihitung di Postgres karena 28 hari mutasi bisa lebih dari 1.000 baris (batas PostgREST).

## 4. Pengaman

| Risiko | Pengaman |
|---|---|
| Data dari browser dimanipulasi | Server **menghitung ulang** rencana; yang dikirim browser hanya *sidik* (`supplier:bahan=qty;…`) untuk dibandingkan |
| Data berubah antara pratinjau dan klik (stok diterima, PO dibuat orang lain) | Sidik hasil hitung ulang ≠ sidik pratinjau → ditolak: *"Data … berubah sejak pratinjau ditampilkan. Muat ulang…"*. Diuji di browser dengan membuat PO manual saat pratinjau terbuka |
| Klik ganda / dua admin bersamaan | `simpan_hasil_agen` memakai `pg_advisory_xact_lock`, lalu menolak kalau ada `agen_log` yang selesai **setelah** pratinjau dihitung. Diuji di tes DB |
| Sebagian PO gagal dibuat | Semua draft + log dibuat dalam **satu transaksi**: berhasil semua atau tidak sama sekali |
| Admin menulis log palsu | `authenticated` hanya boleh SELECT `agen_log`; menulis hanya lewat fungsi (`SECURITY DEFINER`). Diuji |

## 5. Jejak audit (`agen_log`)

Setiap kali agen membuat draft, tabel `agen_log` menyimpan: waktu, jumlah PO, total biaya, sumber ramalan, produk yang kurang, dan **untuk setiap bahan yang dipesan: angka-angka + kalimat alasannya**, ditambah nomor PO yang dibuat. Riwayat 10 terakhir tampil di bawah halaman agen.

## 6. Keterbatasan (jujur)

1. **Rata-rata bergerak tidak tahu musim.** Menjelang Lebaran permintaan naik berlipat, dan rata-rata 28 hari terlambat menangkapnya. Inilah celah yang bisa diisi S4 (M8b), dengan syarat terbukti lebih akurat (MAE ≥10% lebih baik).
2. **Kapasitas produksi tidak dimodelkan.** Agen menganggap bahan yang datang bisa langsung diproduksi.
3. **Satu supplier per bahan.** Tidak membandingkan harga antarsupplier.
4. **Harga di draft = harga master saat ini.** Admin bisa mengubahnya di draft sebelum dikirim.

## 7. "Kalau aku mau mengubah X, sentuh berkas mana?"

| Mau mengubah | Berkas |
|---|---|
| rumus keputusan / kalimat alasan | `hitungRencana` di `lib/agen-restock.ts` (+ perbarui test) |
| kelipatan pembelian per satuan | `kelipatanSatuan` di `lib/agen-restock.ts` |
| jendela rata-rata (28 hari) | `HARI_RATA_RATA` di `agen-restock/data.ts` |
| data yang diamati agen | `muatRencana` di `agen-restock/data.ts` |
| isi catatan draft PO / isi log | fungsi `simpan_hasil_agen` → **migrasi baru** |
