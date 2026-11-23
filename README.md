# SCM Galunggung Frozen Food

**Aplikasi: https://scm-frozen-food.vercel.app** (login admin; pendaftaran publik ditutup)

Aplikasi web Supply Chain Management untuk UMKM frozen food (fiktif) di Tasikmalaya:

```
supplier → gudang bahan baku → produksi → gudang barang jadi → reseller/toko
```

Tugas UAS Sistem Informasi, dibangun bersama agent AI (Claude Code). Stack: Next.js 16 + TypeScript + Tailwind, Supabase (Postgres + Auth), Vercel.

## Fitur
- **Master data**: supplier, bahan baku, produk + resep (BOM), reseller; stok opname
- **Purchase Order**: draft → dikirim → diterima (stok bahan bertambah), pesan WhatsApp ke supplier
- **Produksi**: pratinjau kebutuhan bahan; bahan berkurang sesuai BOM, produk bertambah
- **Pesanan reseller**: diproses → dikirim (stok produk berkurang) → diterima; tanda siap kirim
- **Dashboard**: stok kritis, PO & pesanan berjalan, grafik pergerakan stok 30 hari
- **Mutasi stok**: buku besar semua pergerakan stok + grafik riwayat per barang
- **Agen restock**: menghitung kebutuhan bahan dari pesanan & ramalan, membuat **draft** PO per supplier yang menunggu persetujuan admin

Semua perubahan stok terjadi di fungsi Postgres yang atomik dan tercatat di buku besar; RLS aktif di semua tabel.

## Dokumen
- [`PROSES.md`](PROSES.md): jurnal pembangunan per milestone + ringkasan kelebihan/kekurangan agent
- [`CLAUDE.md`](CLAUDE.md): konteks proyek, konvensi kode, cara menjalankan (untuk manusia & agent)
- [`docs/`](docs/): penjelasan logika (alur stok, PO, produksi, pesanan, dashboard, agen restock) + screenshot

## Menjalankan lokal
```bash
npm install
cp .env.example .env.local   # isi URL & publishable key Supabase (+ DATABASE_URL untuk skrip DB)
npm run db:migrate && npm run db:seed
npm run dev                  # http://localhost:3000
npm test && npm run db:test  # 47 unit test + 23 tes skenario database
```
