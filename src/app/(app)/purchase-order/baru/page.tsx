import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { paramTeks } from "@/lib/cari";
import { buatPo } from "../actions";
import { FormPo } from "../form-po";

export const metadata: Metadata = { title: "Buat PO" };

export default async function PoBaruPage({ searchParams }: PageProps<"/purchase-order/baru">) {
  const supplierAwal = Number(paramTeks((await searchParams).supplier)) || undefined;
  const supabase = await createClient();
  const [{ data: supplier }, { data: bahan }] = await Promise.all([
    supabase.from("supplier").select("id, nama, lead_time_hari").order("nama"),
    supabase.from("bahan_baku").select("id, nama, satuan, harga_satuan, stok, reorder_point, supplier_id").order("nama"),
  ]);

  return (
    <div className="max-w-4xl">
      <Kembali href="/purchase-order">Daftar PO</Kembali>
      <JudulHalaman judul="Buat purchase order" deskripsi="Pesan bahan baku ke satu supplier." />
      <FormPo aksi={buatPo} supplier={supplier ?? []} bahan={bahan ?? []} awalSupplier={supplierAwal} />
    </div>
  );
}
