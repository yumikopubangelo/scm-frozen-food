-- =====================================================================
-- 0001_skema.sql — tabel inti SCM Galunggung Frozen Food
-- Alur: supplier -> gudang bahan baku -> produksi -> gudang barang jadi -> reseller
-- Gudang bahan baku  = kolom bahan_baku.stok
-- Gudang barang jadi = kolom produk.stok
-- Semua perubahan stok tercatat di mutasi_stok (lihat 0002_fungsi_stok.sql)
-- =====================================================================

-- ---------- Tipe enum (nilai status yang boleh) ----------
create type public.status_po      as enum ('draft', 'dikirim', 'diterima', 'dibatalkan');
create type public.status_pesanan as enum ('diproses', 'dikirim', 'diterima', 'dibatalkan');
create type public.sumber_po      as enum ('manual', 'agen');
create type public.sumber_mutasi  as enum ('saldo_awal', 'po', 'produksi', 'pesanan', 'penyesuaian');
create type public.tipe_reseller  as enum ('reseller', 'toko');

-- ---------- Master data ----------
create table public.supplier (
  id              bigint generated always as identity primary key,
  kode            text not null unique,
  nama            text not null,
  kontak          text,
  telepon         text,
  alamat          text,
  lead_time_hari  integer not null default 2 check (lead_time_hari >= 0),
  created_at      timestamptz not null default now()
);

create table public.bahan_baku (
  id             bigint generated always as identity primary key,
  kode           text not null unique,
  nama           text not null,
  satuan         text not null,                       -- kg, liter, lembar, pcs
  stok           numeric(12,2) not null default 0 check (stok >= 0),
  reorder_point  numeric(12,2) not null default 0 check (reorder_point >= 0),
  harga_satuan   numeric(12,2) not null default 0 check (harga_satuan >= 0),
  supplier_id    bigint references public.supplier(id) on delete set null,  -- supplier utama
  created_at     timestamptz not null default now()
);

create table public.produk (
  id            bigint generated always as identity primary key,
  kode          text not null unique,
  nama          text not null,
  satuan        text not null default 'pak',
  harga_jual    numeric(12,2) not null default 0 check (harga_jual >= 0),
  stok          integer not null default 0 check (stok >= 0),
  stok_minimum  integer not null default 0 check (stok_minimum >= 0),
  created_at    timestamptz not null default now()
);

create table public.reseller (
  id          bigint generated always as identity primary key,
  kode        text not null unique,
  nama        text not null,
  tipe        public.tipe_reseller not null default 'reseller',
  telepon     text,
  alamat      text,
  kota        text,
  created_at  timestamptz not null default now()
);

-- Bill of Materials: 1 pak produk butuh qty_per_unit satuan bahan
create table public.bom (
  id            bigint generated always as identity primary key,
  produk_id     bigint not null references public.produk(id) on delete cascade,
  bahan_id      bigint not null references public.bahan_baku(id) on delete restrict,
  qty_per_unit  numeric(12,4) not null check (qty_per_unit > 0),
  created_at    timestamptz not null default now(),
  unique (produk_id, bahan_id)
);

-- ---------- Pembelian (Purchase Order) ----------
create sequence public.nomor_po_seq;

create table public.purchase_order (
  id                bigint generated always as identity primary key,
  nomor             text not null unique,             -- PO-YYMMDD-0001 (dibuat fungsi buat_po)
  supplier_id       bigint not null references public.supplier(id) on delete restrict,
  status            public.status_po not null default 'draft',
  sumber            public.sumber_po not null default 'manual',
  tanggal           date not null,
  tanggal_dikirim   date,
  tanggal_diterima  date,
  catatan           text,
  created_at        timestamptz not null default now()
);

create table public.po_item (
  id            bigint generated always as identity primary key,
  po_id         bigint not null references public.purchase_order(id) on delete cascade,
  bahan_id      bigint not null references public.bahan_baku(id) on delete restrict,
  qty           numeric(12,2) not null check (qty > 0),
  harga_satuan  numeric(12,2) not null default 0 check (harga_satuan >= 0),
  created_at    timestamptz not null default now(),
  unique (po_id, bahan_id)
);

-- ---------- Produksi ----------
create sequence public.nomor_produksi_seq;

create table public.produksi (
  id          bigint generated always as identity primary key,
  nomor       text not null unique,                   -- PRD-YYMMDD-0001
  produk_id   bigint not null references public.produk(id) on delete restrict,
  qty         integer not null check (qty > 0),
  tanggal     date not null,
  catatan     text,
  created_at  timestamptz not null default now()
);

-- ---------- Pesanan reseller & pengiriman ----------
create sequence public.nomor_pesanan_seq;

create table public.pesanan (
  id              bigint generated always as identity primary key,
  nomor           text not null unique,               -- PSN-YYMMDD-0001
  reseller_id     bigint not null references public.reseller(id) on delete restrict,
  status          public.status_pesanan not null default 'diproses',
  tanggal         date not null,
  tanggal_kirim   date,
  tanggal_terima  date,
  catatan         text,
  created_at      timestamptz not null default now()
);

create table public.pesanan_item (
  id            bigint generated always as identity primary key,
  pesanan_id    bigint not null references public.pesanan(id) on delete cascade,
  produk_id     bigint not null references public.produk(id) on delete restrict,
  qty           integer not null check (qty > 0),
  harga_satuan  numeric(12,2) not null default 0 check (harga_satuan >= 0),
  created_at    timestamptz not null default now(),
  unique (pesanan_id, produk_id)
);

-- ---------- Buku besar stok ----------
-- Satu baris = satu pergerakan. Tepat satu dari bahan_id / produk_id terisi.
create table public.mutasi_stok (
  id            bigint generated always as identity primary key,
  waktu         timestamptz not null default now(),
  bahan_id      bigint references public.bahan_baku(id) on delete cascade,
  produk_id     bigint references public.produk(id) on delete cascade,
  qty           numeric(12,2) not null check (qty <> 0),   -- + masuk, - keluar
  stok_setelah  numeric(12,2) not null,
  sumber        public.sumber_mutasi not null,
  ref_id        bigint,                                     -- id PO / produksi / pesanan
  keterangan    text,
  check ((bahan_id is null) <> (produk_id is null))
);

-- ---------- Agen restock & ramalan ----------
create table public.forecast_permintaan (
  id           bigint generated always as identity primary key,
  produk_id    bigint not null references public.produk(id) on delete cascade,
  tanggal      date not null,
  qty          numeric(12,2) not null check (qty >= 0),
  sumber       text not null check (sumber in ('rata-rata', 's4')),
  created_at   timestamptz not null default now(),
  unique (produk_id, tanggal, sumber)
);

create table public.agen_log (
  id                bigint generated always as identity primary key,
  waktu             timestamptz not null default now(),
  ringkasan         jsonb not null,
  jumlah_po_dibuat  integer not null default 0
);

-- ---------- Indeks untuk kolom yang sering dicari/di-join ----------
create index on public.bahan_baku (supplier_id);
create index on public.bom (bahan_id);
create index on public.purchase_order (status);
create index on public.purchase_order (supplier_id);
create index on public.po_item (po_id);
create index on public.po_item (bahan_id);
create index on public.produksi (produk_id, tanggal);
create index on public.pesanan (status);
create index on public.pesanan (reseller_id);
create index on public.pesanan (tanggal);
create index on public.pesanan_item (pesanan_id);
create index on public.pesanan_item (produk_id);
create index on public.mutasi_stok (waktu);
create index on public.mutasi_stok (bahan_id, waktu);
create index on public.mutasi_stok (produk_id, waktu);
