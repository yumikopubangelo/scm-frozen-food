import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { kodeBerikutnya } from "@/lib/format";
import { simpanProduk } from "../actions";
import { FormProduk } from "../form-produk";

export const metadata: Metadata = { title: "Tambah produk" };

export default async function ProdukBaruPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("produk").select("kode");

  return (
    <div className="max-w-2xl">
      <Kembali href="/produk">Daftar produk</Kembali>
      <JudulHalaman judul="Tambah produk" deskripsi="Setelah disimpan, Anda diarahkan ke halaman produk untuk mengisi resep (BOM)." />
      <FormProduk aksi={simpanProduk.bind(null, null)} awal={{ kode: kodeBerikutnya((data ?? []).map((r) => r.kode), "PJ-") }} />
    </div>
  );
}
