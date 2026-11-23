-- =====================================================================
-- 0005 — Ringkasan mutasi harian untuk grafik dashboard (M7)
--
-- Kenapa di database, bukan di aplikasi?
--   30 hari terakhir bisa berisi >1.000 baris mutasi, padahal PostgREST
--   membatasi 1.000 baris per permintaan. Agregasi di Postgres hanya
--   mengirim 30 baris (satu per hari) dan tetap benar berapa pun datanya.
--
-- SECURITY INVOKER (bawaan): fungsi berjalan dengan hak pemanggil, jadi
-- RLS & GRANT select mutasi_stok tetap berlaku. Fungsi ini hanya membaca.
-- =====================================================================

create function public.mutasi_harian(p_hari int default 30)
returns table (
  tanggal          date,
  produk_masuk     numeric,  -- pak hasil produksi
  produk_keluar    numeric,  -- pak dikirim ke reseller
  bahan_masuk_rp   numeric,  -- nilai bahan diterima dari PO (qty x harga_satuan saat ini)
  bahan_keluar_rp  numeric   -- nilai bahan terpakai produksi
)
language sql stable set search_path = ''
as $$
  with hari as (
    select generate_series(
             public.hari_ini() - (least(greatest(p_hari, 1), 366) - 1),
             public.hari_ini(),
             interval '1 day'
           )::date as tanggal
  ),
  m as (
    select (ms.waktu at time zone 'Asia/Jakarta')::date as tanggal,
           ms.sumber, ms.qty, ms.produk_id, ms.bahan_id, b.harga_satuan
      from public.mutasi_stok ms
      left join public.bahan_baku b on b.id = ms.bahan_id
     where ms.waktu >= ((public.hari_ini() - (least(greatest(p_hari, 1), 366) - 1)) at time zone 'Asia/Jakarta')
       and ms.sumber in ('po', 'produksi', 'pesanan')   -- saldo awal & stok opname bukan arus barang
  )
  select h.tanggal,
         coalesce(sum(m.qty)                    filter (where m.produk_id is not null and m.qty > 0), 0),
         coalesce(sum(-m.qty)                   filter (where m.produk_id is not null and m.qty < 0), 0),
         coalesce(round(sum(m.qty * m.harga_satuan)  filter (where m.bahan_id is not null and m.qty > 0)), 0),
         coalesce(round(sum(-m.qty * m.harga_satuan) filter (where m.bahan_id is not null and m.qty < 0)), 0)
    from hari h
    left join m on m.tanggal = h.tanggal
   group by h.tanggal
   order by h.tanggal
$$;

grant execute on function public.mutasi_harian(int) to authenticated;
