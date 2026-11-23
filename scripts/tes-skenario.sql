-- =====================================================================
-- tes-skenario.sql — uji alur stok end-to-end terhadap database sungguhan.
-- Semua berjalan dalam SATU transaksi yang di-ROLLBACK di akhir,
-- jadi data seed tidak berubah. Dijalankan lewat: npm run db:test
--
-- Setiap pemeriksaan mencetak "LULUS: ..." ; kegagalan menghentikan tes.
-- Tes dijalankan sebagai role "authenticated" (sama seperti aplikasi
-- setelah admin login), kecuali bagian yang menguji role "anon".
-- =====================================================================

begin;

-- Helper: pastikan sebuah perintah DITOLAK dengan pesan yang memuat teks tertentu
create function pg_temp.harus_gagal(p_sql text, p_teks text, p_label text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_teks) in lower(sqlerrm)) > 0 then
      raise notice 'LULUS: % (ditolak: %)', p_label, sqlerrm;
      return;
    end if;
    raise exception 'GAGAL: % — ditolak, tapi pesannya tak terduga: %', p_label, sqlerrm;
  end;
  raise exception 'GAGAL: % — seharusnya ditolak, ternyata berhasil', p_label;
end $$;
grant execute on function pg_temp.harus_gagal(text, text, text) to anon, authenticated;

-- ---------- 1. Hak akses ----------
set local role anon;
select pg_temp.harus_gagal('select 1 from public.supplier', 'permission denied', 'anon tidak bisa membaca supplier');
select pg_temp.harus_gagal('select public.hari_ini()', 'permission denied', 'anon tidak bisa memanggil fungsi');
reset role;

set local role authenticated;
select pg_temp.harus_gagal('update public.bahan_baku set stok = 999', 'permission denied',
                           'authenticated tidak bisa mengubah kolom stok langsung');
select pg_temp.harus_gagal('update public.purchase_order set status = ''diterima''', 'permission denied',
                           'authenticated tidak bisa mengubah status PO langsung');
select pg_temp.harus_gagal('select public._mutasi(1, null, 5, ''penyesuaian'', null, null, now())', 'permission denied',
                           'authenticated tidak bisa memanggil fungsi internal _mutasi');
do $$ begin
  assert (select count(*) from public.supplier) > 0, 'authenticated harus bisa membaca supplier';
  raise notice 'LULUS: authenticated bisa membaca master data';
end $$;

-- ---------- 2. Purchase Order: draft -> dikirim -> diterima ----------
do $$
declare
  v_bahan  bigint := (select id from public.bahan_baku where kode = 'BB-01');
  v_sup    bigint := (select id from public.supplier where kode = 'SUP-01');
  v_awal   numeric := (select stok from public.bahan_baku where kode = 'BB-01');
  v_po     bigint;
begin
  v_po := public.buat_po(v_sup, jsonb_build_array(jsonb_build_object('bahan_id', v_bahan, 'qty', 10)));
  assert (select status from public.purchase_order where id = v_po) = 'draft', 'PO baru harus draft';
  assert (select harga_satuan from public.po_item where po_id = v_po) = 52000, 'harga default dari master';
  assert (select stok from public.bahan_baku where id = v_bahan) = v_awal, 'PO draft tidak mengubah stok';
  raise notice 'LULUS: PO dibuat berstatus draft, stok belum berubah';

  perform pg_temp.harus_gagal(format('select public.terima_po(%s)', v_po), 'hanya PO yang sudah dikirim',
                              'PO draft tidak bisa langsung diterima');

  perform public.kirim_po(v_po);
  perform pg_temp.harus_gagal(format('update public.po_item set qty = 99 where po_id = %s', v_po),
                              'tidak bisa diubah', 'item PO terkunci setelah dikirim');

  perform public.terima_po(v_po);
  assert (select stok from public.bahan_baku where id = v_bahan) = v_awal + 10, 'stok bahan harus +10';
  assert exists (select 1 from public.mutasi_stok where sumber = 'po' and ref_id = v_po and qty = 10),
         'mutasi PO harus tercatat';
  raise notice 'LULUS: terima PO menambah stok bahan (% -> %) dan tercatat di mutasi', v_awal, v_awal + 10;

  perform pg_temp.harus_gagal(format('select public.terima_po(%s)', v_po), 'berstatus diterima',
                              'PO tidak bisa diterima dua kali');
end $$;

-- ---------- 3. Produksi: bahan turun sesuai BOM, produk naik ----------
do $$
declare
  v_produk  bigint := (select id from public.produk where kode = 'PJ-01');
  v_awal_p  integer := (select stok from public.produk where kode = 'PJ-01');
  v_salah   integer;
