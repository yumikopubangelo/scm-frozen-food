import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { kodeBerikutnya } from "@/lib/format";
import { simpanBahan } from "../actions";
import { FormBahan } from "../form-bahan";

export const metadata: Metadata = { title: "Tambah bahan baku" };

export default async function BahanBaruPage() {
  const supabase = await createClient();
  const [{ data: kode }, { data: supplier }] = await Promise.all([
    supabase.from("bahan_baku").select("kode"),
    supabase.from("supplier").select("id, nama, lead_time_hari").order("nama"),
  ]);

  return (
    <div className="max-w-2xl">
      <Kembali href="/bahan-baku">Daftar bahan baku</Kembali>
      <JudulHalaman
        judul="Tambah bahan baku"
        deskripsi="Stok awal bahan baru = 0. Isi stok lewat penerimaan PO atau stok opname setelah disimpan."
      />
      <FormBahan
        aksi={simpanBahan.bind(null, null)}
        awal={{ kode: kodeBerikutnya((kode ?? []).map((r) => r.kode), "BB-") }}
        supplier={supplier ?? []}
      />
    </div>
  );
}
