-- =====================================================================
-- 0003_hak_akses.sql — siapa boleh apa
--
-- Dua lapis pengaman:
--  1) GRANT (hak tingkat tabel/kolom): menentukan OPERASI apa yang boleh.
--     Bawaan Supabase berbeda antar-project (tergantung tanggal dibuat &
--     setelan Data API), jadi semua hak bawaan DICABUT dulu lalu diberikan
--     ulang secara eksplisit. Hasilnya sama di project mana pun.
--  2) RLS (Row Level Security): menentukan BARIS mana yang boleh.
--     Aplikasi ini 1 role admin, jadi pengguna login (authenticated) boleh
--     semua baris; pengunjung tanpa login (anon) tidak boleh apa-apa.
--
-- Kolom stok, status, dan nomor dokumen TIDAK bisa diubah langsung oleh
-- aplikasi; wajib lewat fungsi di 0002_fungsi_stok.sql.
-- =====================================================================

-- ---------- Cabut semua hak bawaan ----------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Objek yang dibuat di masa depan juga tidak otomatis terbuka
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------- Master data: boleh CRUD, KECUALI kolom stok ----------
grant select, delete on public.supplier, public.reseller, public.bom to authenticated;
grant insert, update on public.supplier, public.reseller, public.bom to authenticated;

grant select, delete on public.bahan_baku to authenticated;
grant insert (kode, nama, satuan, reorder_point, harga_satuan, supplier_id) on public.bahan_baku to authenticated;
grant update (kode, nama, satuan, reorder_point, harga_satuan, supplier_id) on public.bahan_baku to authenticated;

grant select, delete on public.produk to authenticated;
grant insert (kode, nama, satuan, harga_jual, stok_minimum) on public.produk to authenticated;
grant update (kode, nama, satuan, harga_jual, stok_minimum) on public.produk to authenticated;

-- ---------- Dokumen transaksi: dibuat & diubah status lewat fungsi ----------
grant select on public.purchase_order, public.pesanan, public.produksi to authenticated;
grant update (catatan) on public.purchase_order, public.pesanan to authenticated;

-- Item boleh diedit langsung, tapi trigger penjaga hanya mengizinkan
-- selama PO masih draft / pesanan masih diproses.
grant select, insert, update, delete on public.po_item, public.pesanan_item to authenticated;

-- ---------- Buku besar & agen: hanya baca (ditulis oleh fungsi) ----------
grant select on public.mutasi_stok, public.agen_log to authenticated;
grant select, insert, delete on public.forecast_permintaan to authenticated;

-- ---------- Fungsi yang boleh dipanggil aplikasi ----------
grant execute on function
  public.hari_ini(),
  public.buat_po(bigint, jsonb, public.sumber_po, text, date),
  public.kirim_po(bigint, date),
  public.terima_po(bigint, date),
  public.batalkan_po(bigint),
  public.catat_produksi(bigint, integer, text, date),
  public.buat_pesanan(bigint, jsonb, text, date),
  public.kirim_pesanan(bigint, date),
  public.terima_pesanan(bigint, date),
  public.batalkan_pesanan(bigint),
  public.sesuaikan_stok(bigint, bigint, numeric, text)
to authenticated;
-- _mutasi, _waktu, _jaga_* sengaja TIDAK di-grant (fungsi internal).

-- ---------- Row Level Security ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'supplier', 'bahan_baku', 'produk', 'reseller', 'bom',
    'purchase_order', 'po_item', 'produksi', 'pesanan', 'pesanan_item',
    'mutasi_stok', 'forecast_permintaan', 'agen_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "admin login boleh semua baris" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
