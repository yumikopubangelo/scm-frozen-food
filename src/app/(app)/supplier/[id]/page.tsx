import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JudulHalaman } from "@/components/judul-halaman";
import { TombolHapus } from "@/components/tombol-hapus";
import { BadgeStok, Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { angka } from "@/lib/format";
import { cekGalatMuat } from "@/lib/galat-db";
import type { BahanBaku, Supplier } from "@/lib/tipe";
import { hapusSupplier, simpanSupplier } from "../actions";
import { FormSupplier } from "../form-supplier";

export const metadata: Metadata = { title: "Ubah supplier" };

export default async function SupplierDetailPage({ params }: PageProps<"/supplier/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [{ data: s, error: e1 }, { data: bahan, error: e2 }] = await Promise.all([
    supabase.from("supplier").select("*").eq("id", id).maybeSingle<Supplier>(),
    supabase.from("bahan_baku").select("id, kode, nama, satuan, stok, reorder_point").eq("supplier_id", id).order("kode"),
  ]);
  cekGalatMuat(e1, e2);
  if (!s) notFound();
  const daftarBahan = (bahan ?? []) as Pick<BahanBaku, "id" | "kode" | "nama" | "satuan" | "stok" | "reorder_point">[];

  return (
    <div className="max-w-2xl">
      <Kembali href="/supplier">Daftar supplier</Kembali>
      <JudulHalaman
        judul={s.nama}
        deskripsi={`Kode ${s.kode}`}
        aksi={<TombolHapus aksi={hapusSupplier.bind(null, id)} nama={`supplier ${s.nama}`} />}
      />
      <FormSupplier aksi={simpanSupplier.bind(null, id)} awal={s} />

      <section className="card mt-6 p-5">
        <h2 className="text-base font-semibold">Bahan yang dipasok ({daftarBahan.length})</h2>
        {daftarBahan.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Belum ada bahan yang memakai supplier ini sebagai supplier utama.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {daftarBahan.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/bahan-baku/${b.id}`} className="text-sky-700 hover:underline">
                  {b.nama}
                </Link>
                <span className="flex items-center gap-2 tabular-nums text-slate-600">
                  {angka(b.stok)} {b.satuan}
                  <BadgeStok stok={Number(b.stok)} batas={Number(b.reorder_point)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
