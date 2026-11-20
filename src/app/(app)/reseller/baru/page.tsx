import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { kodeBerikutnya } from "@/lib/format";
import { simpanReseller } from "../actions";
import { FormReseller } from "../form-reseller";

export const metadata: Metadata = { title: "Tambah reseller" };

export default async function ResellerBaruPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("reseller").select("kode, kota");
  const baris = data ?? [];
  const kode = kodeBerikutnya(baris.map((r) => r.kode), "RSL-");
  const daftarKota = [...new Set(baris.map((r) => r.kota).filter(Boolean))].sort() as string[];

  return (
    <div className="max-w-2xl">
      <Kembali href="/reseller">Daftar reseller</Kembali>
      <JudulHalaman judul="Tambah reseller" />
      <FormReseller aksi={simpanReseller.bind(null, null)} awal={{ kode }} daftarKota={daftarKota} />
    </div>
  );
}
