import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { kodeBerikutnya } from "@/lib/format";
import { simpanSupplier } from "../actions";
import { FormSupplier } from "../form-supplier";

export const metadata: Metadata = { title: "Tambah supplier" };

export default async function SupplierBaruPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("supplier").select("kode");
  const kode = kodeBerikutnya((data ?? []).map((r) => r.kode), "SUP-");

  return (
    <div className="max-w-2xl">
      <Kembali href="/supplier">Daftar supplier</Kembali>
      <JudulHalaman judul="Tambah supplier" />
      <FormSupplier aksi={simpanSupplier.bind(null, null)} awal={{ kode }} />
    </div>
  );
}
