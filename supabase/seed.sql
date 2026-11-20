-- =====================================================================
-- seed.sql — data contoh "Galunggung Frozen Food" (FIKTIF), Tasikmalaya
--
-- Bagian A: master data (supplier, bahan baku, produk, reseller, BOM)
-- Bagian B: simulasi harian 365 hari ke belakang yang MEMANGGIL fungsi
--           stok yang sama dengan aplikasi (buat_pesanan, kirim_pesanan,
--           catat_produksi, buat_po, terima_po, ...). Jadi riwayatnya pasti
--           konsisten dengan buku besar mutasi_stok.
--
-- Nama usaha, orang, dan nomor telepon fiktif. Nama tempat (Cikurubuk,
-- Singaparna, Pangandaran, dst.) nyata supaya konteksnya terasa lokal.
-- Pola permintaan = asumsi wajar, BUKAN data penjualan sungguhan.
-- Simulasi deterministik (setseed) -> hasil seed selalu sama.
-- =====================================================================

set statement_timeout = 0;

do $$
begin
  if exists (select 1 from public.supplier) then
    raise exception 'Database sudah berisi data. Jalankan "npm run db:reset" dulu kalau ingin seed ulang.';
  end if;
end $$;

-- ===================== A. MASTER DATA =====================

insert into public.supplier (kode, nama, kontak, telepon, alamat, lead_time_hari) values
  ('SUP-01', 'CV Unggas Singaparna',          'Pak Dede',    '0812-2001-1101', 'Jl. Raya Singaparna No. 45, Kab. Tasikmalaya', 1),
  ('SUP-02', 'UD Hasil Laut Pangandaran',     'Bu Euis',     '0813-2002-1102', 'Jl. Pantai Timur, Pangandaran',                2),
  ('SUP-03', 'Toko Tepung Sumber Rejeki',     'Koh Hendra',  '0812-2003-1103', 'Pasar Cikurubuk Blok C-12, Tasikmalaya',       1),
  ('SUP-04', 'Kios Bumbu Bu Imas',            'Bu Imas',     '0857-2004-1104', 'Pasar Cikurubuk Blok A-07, Tasikmalaya',       1),
  ('SUP-05', 'CV Kemasan Priangan',           'Kang Asep',   '0812-2005-1105', 'Jl. Ir. H. Juanda No. 88, Tasikmalaya',        3),
  ('SUP-06', 'RPH Sapi Cibeureum',            'Pak Ujang',   '0821-2006-1106', 'Jl. Cibeureum, Kota Tasikmalaya',              2),
  ('SUP-07', 'Peternakan Telur Manonjaya',    'Pak Cecep',   '0852-2007-1107', 'Desa Margaluyu, Manonjaya, Kab. Tasikmalaya',  1),
  ('SUP-08', 'Toko Kulit Pangsit Mitra Rasa', 'Teh Rina',    '0812-2008-1108', 'Jl. Cihideung Balong, Tasikmalaya',            2);

insert into public.bahan_baku (kode, nama, satuan, harga_satuan, supplier_id)
select v.kode, v.nama, v.satuan, v.harga, s.id
from (values
  ('BB-01', 'Daging ayam fillet',          'kg',     52000, 'SUP-01'),
  ('BB-02', 'Ikan tenggiri giling',        'kg',     85000, 'SUP-02'),
  ('BB-03', 'Udang kupas',                 'kg',     95000, 'SUP-02'),
  ('BB-04', 'Daging sapi giling',          'kg',    130000, 'SUP-06'),
  ('BB-05', 'Tepung tapioka',              'kg',     12000, 'SUP-03'),
  ('BB-06', 'Tepung terigu',               'kg',     11000, 'SUP-03'),
  ('BB-07', 'Tepung roti (panir)',         'kg',     24000, 'SUP-03'),
  ('BB-08', 'Minyak goreng',               'liter',  17000, 'SUP-03'),
  ('BB-09', 'Telur ayam',                  'kg',     28000, 'SUP-07'),
  ('BB-10', 'Bawang putih',                'kg',     38000, 'SUP-04'),
  ('BB-11', 'Bawang merah',                'kg',     42000, 'SUP-04'),
  ('BB-12', 'Daun bawang',                 'kg',     20000, 'SUP-04'),
  ('BB-13', 'Bumbu dasar (garam, gula, merica)', 'kg', 30000, 'SUP-04'),
  ('BB-14', 'Kulit dimsum',                'lembar',   150, 'SUP-08'),
  ('BB-15', 'Kulit lumpia',                'lembar',   250, 'SUP-08'),
  ('BB-16', 'Plastik vakum + label',       'pcs',      900, 'SUP-05')
) v(kode, nama, satuan, harga, sup)
join public.supplier s on s.kode = v.sup;

