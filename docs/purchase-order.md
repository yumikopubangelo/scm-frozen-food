# Purchase Order (PO) — penjelasan untuk pemilik proyek

> Berkas: `src/app/(app)/purchase-order/` (`page.tsx`, `baru/`, `[id]/`, `form-po.tsx`, `editor-item-po.tsx`, `actions.ts`), fungsi database di `supabase/migrations/0002_fungsi_stok.sql`.

## 1. Alur bisnis

```
          buat_po()            kirim_po()              terima_po()
 (form) ───────────▶ DRAFT ───────────────▶ DIKIRIM ───────────────▶ DITERIMA
                       │   isi masih bisa      │   isi terkunci            stok bahan += qty
                       │   diubah              │   (trigger DB)            (mutasi_stok sumber "po")
                       └──── batalkan_po() ────┴──▶ DIBATALKAN  (stok tidak berubah)
```

| Status | Artinya di dunia nyata | Yang bisa dilakukan admin |
|---|---|---|
| Draft | rencana pembelian, belum dipesan | ubah item/jumlah/harga, kirim, batalkan |
| Dikirim | sudah dipesan ke supplier (telepon/WA) | terima barang, batalkan |
| Diterima | barang sudah masuk gudang bahan baku | – (final) |
| Dibatalkan | tidak jadi | – (final) |

**"Kirim ke supplier" = persetujuan admin.** Draft PO buatan agen restock (M8) memakai alur yang sama. Agen hanya bisa membuat *draft*, dan tombol "Setujui & kirim ke supplier" hanya ditekan oleh admin.

## 2. Kenapa setiap perubahan status lewat fungsi database?

Server Action hanya memanggil `supabase.rpc("terima_po", { p_po_id })`. Tidak ada `update purchase_order set status = ...` di kode aplikasi, dan role aplikasi memang **tidak punya hak** melakukannya (lihat `0003_hak_akses.sql`). Keuntungannya:

1. **Atomik.** Menerima PO dengan 3 bahan berarti 3 penambahan stok, 3 baris mutasi, dan 1 perubahan status, semuanya dalam satu transaksi. Kalau satu langkah gagal, semuanya batal.
2. **Tidak bisa diterima dua kali.** `terima_po` mengunci baris PO (`for update`) lalu memeriksa statusnya. Klik ganda yang cepat tidak membuat stok bertambah dua kali (diuji di `tes-skenario.sql`).
3. **Isi PO terkunci setelah dikirim.** Trigger `_jaga_item_po` menolak perubahan item kalau status bukan draft, walaupun ada bug di tampilan.

## 3. Form PO baru: baris dinamis

`form-po.tsx` menyimpan baris bahan di **state React** (tambah/hapus baris tanpa memuat ulang halaman), lalu mengirim semuanya sebagai satu kolom tersembunyi `items` berisi JSON:

```json
[{"bahan_id": 11, "qty": 2, "harga_satuan": 42000}, {"bahan_id": 10, "qty": 1, "harga_satuan": 38000}]
```

Di server, `actions.ts` mem-parse JSON itu dengan zod (`z.string().transform(JSON.parse).pipe(z.array(skemaItem).min(1))`), menolak bahan yang dipilih dua kali, lalu memanggil `buat_po`, yang membuat header + item dalam satu transaksi.

Kemudahan:
- memilih supplier memindahkan bahan yang dipasok supplier itu ke **grup paling atas** dropdown;
- memilih bahan **mengisi harga otomatis** dari master dan menampilkan stok + reorder point (kuning kalau di bawah ROP);
- subtotal dan total dihitung langsung;
- link `/purchase-order/baru?supplier=5` langsung memilih supplier.

**Jebakan React 19.** Form dengan `action={...}` otomatis di-*reset* setelah action selesai. Baris dinamis yang disimpan di state bisa hilang tampilannya kalau server menolak (misalnya supplier belum dipilih). Solusinya, form ini memakai `onSubmit` + `startTransition(() => formAction(fd))`, yang tidak memicu reset otomatis.

## 4. Perkiraan tiba & keterlambatan

```
perkiraan tiba = tanggal_dikirim + lead_time_hari supplier
terlambat (hari) = hari_ini(WIB) − perkiraan tiba        (kalau > 0 dan status masih "dikirim")
```

Contoh nyata dari data: PO ke UD Hasil Laut Pangandaran dikirim 18 Nov dengan lead time 2 hari, jadi perkiraan tiba 20 Nov. Hari ini 21 Nov, sehingga tampil **"Terlambat 1 hari"** (merah). Tanggal dihitung dalam zona **WIB** (`hariIni()` di `lib/format.ts`), sama dengan fungsi `public.hari_ini()` di database. Kalau memakai jam UTC, antara pukul 00.00–07.00 WIB tanggalnya akan mundur sehari.

## 5. Daftar PO

- **Tab status** dengan jumlah per status (query `head: true`, yang hanya menghitung tanpa mengambil data).
- **Filter** nomor PO dan supplier; semua filter tersimpan di URL, jadi bisa di-bookmark.
- **Paginasi** 25 per halaman memakai `.range(dari, sampai)` + `count: "exact"`. Ada ±790 PO. Tanpa paginasi, halaman akan berat, dan PostgREST hanya mengirim maksimal 1.000 baris per request, sehingga data lama akan hilang diam-diam.
- Badge **agen** untuk PO buatan agen restock, dengan keterangan "Menunggu persetujuan".

## 6. Pesan WhatsApp ke supplier

UMKM biasanya memesan lewat WA. Tombol "Kirim pesan WhatsApp" membuka `https://wa.me/<nomor>?text=<pesan>` berisi daftar bahan PO. Nomor `0857-2004-1104` diubah menjadi `6285720041104` oleh `nomorWa()`. Pesan **tidak terkirim otomatis**: aplikasi WA admin terbuka dan admin sendiri yang menekan kirim.

## 7. Jebakan yang ditemui

1. **Banner lama tetap tampil.** Setelah PO dibuat (`?ok=ditambah`) lalu dikirim/diterima, banner "Data berhasil ditambahkan" masih terlihat. Solusinya, action status melakukan redirect dengan `?ok=po-dikirim|po-diterima|po-dibatalkan` sehingga banner menyebut aksi terakhir.
2. **Scrollbar kecil di tab status.** Garis bawah tab (`-mb-px`) menimpa 1 px container `overflow-x-auto`, sehingga muncul scroll vertikal. Solusinya, tambah `overflow-y-hidden`.
3. **Nomor id melompat (792 → 796).** Tes skenario DB yang di-rollback tetap memakai nomor urut (sequence). Ini perilaku normal Postgres: sequence tidak ikut di-rollback supaya transaksi paralel tidak saling menunggu.
4. **Save pertama terasa lama (±6 detik).** Dev server meng-compile halaman detail saat pertama dibuka. Di produksi halaman sudah ter-compile.

## 8. "Kalau aku mau mengubah X, sentuh berkas mana?"

| Mau mengubah | Berkas |
|---|---|
| teks pesan WhatsApp | `teksWa` di `purchase-order/[id]/page.tsx` |
| jumlah baris per halaman | `PER_HALAMAN` di `purchase-order/page.tsx` |
| label/warna status | `STATUS_PO` di `src/lib/status.ts` |
| aturan perubahan status (mis. boleh batal setelah diterima) | fungsi `batalkan_po` di migrasi baru (bukan di kode aplikasi) |
| teks banner sukses | `PESAN_OK` di `src/components/ui.tsx` |
