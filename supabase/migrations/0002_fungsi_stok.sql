-- =====================================================================
-- 0002_fungsi_stok.sql — SATU-SATUNYA jalan untuk mengubah stok
--
-- Prinsip:
--  * Setiap fungsi = satu transaksi. Kalau satu langkah gagal (misal stok
--    kurang), SEMUA langkah dibatalkan; stok tidak pernah setengah ter-update.
--  * Fungsi bertanda SECURITY DEFINER berjalan dengan hak pemilik tabel,
--    karena role aplikasi (authenticated) sengaja TIDAK diberi hak mengubah
--    kolom stok secara langsung (lihat 0003_hak_akses.sql).
--  * search_path = '' + nama lengkap (public.xxx) mencegah pembajakan
--    search_path pada fungsi SECURITY DEFINER.
--  * Parameter p_tanggal (bawaan: hari ini WIB) memungkinkan pencatatan
--    mundur, misalnya admin baru mencatat penerimaan kemarin. Seed memakainya
--    untuk membangun riwayat 12 bulan.
-- =====================================================================

-- ---------- Utilitas tanggal (zona WIB) ----------
create function public.hari_ini()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- Waktu pencatatan mutasi: sekarang kalau tanggalnya hari ini,
-- pukul 12.00 WIB pada tanggal itu kalau dicatat mundur.
create function public._waktu(p_tanggal date)
returns timestamptz language sql stable set search_path = ''
as $$
  select case
    when p_tanggal >= public.hari_ini() then now()
    else (p_tanggal + time '12:00') at time zone 'Asia/Jakarta'
  end
$$;

-- ---------- Inti: catat satu pergerakan stok ----------
-- Mengubah stok bahan ATAU produk sebesar p_qty (+ masuk / - keluar)
-- dan menulis baris buku besar mutasi_stok. Menolak kalau stok jadi negatif.
create function public._mutasi(
  p_bahan_id   bigint,
  p_produk_id  bigint,
  p_qty        numeric,
  p_sumber     public.sumber_mutasi,
  p_ref_id     bigint,
  p_keterangan text,
  p_waktu      timestamptz
) returns numeric
language plpgsql security definer set search_path = ''
as $$
declare
  v_stok numeric;
  v_nama text;
begin
  -- Bulatkan SEKALI di sini. Kolom stok & mutasi_stok.qty sama-sama 2 desimal;
  -- tanpa ini, stok+(-0,035) dan -0,035 bisa dibulatkan berbeda dan buku besar
  -- tidak lagi sama dengan stok (contoh: 10-0,035 = 9,965 -> 9,97 tapi qty -> -0,04).
  p_qty := round(p_qty, 2);
  if p_qty = 0 then
    return null;
  end if;

  if p_bahan_id is not null then
    select stok, nama into v_stok, v_nama
      from public.bahan_baku where id = p_bahan_id for update;   -- kunci baris
    if not found then
      raise exception 'Bahan baku id % tidak ditemukan', p_bahan_id;
    end if;
    if v_stok + p_qty < 0 then
      raise exception 'Stok % tidak cukup: tersedia %, dibutuhkan %', v_nama, v_stok, -p_qty;
    end if;
    update public.bahan_baku set stok = stok + p_qty
      where id = p_bahan_id returning stok into v_stok;
  else
    select stok, nama into v_stok, v_nama
      from public.produk where id = p_produk_id for update;
    if not found then
      raise exception 'Produk id % tidak ditemukan', p_produk_id;
    end if;
    if v_stok + p_qty < 0 then
      raise exception 'Stok % tidak cukup: tersedia %, dibutuhkan %', v_nama, v_stok, -p_qty;
    end if;
    update public.produk set stok = stok + p_qty
      where id = p_produk_id returning stok into v_stok;
  end if;

  insert into public.mutasi_stok (waktu, bahan_id, produk_id, qty, stok_setelah, sumber, ref_id, keterangan)
  values (p_waktu, p_bahan_id, p_produk_id, p_qty, v_stok, p_sumber, p_ref_id, p_keterangan);

  return v_stok;
end;
$$;

-- =====================================================================
-- PURCHASE ORDER: draft -> dikirim -> diterima (atau dibatalkan)
-- =====================================================================