insert into public.produk (kode, nama, satuan, harga_jual, stok_minimum) values
  ('PJ-01', 'Dimsum Ayam isi 10',            'pak', 25000, 0),
  ('PJ-02', 'Siomay Ikan Tenggiri isi 10',   'pak', 28000, 0),
  ('PJ-03', 'Nugget Ayam 500 g',             'pak', 32000, 0),
  ('PJ-04', 'Bakso Sapi isi 25',             'pak', 45000, 0),
  ('PJ-05', 'Cireng Isi Ayam Pedas isi 10',  'pak', 15000, 0),
  ('PJ-06', 'Risoles Ragout Ayam isi 6',     'pak', 22000, 0),
  ('PJ-07', 'Otak-otak Tenggiri isi 10',     'pak', 24000, 0),
  ('PJ-08', 'Lumpia Udang isi 8',            'pak', 30000, 0);

insert into public.reseller (kode, nama, tipe, telepon, alamat, kota) values
  ('RSL-01', 'Toko Frozen Cihideung',     'toko',     '0812-3001-2201', 'Jl. Cihideung No. 21',              'Kota Tasikmalaya'),
  ('RSL-02', 'Teh Neng Frozen (Tawang)',  'reseller', '0857-3002-2202', 'Jl. Tawang Sari No. 5',             'Kota Tasikmalaya'),
  ('RSL-03', 'Minimarket Sabilulungan',   'toko',     '0812-3003-2203', 'Jl. Mohammad Hatta No. 110, Indihiang', 'Kota Tasikmalaya'),
  ('RSL-04', 'Kang Ade Reseller Kawalu',  'reseller', '0821-3004-2204', 'Jl. Kawalu Raya No. 17',            'Kota Tasikmalaya'),
  ('RSL-05', 'Warung Bu Yati Cipedes',    'toko',     '0852-3005-2205', 'Jl. Cipedes No. 3',                 'Kota Tasikmalaya'),
  ('RSL-06', 'Frozen Mart Mangkubumi',    'toko',     '0813-3006-2206', 'Jl. Mangkubumi No. 64',             'Kota Tasikmalaya'),
  ('RSL-07', 'Reseller Teh Sinta Singaparna', 'reseller', '0812-3007-2207', 'Jl. Raya Singaparna No. 9',     'Kab. Tasikmalaya'),
  ('RSL-08', 'Toko Beku Ciawi',           'toko',     '0857-3008-2208', 'Jl. Raya Ciawi No. 30',             'Kab. Tasikmalaya'),
  ('RSL-09', 'Ciamis Frozen Corner',      'toko',     '0812-3009-2209', 'Jl. Jend. Sudirman No. 77',         'Ciamis'),
  ('RSL-10', 'Kang Rizal Reseller Banjar','reseller', '0821-3010-2210', 'Jl. Letjen Suwarto No. 12',         'Banjar'),
  ('RSL-11', 'Garut Beku Sejahtera',      'toko',     '0852-3011-2211', 'Jl. Ciledug No. 45',                'Garut'),
  ('RSL-12', 'Teh Lilis Reseller Pangandaran', 'reseller', '0813-3012-2212', 'Jl. Pamugaran No. 2',          'Pangandaran');