begin
  create temp table _sebelum on commit drop as
    select b.id, b.stok, m.qty_per_unit from public.bom m join public.bahan_baku b on b.id = m.bahan_id
     where m.produk_id = v_produk;

  -- pastikan bahan cukup untuk 10 pak
  perform public.sesuaikan_stok(s.id, null, greatest(s.stok, s.qty_per_unit * 10), 'persiapan tes')
     from _sebelum s;
  update _sebelum s set stok = b.stok from public.bahan_baku b where b.id = s.id;

  perform public.catat_produksi(v_produk, 10, 'tes');

  select count(*) into v_salah
    from _sebelum s join public.bahan_baku b on b.id = s.id
   where b.stok <> s.stok - s.qty_per_unit * 10;
  assert v_salah = 0, 'setiap bahan harus berkurang qty_per_unit x 10';
  assert (select stok from public.produk where id = v_produk) = v_awal_p + 10, 'stok produk harus +10';
  raise notice 'LULUS: produksi 10 pak mengurangi % bahan sesuai BOM dan menambah stok produk (% -> %)',
               (select count(*) from _sebelum), v_awal_p, v_awal_p + 10;

  perform pg_temp.harus_gagal(format('select public.catat_produksi(%s, 1000000)', v_produk),
                              'bahan tidak cukup', 'produksi ditolak kalau bahan kurang');
  assert (select stok from public.produk where id = v_produk) = v_awal_p + 10,
         'produksi gagal tidak boleh mengubah stok';
  raise notice 'LULUS: produksi yang gagal tidak mengubah stok sama sekali (atomik)';
end $$;

-- ---------- 4. Pesanan: diproses -> dikirim -> diterima ----------
do $$
declare
  v_produk  bigint := (select id from public.produk where kode = 'PJ-01');
  v_res     bigint := (select id from public.reseller where kode = 'RSL-01');
  v_awal    integer;
  v_ps      bigint;
begin
  perform public.sesuaikan_stok(null, v_produk, 50, 'persiapan tes');
  v_awal := 50;

  v_ps := public.buat_pesanan(v_res, jsonb_build_array(jsonb_build_object('produk_id', v_produk, 'qty', 5)));
  assert (select status from public.pesanan where id = v_ps) = 'diproses', 'pesanan baru harus diproses';
  assert (select stok from public.produk where id = v_produk) = v_awal, 'pesanan diproses belum mengurangi stok';

  perform public.kirim_pesanan(v_ps);
  assert (select stok from public.produk where id = v_produk) = v_awal - 5, 'stok produk harus -5 saat dikirim';
  perform public.terima_pesanan(v_ps);
  assert (select status from public.pesanan where id = v_ps) = 'diterima', 'status akhir diterima';
  raise notice 'LULUS: pesanan diproses -> dikirim (stok % -> %) -> diterima', v_awal, v_awal - 5;

  perform pg_temp.harus_gagal(format('select public.batalkan_pesanan(%s)', v_ps), 'hanya pesanan diproses',
                              'pesanan yang sudah diterima tidak bisa dibatalkan');

  v_ps := public.buat_pesanan(v_res, jsonb_build_array(jsonb_build_object('produk_id', v_produk, 'qty', 999999)));
  perform pg_temp.harus_gagal(format('select public.kirim_pesanan(%s)', v_ps), 'stok produk tidak cukup',
                              'pengiriman ditolak kalau stok produk kurang');
  perform public.batalkan_pesanan(v_ps);
  assert (select status from public.pesanan where id = v_ps) = 'dibatalkan', 'pesanan bisa dibatalkan';
  raise notice 'LULUS: pesanan yang belum dikirim bisa dibatalkan';
end $$;

-- ---------- 5. Konsistensi buku besar ----------
-- Untuk SETIAP barang: stok di master = jumlah semua mutasinya.
do $$
declare
  v_beda integer;
begin
  select count(*) into v_beda from public.bahan_baku b
   where b.stok <> coalesce((select sum(qty) from public.mutasi_stok m where m.bahan_id = b.id), 0);
  assert v_beda = 0, format('%s bahan baku stoknya tidak sama dengan total mutasi', v_beda);

  select count(*) into v_beda from public.produk p
   where p.stok <> coalesce((select sum(qty) from public.mutasi_stok m where m.produk_id = p.id), 0);
  assert v_beda = 0, format('%s produk stoknya tidak sama dengan total mutasi', v_beda);

  select count(*) into v_beda from public.mutasi_stok m
   where m.stok_setelah < 0;
  assert v_beda = 0, 'tidak boleh ada stok negatif di riwayat';

  raise notice 'LULUS: stok semua barang = total mutasinya (% baris mutasi diperiksa)',
               (select count(*) from public.mutasi_stok);
end $$;

-- ---------- 6. Ringkasan grafik dashboard (M7) ----------
-- mutasi_harian() harus cocok dengan buku besar: total pak keluar 30 hari
-- = total mutasi "pesanan" produk sejak awal hari ke-30 (WIB), dan selalu 30 baris.
do $$
declare
  v_grafik numeric;
  v_buku   numeric;
begin
  assert (select count(*) from public.mutasi_harian(30)) = 30, 'grafik harus berisi tepat 30 hari';
  select sum(produk_keluar) into v_grafik from public.mutasi_harian(30);
  select coalesce(sum(-qty), 0) into v_buku from public.mutasi_stok
   where produk_id is not null and sumber = 'pesanan'
     and waktu >= ((public.hari_ini() - 29) at time zone 'Asia/Jakarta');
  assert v_grafik = v_buku, format('grafik %s pak, buku besar %s pak', v_grafik, v_buku);
  raise notice 'LULUS: ringkasan grafik 30 hari = buku besar (% pak dikirim)', v_grafik;
end $$;

reset role;
rollback;
