import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { paramTeks } from "@/lib/cari";
import { cekGalatMuat } from "@/lib/galat-db";
import { buatPesanan } from "../actions";
import { FormPesanan } from "../form-pesanan";

export const metadata: Metadata = { title: "Catat pesanan" };

export default async function PesananBaruPage({ searchParams }: PageProps<"/pesanan/baru">) {
  const resellerAwal = Number(paramTeks((await searchParams).reseller)) || undefined;
  const supabase = await createClient();
  const [{ data: reseller, error: e1 }, { data: produk, error: e2 }] = await Promise.all([
    supabase.from("reseller").select("id, nama, kota, tipe").order("nama"),
    supabase.from("produk").select("id, nama, satuan, harga_jual, stok").order("kode"),
  ]);
  cekGalatMuat(e1, e2);

  return (
    <div className="max-w-4xl">
      <Kembali href="/pesanan">Daftar pesanan</Kembali>
      <JudulHalaman judul="Catat pesanan reseller" deskripsi="Pesanan masuk dari reseller atau toko." />
      <FormPesanan aksi={buatPesanan} reseller={reseller ?? []} produk={produk ?? []} awalReseller={resellerAwal} />
    </div>
  );
}