-- BOM per 1 pak (perkiraan resep rumahan skala UMKM)
insert into public.bom (produk_id, bahan_id, qty_per_unit)
select p.id, b.id, v.qty
from (values
  -- Dimsum ayam isi 10 (~250 g)
  ('PJ-01','BB-01',0.150), ('PJ-01','BB-05',0.030), ('PJ-01','BB-09',0.010), ('PJ-01','BB-10',0.005),
  ('PJ-01','BB-12',0.005), ('PJ-01','BB-13',0.005), ('PJ-01','BB-14',10),    ('PJ-01','BB-16',1),
  -- Siomay tenggiri isi 10 (~300 g)
  ('PJ-02','BB-02',0.150), ('PJ-02','BB-05',0.080), ('PJ-02','BB-09',0.010), ('PJ-02','BB-10',0.005),
  ('PJ-02','BB-13',0.005), ('PJ-02','BB-14',10),    ('PJ-02','BB-16',1),
  -- Nugget ayam 500 g (digoreng setengah matang)
  ('PJ-03','BB-01',0.300), ('PJ-03','BB-06',0.050), ('PJ-03','BB-07',0.060), ('PJ-03','BB-09',0.040),
  ('PJ-03','BB-10',0.010), ('PJ-03','BB-13',0.010), ('PJ-03','BB-08',0.050), ('PJ-03','BB-16',1),
  -- Bakso sapi isi 25 (~500 g)
  ('PJ-04','BB-04',0.350), ('PJ-04','BB-05',0.100), ('PJ-04','BB-10',0.010), ('PJ-04','BB-11',0.010),
  ('PJ-04','BB-13',0.010), ('PJ-04','BB-16',1),
  -- Cireng isi ayam pedas isi 10 (~400 g)
  ('PJ-05','BB-05',0.250), ('PJ-05','BB-01',0.060), ('PJ-05','BB-10',0.005), ('PJ-05','BB-12',0.010),
  ('PJ-05','BB-13',0.005), ('PJ-05','BB-16',1),
  -- Risoles ragout ayam isi 6
  ('PJ-06','BB-06',0.100), ('PJ-06','BB-01',0.080), ('PJ-06','BB-09',0.040), ('PJ-06','BB-07',0.050),
  ('PJ-06','BB-08',0.030), ('PJ-06','BB-11',0.005), ('PJ-06','BB-13',0.005), ('PJ-06','BB-16',1),
  -- Otak-otak tenggiri isi 10
  ('PJ-07','BB-02',0.180), ('PJ-07','BB-05',0.080), ('PJ-07','BB-09',0.010), ('PJ-07','BB-10',0.005),
  ('PJ-07','BB-12',0.010), ('PJ-07','BB-13',0.005), ('PJ-07','BB-16',1),
  -- Lumpia udang isi 8
  ('PJ-08','BB-03',0.120), ('PJ-08','BB-01',0.040), ('PJ-08','BB-15',8),     ('PJ-08','BB-10',0.005),
  ('PJ-08','BB-13',0.005), ('PJ-08','BB-08',0.020), ('PJ-08','BB-16',1)
) v(pk, bk, qty)
join public.produk p on p.kode = v.pk
join public.bahan_baku b on b.kode = v.bk;

-- ===================== B. PARAMETER SIMULASI =====================

-- Permintaan dasar (pak/hari, total semua reseller) per produk
create temp table _sim_produk (kode text primary key, dasar numeric not null);
insert into _sim_produk values
  ('PJ-01', 20), ('PJ-02', 15), ('PJ-03', 18), ('PJ-04', 12),
  ('PJ-05', 15), ('PJ-06',  8), ('PJ-07', 10), ('PJ-08',  6);

-- Peluang reseller memesan per hari & skala ukuran pesanannya
create temp table _sim_reseller (kode text primary key, p_pesan numeric not null, skala numeric not null);
insert into _sim_reseller values
  ('RSL-01', 0.55, 1.0), ('RSL-02', 0.35, 1.3), ('RSL-03', 0.45, 0.8), ('RSL-04', 0.30, 1.3),
  ('RSL-05', 0.40, 0.6), ('RSL-06', 0.45, 0.9), ('RSL-07', 0.30, 1.3), ('RSL-08', 0.35, 0.8),
  ('RSL-09', 0.30, 1.1), ('RSL-10', 0.25, 1.4), ('RSL-11', 0.25, 1.1), ('RSL-12', 0.20, 1.4);

-- Reorder point & stok minimum dari permintaan dasar:
--   pemakaian harian bahan d = sum(qty_per_unit x permintaan dasar produk)
--   ROP = d x (lead time + 2 hari cadangan)
--   stok minimum produk = 2 hari permintaan dasar
with pakai as (
  select m.bahan_id, sum(m.qty_per_unit * s.dasar) as harian
  from public.bom m
  join public.produk p on p.id = m.produk_id
  join _sim_produk s on s.kode = p.kode
  group by m.bahan_id
)
update public.bahan_baku b
   set reorder_point = case b.satuan
         when 'lembar' then ceil(pk.harian * (sp.lead_time_hari + 2) / 100) * 100
         when 'pcs'    then ceil(pk.harian * (sp.lead_time_hari + 2) / 50) * 50
         else ceil(pk.harian * (sp.lead_time_hari + 2))
       end
  from pakai pk, public.supplier sp
 where pk.bahan_id = b.id and sp.id = b.supplier_id;

update public.produk p set stok_minimum = ceil(s.dasar * 2)
  from _sim_produk s where s.kode = p.kode;