-- p_items: [{"bahan_id": 1, "qty": 10, "harga_satuan": 52000}, ...]
-- harga_satuan boleh kosong -> pakai harga di master bahan baku.
create function public.buat_po(
  p_supplier_id bigint,
  p_items       jsonb,
  p_sumber      public.sumber_po default 'manual',
  p_catatan     text default null,
  p_tanggal     date default public.hari_ini()
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint;
  v_n  integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'PO harus berisi minimal satu bahan';
  end if;

  insert into public.purchase_order (nomor, supplier_id, sumber, tanggal, catatan)
  values ('PO-' || to_char(p_tanggal, 'YYMMDD') || '-' || lpad(nextval('public.nomor_po_seq')::text, 4, '0'),
          p_supplier_id, p_sumber, p_tanggal, p_catatan)
  returning id into v_id;

  insert into public.po_item (po_id, bahan_id, qty, harga_satuan)
  select v_id, b.id, (e->>'qty')::numeric, coalesce((e->>'harga_satuan')::numeric, b.harga_satuan)
    from jsonb_array_elements(p_items) e
    join public.bahan_baku b on b.id = (e->>'bahan_id')::bigint;
  get diagnostics v_n = row_count;

  if v_n <> jsonb_array_length(p_items) then
    raise exception 'Ada bahan baku yang tidak dikenal di daftar PO';
  end if;
  return v_id;
end;
$$;

create function public.kirim_po(p_po_id bigint, p_tanggal date default public.hari_ini())
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_po public.purchase_order;
begin
  select * into v_po from public.purchase_order where id = p_po_id for update;
  if not found then raise exception 'PO id % tidak ditemukan', p_po_id; end if;
  if v_po.status <> 'draft' then
    raise exception 'PO % berstatus %, hanya PO draft yang bisa dikirim', v_po.nomor, v_po.status;
  end if;
  if not exists (select 1 from public.po_item where po_id = p_po_id) then
    raise exception 'PO % belum punya item', v_po.nomor;
  end if;
  update public.purchase_order
     set status = 'dikirim', tanggal_dikirim = greatest(p_tanggal, v_po.tanggal)
   where id = p_po_id;
end;
$$;

-- Barang dari supplier tiba di gudang bahan baku -> stok bahan bertambah.
create function public.terima_po(p_po_id bigint, p_tanggal date default public.hari_ini())
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_po    public.purchase_order;
  v_item  record;
  v_tgl   date;
begin
  select * into v_po from public.purchase_order where id = p_po_id for update;  -- cegah terima ganda
  if not found then raise exception 'PO id % tidak ditemukan', p_po_id; end if;
  if v_po.status <> 'dikirim' then
    raise exception 'PO % berstatus %, hanya PO yang sudah dikirim yang bisa diterima', v_po.nomor, v_po.status;
  end if;

  v_tgl := greatest(p_tanggal, v_po.tanggal_dikirim);
  for v_item in select bahan_id, qty from public.po_item where po_id = p_po_id order by id loop
    perform public._mutasi(v_item.bahan_id, null, v_item.qty, 'po', p_po_id,
                           'Terima ' || v_po.nomor, public._waktu(v_tgl));
  end loop;

  update public.purchase_order set status = 'diterima', tanggal_diterima = v_tgl where id = p_po_id;
end;
$$;

create function public.batalkan_po(p_po_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_po public.purchase_order;
begin
  select * into v_po from public.purchase_order where id = p_po_id for update;
  if not found then raise exception 'PO id % tidak ditemukan', p_po_id; end if;
  if v_po.status not in ('draft', 'dikirim') then
    raise exception 'PO % berstatus %, tidak bisa dibatalkan', v_po.nomor, v_po.status;
  end if;
  update public.purchase_order set status = 'dibatalkan' where id = p_po_id;
end;
$$;

-- =====================================================================
-- PRODUKSI: bahan berkurang sesuai BOM x qty, produk bertambah qty
-- =====================================================================
create function public.catat_produksi(
  p_produk_id bigint,
  p_qty       integer,
  p_catatan   text default null,
  p_tanggal   date default public.hari_ini()
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_id     bigint;
  v_nomor  text;
  v_kurang text;
  v_bom    record;
  v_waktu  timestamptz := public._waktu(p_tanggal);
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Jumlah produksi harus lebih dari 0';
  end if;
  if not exists (select 1 from public.bom where produk_id = p_produk_id) then
    raise exception 'Produk ini belum punya BOM, isi dulu bahan-bahannya';
  end if;

  -- Cek semua bahan sekaligus supaya pesan error menyebut SEMUA yang kurang.
  select string_agg(format('%s (butuh %s %s, ada %s)', b.nama,
                           round(m.qty_per_unit * p_qty, 2), b.satuan, b.stok), '; ' order by b.nama)
    into v_kurang
    from public.bom m join public.bahan_baku b on b.id = m.bahan_id
   where m.produk_id = p_produk_id and b.stok < m.qty_per_unit * p_qty;
  if v_kurang is not null then
    raise exception 'Bahan tidak cukup untuk produksi: %', v_kurang;
  end if;

  v_nomor := 'PRD-' || to_char(p_tanggal, 'YYMMDD') || '-' || lpad(nextval('public.nomor_produksi_seq')::text, 4, '0');
  insert into public.produksi (nomor, produk_id, qty, tanggal, catatan)
  values (v_nomor, p_produk_id, p_qty, p_tanggal, p_catatan)
  returning id into v_id;

  for v_bom in select bahan_id, qty_per_unit from public.bom where produk_id = p_produk_id order by id loop
    perform public._mutasi(v_bom.bahan_id, null, -(v_bom.qty_per_unit * p_qty), 'produksi', v_id,
                           'Pakai untuk ' || v_nomor, v_waktu);
  end loop;
  perform public._mutasi(null, p_produk_id, p_qty, 'produksi', v_id, 'Hasil ' || v_nomor, v_waktu);

  return v_id;
end;
$$;

-- =====================================================================
-- PESANAN RESELLER: diproses -> dikirim -> diterima (atau dibatalkan)
-- Stok produk berkurang saat DIKIRIM (barang keluar gudang barang jadi).
-- =====================================================================

-- p_items: [{"produk_id": 1, "qty": 20, "harga_satuan": 25000}, ...]
create function public.buat_pesanan(
  p_reseller_id bigint,
  p_items       jsonb,
  p_catatan     text default null,
  p_tanggal     date default public.hari_ini()
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint;
  v_n  integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Pesanan harus berisi minimal satu produk';
  end if;

  insert into public.pesanan (nomor, reseller_id, tanggal, catatan)
  values ('PSN-' || to_char(p_tanggal, 'YYMMDD') || '-' || lpad(nextval('public.nomor_pesanan_seq')::text, 4, '0'),
          p_reseller_id, p_tanggal, p_catatan)
  returning id into v_id;

  insert into public.pesanan_item (pesanan_id, produk_id, qty, harga_satuan)
  select v_id, p.id, (e->>'qty')::integer, coalesce((e->>'harga_satuan')::numeric, p.harga_jual)
    from jsonb_array_elements(p_items) e
    join public.produk p on p.id = (e->>'produk_id')::bigint;
  get diagnostics v_n = row_count;

  if v_n <> jsonb_array_length(p_items) then
    raise exception 'Ada produk yang tidak dikenal di daftar pesanan';
  end if;
  return v_id;
end;
$$;

create function public.kirim_pesanan(p_pesanan_id bigint, p_tanggal date default public.hari_ini())
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ps     public.pesanan;
  v_kurang text;
  v_item   record;
  v_tgl    date;
begin
  select * into v_ps from public.pesanan where id = p_pesanan_id for update;
  if not found then raise exception 'Pesanan id % tidak ditemukan', p_pesanan_id; end if;
  if v_ps.status <> 'diproses' then
    raise exception 'Pesanan % berstatus %, hanya pesanan diproses yang bisa dikirim', v_ps.nomor, v_ps.status;
  end if;

  select string_agg(format('%s (pesan %s, stok %s)', p.nama, i.qty, p.stok), '; ' order by p.nama)
    into v_kurang
    from public.pesanan_item i join public.produk p on p.id = i.produk_id
   where i.pesanan_id = p_pesanan_id and p.stok < i.qty;
  if v_kurang is not null then
    raise exception 'Stok produk tidak cukup untuk dikirim: %', v_kurang;
  end if;

  v_tgl := greatest(p_tanggal, v_ps.tanggal);
  for v_item in select produk_id, qty from public.pesanan_item where pesanan_id = p_pesanan_id order by id loop
    perform public._mutasi(null, v_item.produk_id, -v_item.qty, 'pesanan', p_pesanan_id,
                           'Kirim ' || v_ps.nomor, public._waktu(v_tgl));
  end loop;

  update public.pesanan set status = 'dikirim', tanggal_kirim = v_tgl where id = p_pesanan_id;
end;
$$;

create function public.terima_pesanan(p_pesanan_id bigint, p_tanggal date default public.hari_ini())
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ps public.pesanan;
begin
  select * into v_ps from public.pesanan where id = p_pesanan_id for update;
  if not found then raise exception 'Pesanan id % tidak ditemukan', p_pesanan_id; end if;
  if v_ps.status <> 'dikirim' then
    raise exception 'Pesanan % berstatus %, hanya pesanan yang sudah dikirim yang bisa diterima', v_ps.nomor, v_ps.status;
  end if;
  update public.pesanan set status = 'diterima', tanggal_terima = greatest(p_tanggal, v_ps.tanggal_kirim)
   where id = p_pesanan_id;
end;
$$;

-- Hanya pesanan yang belum dikirim yang bisa dibatalkan (stok belum keluar).
create function public.batalkan_pesanan(p_pesanan_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ps public.pesanan;
begin
  select * into v_ps from public.pesanan where id = p_pesanan_id for update;
  if not found then raise exception 'Pesanan id % tidak ditemukan', p_pesanan_id; end if;
  if v_ps.status <> 'diproses' then
    raise exception 'Pesanan % berstatus %, hanya pesanan diproses yang bisa dibatalkan', v_ps.nomor, v_ps.status;
  end if;
  update public.pesanan set status = 'dibatalkan' where id = p_pesanan_id;
end;
$$;

-- =====================================================================
-- STOK OPNAME: samakan stok sistem dengan hitungan fisik
-- =====================================================================
create function public.sesuaikan_stok(
  p_bahan_id    bigint,
  p_produk_id   bigint,
  p_stok_baru   numeric,
  p_keterangan  text default 'Stok opname'
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_stok numeric;
begin
  if (p_bahan_id is null) = (p_produk_id is null) then
    raise exception 'Isi tepat satu: bahan atau produk';
  end if;
  if p_stok_baru is null or p_stok_baru < 0 then
    raise exception 'Stok baru tidak boleh negatif';
  end if;
  if p_bahan_id is not null then
    select stok into v_stok from public.bahan_baku where id = p_bahan_id;
  else
    select stok into v_stok from public.produk where id = p_produk_id;
  end if;
  if not found then raise exception 'Barang tidak ditemukan'; end if;

  perform public._mutasi(p_bahan_id, p_produk_id, p_stok_baru - v_stok, 'penyesuaian', null,
                         coalesce(p_keterangan, 'Stok opname'), now());
end;
$$;

-- =====================================================================
-- PENJAGA: item PO hanya bisa diubah saat PO masih draft,
--          item pesanan hanya saat pesanan masih diproses.
-- =====================================================================
create function public._jaga_item_po()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_status public.status_po;
begin
  select status into v_status from public.purchase_order
   where id = coalesce(new.po_id, old.po_id);
  if v_status is distinct from 'draft' then
    raise exception 'Item PO tidak bisa diubah karena PO sudah berstatus %', v_status;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger jaga_item_po
  before insert or update or delete on public.po_item
  for each row execute function public._jaga_item_po();

create function public._jaga_item_pesanan()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_status public.status_pesanan;
begin
  select status into v_status from public.pesanan
   where id = coalesce(new.pesanan_id, old.pesanan_id);
  if v_status is distinct from 'diproses' then
    raise exception 'Item pesanan tidak bisa diubah karena pesanan sudah berstatus %', v_status;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger jaga_item_pesanan
  before insert or update or delete on public.pesanan_item
  for each row execute function public._jaga_item_pesanan();
