-- =====================================================================
-- 0004_lindungi_riwayat_stok.sql
--
-- Perbaikan desain M1: mutasi_stok dulu memakai ON DELETE CASCADE ke
-- bahan_baku/produk. Akibatnya, menghapus bahan yang punya riwayat ikut
-- MENGHAPUS riwayat stoknya diam-diam, dan buku besar jadi tidak lengkap.
--
-- Sekarang RESTRICT: barang yang sudah punya riwayat stok tidak bisa
-- dihapus. Admin mendapat pesan "masih dipakai di riwayat mutasi stok".
-- =====================================================================

alter table public.mutasi_stok
  drop constraint mutasi_stok_bahan_id_fkey,
  add constraint mutasi_stok_bahan_id_fkey
    foreign key (bahan_id) references public.bahan_baku(id) on delete restrict;

alter table public.mutasi_stok
  drop constraint mutasi_stok_produk_id_fkey,
  add constraint mutasi_stok_produk_id_fkey
    foreign key (produk_id) references public.produk(id) on delete restrict;