-- Pembulatan jumlah beli ke kemasan wajar
create function pg_temp.bulat(x numeric, satuan text) returns numeric language sql immutable as $$
  select case satuan
    when 'lembar' then ceil(x / 100) * 100
    when 'pcs'    then ceil(x / 50) * 50
    else ceil(x)
  end
$$;

-- Faktor musiman permintaan pada tanggal d (1,0 = normal)
create function pg_temp.faktor(d date, mulai date) returns numeric language plpgsql immutable as $$
declare
  f numeric := 1;
begin
  -- pola mingguan: toko belanja stok menjelang akhir pekan
  f := f * case extract(isodow from d)::int when 5 then 1.15 when 6 then 1.25 when 7 then 0.85 else 1 end;
  -- gajian (tgl 25 s.d. 3)
  if extract(day from d) >= 25 or extract(day from d) <= 3 then f := f * 1.15; end if;
  -- libur akhir tahun
  if d between date '2025-12-20' and date '2026-01-02' then f := f * 1.25; end if;
  -- Ramadan 1447 H (perkiraan 18 Feb - 19 Mar 2026): takjil & sahur
  if d between date '2026-02-18' and date '2026-03-12' then f := f * 1.45;
  elsif d between date '2026-03-13' and date '2026-03-18' then f := f * 1.90;  -- borong menjelang Lebaran
  elsif d between date '2026-03-19' and date '2026-03-26' then f := f * 0.45;  -- Lebaran: toko tutup, mudik
  end if;
  -- Iduladha (27 Mei 2026): daging kurban melimpah, frozen food sepi
  if d between date '2026-05-25' and date '2026-05-31' then f := f * 0.80; end if;
  -- libur sekolah
  if d between date '2026-06-27' and date '2026-07-12' then f := f * 1.15; end if;
  -- 17 Agustus (lomba & syukuran)
  if d between date '2026-08-14' and date '2026-08-17' then f := f * 1.20; end if;
  -- tren usaha tumbuh ~20% per tahun
  f := f * (1 + 0.20 * (d - mulai) / 365.0);
  return f;
end;
$$;

-- ===================== C. SIMULASI HARIAN =====================
do $$
declare
  v_akhir  date := public.hari_ini();
  v_mulai  date := public.hari_ini() - 364;
  d        date;
  v_f      numeric;
  v_e_pesan numeric;     -- perkiraan jumlah pesanan per hari
  v_items  jsonb;
  v_id     bigint;
  v_qty    numeric;
  v_perlu  numeric;
  r        record;
  s        record;
