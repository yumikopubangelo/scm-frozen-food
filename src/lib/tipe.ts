// Bentuk baris tabel database (lihat supabase/migrations/0001_skema.sql).
// Kolom numeric dari Postgres dikirim PostgREST sebagai number di JSON.

export type Supplier = {
  id: number;
  kode: string;
  nama: string;
  kontak: string | null;
  telepon: string | null;
  alamat: string | null;
  lead_time_hari: number;
};

export type BahanBaku = {
  id: number;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  reorder_point: number;
  harga_satuan: number;
  supplier_id: number | null;
};

export type Produk = {
  id: number;
  kode: string;
  nama: string;
  satuan: string;
  harga_jual: number;
  stok: number;
  stok_minimum: number;
};

export type Reseller = {
  id: number;
  kode: string;
  nama: string;
  tipe: "reseller" | "toko";
  telepon: string | null;
  alamat: string | null;
  kota: string | null;
};

export type BarisBom = {
  id: number;
  qty_per_unit: number;
  bahan_baku: Pick<BahanBaku, "id" | "kode" | "nama" | "satuan" | "harga_satuan" | "stok">;
};

/** Pilihan satuan bahan baku di form. */
export const SATUAN_BAHAN = ["kg", "gram", "liter", "lembar", "pcs", "ikat"] as const;
