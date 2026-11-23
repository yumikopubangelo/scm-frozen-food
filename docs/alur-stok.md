# Alur Stok & Database — penjelasan untuk pemilik proyek

> Bacalah sambil membuka berkasnya: `supabase/migrations/0001_skema.sql`, `0002_fungsi_stok.sql`, `0003_hak_akses.sql`, dan `supabase/seed.sql`.
> Target akhir dokumen ini: kamu bisa menjawab **"kalau aku mau mengubah X, aku menyentuh berkas mana?"** dan bisa menjelaskan desainnya ke dosen.

---

## 1. Gambaran besar

```
 supplier ──(PO diterima)──▶ GUDANG BAHAN BAKU ──(produksi, sesuai BOM)──▶ GUDANG BARANG JADI ──(pesanan dikirim)──▶ reseller
              + stok bahan      bahan_baku.stok        - bahan, + produk          produk.stok           - stok produk
```

Tidak ada tabel `gudang`. UMKM ini punya satu lokasi, jadi:
- **gudang bahan baku** = kolom `stok` di tabel `bahan_baku`
- **gudang barang jadi** = kolom `stok` di tabel `produk`

Setiap kali stok berubah, satu baris ditulis ke **`mutasi_stok`** (buku besar). Isinya: kapan, barang apa, berapa (+ masuk / − keluar), stok sesudahnya, dan dokumen sumbernya (PO / produksi / pesanan / penyesuaian).

**Kenapa stok disimpan dua kali (kolom `stok` + buku besar)?**
- Kolom `stok` membuat pertanyaan "stok sekarang berapa?" cepat dijawab, tanpa menjumlah ribuan baris.
- Buku besar membuat pertanyaan "kenapa stoknya segini?" bisa dijawab, dan grafik pergerakan stok di dashboard bisa digambar.
- Risikonya, keduanya bisa tidak sinkron. Karena itu stok **hanya boleh berubah lewat satu fungsi** (`_mutasi`) yang selalu mengubah keduanya bersamaan. Tes otomatis memeriksa bahwa untuk setiap barang, `stok = jumlah semua mutasinya`.

## 2. Tabel (ERD ringkas)

| Tabel | Isi | Relasi penting |
|---|---|---|
| `supplier` | pemasok + `lead_time_hari` (lama barang sampai) | — |
| `bahan_baku` | bahan + `stok`, `reorder_point`, `harga_satuan` | `supplier_id` → supplier utama |
| `produk` | produk jadi (pak) + `stok`, `stok_minimum`, `harga_jual` | — |
| `reseller` | reseller/toko + kota | — |
| `bom` | resep: 1 pak produk butuh `qty_per_unit` bahan | produk ↔ bahan (banyak-ke-banyak) |
| `purchase_order` + `po_item` | pembelian ke supplier | PO → supplier, item → bahan |
| `produksi` | 1 baris = 1 batch produksi 1 produk | → produk |
| `pesanan` + `pesanan_item` | pesanan reseller | pesanan → reseller, item → produk |
| `mutasi_stok` | buku besar stok | → bahan **atau** produk (tepat satu, dijaga `check`) |
| `forecast_permintaan` | ramalan permintaan per produk per tanggal (rata-rata / S4) | → produk |
| `agen_log` | riwayat setiap kali agen restock dijalankan | — |

Nomor dokumen dibuat otomatis oleh fungsi: `PO-261120-0001`, `PRD-261120-0001`, `PSN-261120-0001` (YYMMDD + nomor urut). Kode produk memakai `PJ-` (produk jadi) supaya tidak tertukar dengan nomor produksi `PRD-`.

## 3. Status & fungsi yang mengubahnya

```
Purchase Order:   draft ──kirim_po──▶ dikirim ──terima_po──▶ diterima      (stok bahan +qty)
                    └──────batalkan_po──────┴──▶ dibatalkan

Pesanan:          diproses ──kirim_pesanan──▶ dikirim ──terima_pesanan──▶ diterima
                    │                         (stok produk −qty)
                    └──batalkan_pesanan──▶ dibatalkan   (hanya sebelum dikirim)

Produksi:         catat_produksi(produk, qty):  setiap bahan −(qty_per_unit × qty),  produk +qty
```

| Fungsi | Yang dilakukan | Ditolak kalau |
|---|---|---|
| `buat_po(supplier, items, sumber, catatan, tanggal)` | buat PO draft + item | daftar kosong / bahan tak dikenal |
| `kirim_po(po)` | draft → dikirim (= **persetujuan admin**) | bukan draft / tanpa item |
| `terima_po(po)` | dikirim → diterima, **stok bahan bertambah** | bukan dikirim (termasuk terima dua kali) |
| `catat_produksi(produk, qty)` | bahan berkurang sesuai BOM, produk bertambah | belum ada BOM / **ada bahan kurang** (semua yang kurang disebut) |
| `buat_pesanan(reseller, items)` | buat pesanan diproses | daftar kosong / produk tak dikenal |
| `kirim_pesanan(pesanan)` | diproses → dikirim, **stok produk berkurang** | stok produk kurang |
| `terima_pesanan(pesanan)` | dikirim → diterima | bukan dikirim |
| `sesuaikan_stok(bahan/produk, stok_baru)` | stok opname: catat selisih sebagai `penyesuaian` | stok baru negatif |