begin
  perform setseed(0.2611);
  select sum(p_pesan) into v_e_pesan from _sim_reseller;

  -- Saldo awal (sehari sebelum simulasi)
  for r in select id, reorder_point from public.bahan_baku order by id loop
    perform public._mutasi(r.id, null, r.reorder_point * 2, 'saldo_awal', null, 'Saldo awal', public._waktu(v_mulai - 1));
  end loop;
  -- (alias tabel "sim", bukan "s": "s" sudah dipakai variabel record di atas)
  for r in select p.id, sim.dasar from public.produk p join _sim_produk sim using (kode) order by p.id loop
    perform public._mutasi(null, r.id, ceil(r.dasar * 3), 'saldo_awal', null, 'Saldo awal', public._waktu(v_mulai - 1));
  end loop;

  d := v_mulai;
  while d <= v_akhir loop
    v_f := pg_temp.faktor(d, v_mulai);

    -- 1) PO yang sudah sampai (tanggal kirim + lead time) diterima gudang.
    --    Hari terakhir dilewati (barang tiba sore, belum dicatat) -> ada "PO berjalan".
    if d < v_akhir then
      for r in select po.id from public.purchase_order po join public.supplier sp on sp.id = po.supplier_id
                where po.status = 'dikirim' and po.tanggal_dikirim + sp.lead_time_hari <= d
                order by po.id loop
        perform public.terima_po(r.id, d);
      end loop;
    end if;

    -- 2) Pesanan yang dikirim sebelum hari ini sudah diterima reseller
    for r in select id from public.pesanan where status = 'dikirim' and tanggal_kirim < d order by id loop
      perform public.terima_pesanan(r.id, d);
    end loop;

    -- 3) Kirim pesanan kemarin (terlama dulu); kalau stok kurang, tunggu produksi
    for r in select id from public.pesanan where status = 'diproses' and tanggal < d order by tanggal, id loop
      begin
        perform public.kirim_pesanan(r.id, d);
      exception when raise_exception then null;
      end;
    end loop;

    -- 4) Produksi: isi stok produk sampai 3 hari permintaan + pesanan tertunda
    for r in select p.id, sim.dasar, p.stok,
                    coalesce((select sum(i.qty) from public.pesanan_item i
                                join public.pesanan o on o.id = i.pesanan_id
                               where o.status = 'diproses' and i.produk_id = p.id), 0) as tertunda
               from public.produk p join _sim_produk sim using (kode) order by p.id loop
      v_perlu := ceil(r.dasar * v_f * 3) + r.tertunda - r.stok;
      if v_perlu >= r.dasar then
        v_qty := ceil(v_perlu / 10) * 10;
        begin
          perform public.catat_produksi(r.id, v_qty::int, null, d);
        exception when raise_exception then
          begin  -- bahan terbatas: coba setengah batch
            perform public.catat_produksi(r.id, (ceil(v_qty / 20) * 10)::int, 'Batch dikurangi: bahan terbatas', d);
          exception when raise_exception then null;
          end;
        end;
      end if;
    end loop;

    -- 5) Pesanan baru dari reseller
    for r in select rs.id, sr.p_pesan, sr.skala from public.reseller rs
               join _sim_reseller sr using (kode) order by rs.id loop
      if random() < least(0.95, r.p_pesan * sqrt(v_f)) then
        v_items := '[]'::jsonb;
        for s in select p.id, sp.dasar from public.produk p join _sim_produk sp using (kode) order by p.id loop
          if random() < 0.55 then
            v_qty := greatest(1, round(s.dasar * sqrt(v_f) * r.skala / (v_e_pesan * 0.55) * (0.6 + 0.8 * random())));
            v_items := v_items || jsonb_build_array(jsonb_build_object('produk_id', s.id, 'qty', v_qty));
          end if;
        end loop;
        if jsonb_array_length(v_items) > 0 then
          perform public.buat_pesanan(r.id, v_items, null, d);
        end if;
      end if;
    end loop;

    -- 6) Pembelian: bahan dengan (stok + dalam perjalanan) < ROP -> 1 PO per supplier.
    --    Akhir simulasi dibuat "admin kewalahan": supplier SUP-01/02/05/06 masih dipesan
    --    sampai kemarin (jadi ada PO berjalan), tapi SUP-03/04/07/08 terlewat 4 hari
    --    terakhir -> ada bahan kritis yang BELUM dipesan, pekerjaan untuk agen restock.
    if d < v_akhir then
      for s in select id from public.supplier
                where d <= v_akhir - 4 or kode in ('SUP-01', 'SUP-02', 'SUP-05', 'SUP-06')
                order by id loop
        select jsonb_agg(jsonb_build_object(
                 'bahan_id', b.id,
                 'qty', pg_temp.bulat(b.reorder_point * 2.5 - b.stok - x.jalan, b.satuan)) order by b.id)
          into v_items
          from public.bahan_baku b
          cross join lateral (
            select coalesce(sum(i.qty), 0) as jalan
              from public.po_item i join public.purchase_order o on o.id = i.po_id
             where i.bahan_id = b.id and o.status in ('draft', 'dikirim')) x
         where b.supplier_id = s.id and b.stok + x.jalan < b.reorder_point;
        if v_items is not null then
          v_id := public.buat_po(s.id, v_items, 'manual', null, d);
          perform public.kirim_po(v_id, d);
        end if;
      end loop;
    end if;

    d := d + 1;
  end loop;
end $$;

-- Satu PO draft manual (belum disetujui) supaya alur draft -> dikirim bisa dicoba
select public.buat_po(
  (select id from public.supplier where kode = 'SUP-05'),
  jsonb_build_array(jsonb_build_object('bahan_id', (select id from public.bahan_baku where kode = 'BB-16'), 'qty', 1000)),
  'manual', 'Stok kemasan untuk persiapan akhir tahun', public.hari_ini());

-- Ringkasan hasil seed
do $$
declare
  r record;
begin
  for r in
    select 'supplier' t, count(*) n from public.supplier union all
    select 'bahan_baku', count(*) from public.bahan_baku union all
    select 'produk', count(*) from public.produk union all
    select 'reseller', count(*) from public.reseller union all
    select 'bom', count(*) from public.bom union all
    select 'purchase_order', count(*) from public.purchase_order union all
    select 'produksi', count(*) from public.produksi union all
    select 'pesanan', count(*) from public.pesanan union all
    select 'mutasi_stok', count(*) from public.mutasi_stok
  loop
    raise notice '% : % baris', rpad(r.t, 15), r.n;
  end loop;
end $$;
