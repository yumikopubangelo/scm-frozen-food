-- =====================================================================
-- reset.sql — HAPUS semua objek aplikasi (tabel, fungsi, tipe, data).
-- Hanya untuk pengembangan: dipakai sebelum migrasi + seed ulang.
-- Dijalankan lewat: npm run db:reset -- --ya
-- =====================================================================

drop table if exists
  public.mutasi_stok, public.po_item, public.purchase_order,
  public.pesanan_item, public.pesanan, public.produksi, public.bom,
  public.forecast_permintaan, public.agen_log,
  public.bahan_baku, public.produk, public.reseller, public.supplier
cascade;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = any (array[
         'hari_ini', '_waktu', '_mutasi',
         'buat_po', 'kirim_po', 'terima_po', 'batalkan_po',
         'catat_produksi',
         'buat_pesanan', 'kirim_pesanan', 'terima_pesanan', 'batalkan_pesanan',
         'sesuaikan_stok', '_jaga_item_po', '_jaga_item_pesanan',
         'simpan_hasil_agen', 'mutasi_harian'
       ])
  loop
    execute format('drop function %s cascade', f.sig);
  end loop;
end $$;

drop sequence if exists public.nomor_po_seq, public.nomor_produksi_seq, public.nomor_pesanan_seq;

drop type if exists
  public.status_po, public.status_pesanan, public.sumber_po,
  public.sumber_mutasi, public.tipe_reseller
cascade;

-- Lupakan catatan migrasi supaya "npm run db:migrate" menjalankan ulang semuanya
delete from internal.skema_migrasi;