**Kenapa stok produk berkurang saat *dikirim*, bukan saat pesanan dibuat?** Karena saat itulah barang benar-benar keluar dari gudang barang jadi. Pesanan yang masih diproses dihitung sebagai *kebutuhan*, dan agen restock memakainya untuk menghitung bahan yang perlu dibeli.

**Atomik (semua atau tidak sama sekali).** Setiap fungsi berjalan dalam satu transaksi. Contohnya, produksi dimsum memakai 8 bahan. Kalau bahan ke-8 ternyata kurang, potongan untuk 7 bahan sebelumnya ikut dibatalkan. Tes `produksi yang gagal tidak mengubah stok sama sekali` membuktikan ini.

**`for update` (kunci baris).** `terima_po` mengunci baris PO sebelum memeriksa statusnya. Kalau admin tidak sengaja menekan "Terima" dua kali dengan cepat, klik kedua menunggu klik pertama selesai, lalu ditolak karena statusnya sudah `diterima`. Tanpa kunci ini, stok bisa bertambah dua kali.

**Penjaga item.** Trigger `_jaga_item_po` / `_jaga_item_pesanan` menolak perubahan item kalau PO sudah tidak draft / pesanan sudah tidak diproses. Jadi isi PO yang sudah dikirim ke supplier tidak bisa diam-diam diubah.

## 4. Hak akses (keamanan)

Ada dua lapis pengaman (`0003_hak_akses.sql`):

1. **GRANT** menentukan *operasi* apa yang boleh dilakukan sebuah role.
   - `anon` (belum login): tidak boleh apa-apa.
   - `authenticated` (admin sudah login): boleh membaca semua tabel dan mengubah master data, **kecuali kolom `stok`**. Status dan nomor dokumen juga tidak bisa diubah langsung; semuanya wajib lewat fungsi.
2. **RLS (Row Level Security)** menentukan *baris* mana yang boleh. Aplikasi ini hanya punya 1 role admin, jadi kebijakannya "pengguna login boleh semua baris".

**Kenapa hak bawaan dicabut dulu?** Menurut dokumentasi Supabase, hak bawaan berbeda antar-project, tergantung tanggal dibuat dan setelan Data API, dan Supabase sedang mengubah bawaannya. Dengan mencabut semua lalu memberi ulang secara eksplisit, hasilnya sama di project mana pun.

**SECURITY DEFINER.** Fungsi stok berjalan dengan hak *pemilik tabel*, bukan hak pemanggil. Karena itulah fungsi bisa mengubah `stok` walaupun `authenticated` tidak punya hak itu, seperti kasir yang tidak memegang kunci brankas tapi bisa meminta manajer membukanya lewat prosedur resmi. Supaya aman, setiap fungsi memakai `set search_path = ''` dan menulis nama lengkap `public.xxx`. Tanpa itu, orang bisa membuat tabel palsu bernama sama di schema lain dan "membajak" fungsi yang berhak tinggi.

## 5. Rumus di data contoh (seed)

**Reorder point (ROP)** = titik ketika bahan harus dipesan ulang:

```
pemakaian harian bahan  d = Σ (qty_per_unit di BOM × permintaan dasar produk per hari)
ROP = d × (lead_time_supplier + 2)
```

`+2` adalah stok pengaman 2 hari, versi sederhana dari rumus buku teks `ROP = d·L + z·σ·√L`. Kita belum punya σ (simpangan permintaan) sebelum ada riwayat, jadi pengaman ditulis sebagai "cadangan beberapa hari". Contoh daging ayam: d ≈ 10,2 kg/hari dan lead time 1 hari, jadi ROP = 10,2 × 3 ≈ 31 kg.

Stok minimum produk = 2 hari permintaan dasar.

**Simulasi riwayat 12 bulan.** Seed tidak sekadar menyalin angka. Ia *menjalankan* usaha selama 365 hari dengan memanggil fungsi yang sama dengan aplikasi. Setiap hari urutannya:
1. PO yang sudah sampai (tanggal kirim + lead time) diterima
2. pesanan yang dikirim kemarin diterima reseller
3. pesanan kemarin dikirim (kalau stok cukup; kalau tidak, menunggu)
4. produksi mengisi stok sampai 3 hari permintaan + pesanan tertunda
5. reseller memesan (acak, dengan pola musiman)
6. bahan di bawah ROP dibelikan, 1 PO per supplier, qty = 2,5 × ROP − stok − yang sedang dikirim

Faktor permintaan (1,0 = normal), ditulis di fungsi `pg_temp.faktor`:

