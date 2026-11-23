-- =====================================================================
-- 0006 — Agen restock (M8)
--
-- Perhitungan keputusan ada di aplikasi (src/lib/agen-restock.ts, diuji unit).
-- Database menyediakan dua hal:
--   1. rata_permintaan_harian(): permintaan harian per produk (ramalan S4 kalau
--      ada, kalau tidak rata-rata bergerak) -> diagregasi di sini karena 28 hari
--      mutasi bisa >1.000 baris (batas PostgREST).
--   2. simpan_hasil_agen(): membuat semua DRAFT PO + log dalam SATU transaksi,
--      dengan kunci supaya klik ganda tidak membuat PO dobel.
-- =====================================================================

-- ---------- 1. Permintaan harian per produk ----------
-- Rata-rata bergerak = total pak DIKIRIM (mutasi sumber 'pesanan') selama p_hari
-- hari PENUH terakhir (hari ini belum selesai, jadi tidak dihitung) / p_hari.
-- Kalau tabel forecast_permintaan berisi ramalan S4 untuk 14 hari ke depan,
-- rata-rata ramalan itu yang dipakai (M8b). Aplikasi tetap jalan tanpa S4.
create function public.rata_permintaan_harian(p_hari int default 28)
returns table (produk_id bigint, rata_harian numeric, sumber text)
language sql stable set search_path = ''
as $$
  with h as (select greatest(least(coalesce(p_hari, 28), 365), 1) as n),
  s4 as (
    select f.produk_id, avg(f.qty) as rata
      from public.forecast_permintaan f
     where f.sumber = 's4'
       and f.tanggal between public.hari_ini() and public.hari_ini() + 13
     group by f.produk_id
  ),
  ma as (
    select p.id as produk_id,
           coalesce(sum(-m.qty), 0) / (select n from h) as rata
      from public.produk p
      left join public.mutasi_stok m
        on m.produk_id = p.id
       and m.sumber = 'pesanan'
       and m.waktu >= ((public.hari_ini() - (select n from h)) at time zone 'Asia/Jakarta')
       and m.waktu <  (public.hari_ini() at time zone 'Asia/Jakarta')
     group by p.id
  )
  select ma.produk_id,
         round(coalesce(s4.rata, ma.rata), 2),
         case when s4.rata is not null then 's4' else 'rata-rata' end
    from ma
    left join s4 on s4.produk_id = ma.produk_id
   order by ma.produk_id
$$;

-- ---------- 2. Simpan hasil agen ----------
-- p_grup      : [{ "supplier_id": 1, "items": [{ "bahan_id": 3, "qty": 5, "harga_satuan": 28000 }] }, ...]
-- p_ringkasan : jejak keputusan (angka & alasan per bahan) untuk agen_log
-- p_dihitung  : kapan aplikasi MULAI membaca data untuk rencana ini
--
-- Perlindungan klik ganda / dua admin bersamaan:
--   a. pg_advisory_xact_lock: hanya satu agen yang menyimpan pada satu waktu.
--   b. Setelah kunci didapat, tolak kalau sudah ada agen lain yang selesai
--      SETELAH rencana ini mulai dihitung (rencananya pasti basi), atau ada PO
--      baru untuk bahan yang sama sejak itu.
create function public.simpan_hasil_agen(p_grup jsonb, p_ringkasan jsonb, p_dihitung timestamptz)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_g       jsonb;
  v_id      bigint;
  v_po      jsonb := '[]'::jsonb;
  v_log     bigint;
  v_bentrok text;
begin
  if p_grup is null or jsonb_typeof(p_grup) <> 'array' then
    raise exception 'Format rencana agen tidak valid';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.simpan_hasil_agen'));

  if exists (select 1 from public.agen_log where waktu > p_dihitung) then
    raise exception 'Agen sudah dijalankan lagi sejak pratinjau ini dihitung. Muat ulang halaman agen.';
  end if;

  select string_agg(distinct b.nama, ', ') into v_bentrok
    from jsonb_array_elements(p_grup) g
   cross join jsonb_array_elements(g->'items') i
    join public.po_item pi on pi.bahan_id = (i->>'bahan_id')::bigint
    join public.purchase_order po on po.id = pi.po_id
    join public.bahan_baku b on b.id = pi.bahan_id
   where po.status in ('draft', 'dikirim') and po.created_at > p_dihitung;
  if v_bentrok is not null then
    raise exception 'Ada PO baru untuk % sejak pratinjau dihitung. Muat ulang halaman agen.', v_bentrok;
  end if;

  for v_g in select * from jsonb_array_elements(p_grup) loop
    v_id := public.buat_po(
      (v_g->>'supplier_id')::bigint,
      v_g->'items',
      'agen',
      'Dibuat otomatis oleh agen restock. Periksa jumlahnya sebelum dikirim ke supplier.'
    );
    v_po := v_po || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'nomor', (select nomor from public.purchase_order where id = v_id),
      'supplier_id', (v_g->>'supplier_id')::bigint
    ));
  end loop;

  -- clock_timestamp(), bukan now(): waktu log = saat benar-benar selesai,
  -- supaya pemeriksaan "agen lain selesai setelah rencana dihitung" di atas akurat.
  insert into public.agen_log (waktu, ringkasan, jumlah_po_dibuat)
  values (clock_timestamp(), coalesce(p_ringkasan, '{}'::jsonb) || jsonb_build_object('po', v_po), jsonb_array_length(v_po))
  returning id into v_log;

  return jsonb_build_object('log_id', v_log, 'po', v_po);
end;
$$;

grant execute on function public.rata_permintaan_harian(int) to authenticated;
grant execute on function public.simpan_hasil_agen(jsonb, jsonb, timestamptz) to authenticated;
