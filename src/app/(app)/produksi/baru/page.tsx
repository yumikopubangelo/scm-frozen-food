import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { paramTeks } from "@/lib/cari";
import { hariIni } from "@/lib/format";
import { catatProduksi } from "../actions";
import { FormProduksi, type ProdukDenganBom } from "../form-produksi";

export const metadata: Metadata = { title: "Catat produksi" };

export default async function ProduksiBaruPage({ searchParams }: PageProps<"/produksi/baru">) {
  const produkAwal = Number(paramTeks((await searchParams).produk)) || undefined;
  const supabase = await createClient();
  const { data } = await supabase
    .from("produk")
    .select("id, kode, nama, satuan, stok, stok_minimum, bom(qty_per_unit, bahan_baku(id, nama, satuan, stok, harga_satuan))")
    .order("kode");

  return (
    <div className="max-w-3xl">
      <Kembali href="/produksi">Riwayat produksi</Kembali>
      <JudulHalaman
        judul="Catat produksi"
        deskripsi="Bahan baku berkurang sesuai resep (BOM), stok produk jadi bertambah."
      />
      <FormProduksi aksi={catatProduksi} produk={(data ?? []) as unknown as ProdukDenganBom[]} awalProduk={produkAwal} hari={hariIni()} />
    </div>
  );
}