| Kejadian | Faktor | Alasan |
|---|---|---|
| Jumat / Sabtu / Minggu | 1,15 / 1,25 / 0,85 | toko belanja stok menjelang akhir pekan |
| Tanggal 25 s.d. 3 | ×1,15 | gajian |
| 20 Des – 2 Jan | ×1,25 | libur akhir tahun |
| Ramadan 18 Feb – 12 Mar 2026 | ×1,45 | takjil & sahur |
| 13 – 18 Mar 2026 | ×1,90 | borong menjelang Lebaran |
| 19 – 26 Mar 2026 | ×0,45 | Lebaran: toko tutup, mudik |
| sekitar Iduladha (25 – 31 Mei) | ×0,80 | daging kurban melimpah |
| libur sekolah, 17 Agustus | ×1,15, ×1,20 | |
| tren | +20%/tahun | usaha tumbuh |

Tanggal Ramadan/Lebaran adalah perkiraan. **Semua pola ini asumsi, bukan data penjualan sungguhan**, dan perlu disebut di laporan. Model peramal apa pun (termasuk S4) pada data ini pada dasarnya sedang mempelajari pola buatan di tabel atas.

Akhir simulasi sengaja dibuat "admin kewalahan": empat supplier tidak dipesan selama 4 hari terakhir. Hasilnya, dashboard punya bahan kritis yang belum dipesan, dan agen restock (M8) punya pekerjaan. Simulasi memakai `setseed(0.2611)`, jadi hasil seed selalu sama.

Hasil seed (pada uji coba): 8 supplier, 16 bahan, 8 produk, 12 reseller, 57 baris BOM, ±1.700 pesanan, ±790 PO, ±21.700 baris mutasi.

## 6. Jebakan yang ditemui (dan sudah diperbaiki)

1. **Pembulatan ganda.** Kolom `stok` dan `mutasi_stok.qty` sama-sama 2 desimal. Misalnya produksi 7 pak × 0,005 kg = 0,035 kg. `10 − 0,035 = 9,965` dibulatkan jadi 9,97, sedangkan qty mutasinya `−0,035` dibulatkan jadi −0,04. Buku besar lalu menjumlah ke 9,96, beda 0,01 dari stok. **Perbaikan:** `_mutasi` membulatkan qty sekali di awal, sehingga kedua kolom menerima angka yang sama.
2. **Nama alias bentrok di PL/pgSQL.** Di seed, query `... join _sim_produk s ...` berada di dalam blok yang juga punya variabel `s record`. PL/pgSQL mengira `s.dasar` adalah variabel, dan muncul error `record "s" is not assigned yet`. **Perbaikan:** alias diganti `sim`.
3. **Koneksi database IPv6.** "Direct connection" Supabase (`db.xxx.supabase.co`) hanya punya alamat IPv6, sedangkan jaringan rumah/kampus sering hanya IPv4. **Perbaikan:** pakai "Session pooler" (IPv4). Bentuknya `postgresql://postgres.<ref>:<password>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`. Perhatikan: username-nya `postgres.<ref>`, bukan sekadar `postgres`. Skrip `db.mjs` sekarang menolak URL direct dengan pesan yang jelas.
4. **Kurung siku di password.** Template Supabase menulis `[YOUR-PASSWORD]`, dan kurung sikunya bagian dari placeholder yang juga harus dihapus. Kalau tertinggal (`[rahasia]`), server menjawab `password authentication failed`. Karakter khusus di password (`@ : / ? # [ ] %`) juga harus di-*URL-encode*.
5. **Region project.** Project ternyata berada di region Tokyo (`ap-northeast-1`), bukan Singapura. Host pooler bergantung pada region dan indeks cluster (`aws-0`/`aws-1`), jadi selalu salin host dari tombol **Connect**, jangan ditebak.

## 7. Cara menjalankan

```bash
npm run db:migrate         # pasang skema + fungsi + hak akses (yang belum terpasang)
npm run db:seed            # isi data contoh (±1–3 menit)
npm run db:test            # 25 tes skenario; perubahan di-rollback, data tidak berubah
npm run db:reset -- --ya   # HAPUS semua, lalu ulangi migrate + seed
```

## 8. "Kalau aku mau mengubah X, sentuh berkas mana?"

| Mau mengubah | Berkas |
|---|---|
| tambah kolom/tabel | migrasi baru `supabase/migrations/0004_....sql` (jangan edit migrasi yang sudah terpasang) |
| aturan stok (misal stok berkurang saat pesanan dibuat) | `0002_fungsi_stok.sql` → `buat_pesanan` / `kirim_pesanan` (lewat migrasi baru) |
| siapa boleh apa | `0003_hak_akses.sql` (lewat migrasi baru) |
| data contoh, resep BOM, pola musiman | `supabase/seed.sql`, lalu `db:reset` + `db:migrate` + `db:seed` |
| skenario uji | `scripts/tes-skenario.sql` |
