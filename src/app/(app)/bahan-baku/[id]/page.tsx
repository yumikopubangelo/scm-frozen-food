import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JudulHalaman } from "@/components/judul-halaman";
import { StokOpname } from "@/components/stok-opname";
import { TombolHapus } from "@/components/tombol-hapus";
import { BadgeStok, Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { sesuaikanStok } from "@/lib/aksi-stok";
import { angka } from "@/lib/format";
import { cekGalatMuat } from "@/lib/galat-db";
import type { BahanBaku } from "@/lib/tipe";
import { hapusBahan, simpanBahan } from "../actions";
import { FormBahan } from "../form-bahan";

export const metadata: Metadata = { title: "Ubah bahan baku" };

export default async function BahanDetailPage({ params }: PageProps<"/bahan-baku/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [{ data: b, error: e1 }, { data: supplier, error: e2 }, { data: dipakai, error: e3 }] = await Promise.all([
    supabase.from("bahan_baku").select("*").eq("id", id).maybeSingle<BahanBaku>(),
    supabase.from("supplier").select("id, nama, lead_time_hari").order("nama"),
    supabase.from("bom").select("qty_per_unit, produk(id, nama)").eq("bahan_id", id),
  ]);
  cekGalatMuat(e1, e2, e3);
  if (!b) notFound();
  const dipakaiDi = (dipakai ?? []) as unknown as { qty_per_unit: number; produk: { id: number; nama: string } }[];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Kembali href="/bahan-baku">Daftar bahan baku</Kembali>
        <JudulHalaman
          judul={b.nama}
          deskripsi={`Kode ${b.kode} · stok ${angka(b.stok)} ${b.satuan}`}
          aksi={<TombolHapus aksi={hapusBahan.bind(null, id)} nama={`bahan ${b.nama}`} />}
        />
        <div className="-mt-3 mb-4">
          <BadgeStok stok={Number(b.stok)} batas={Number(b.reorder_point)} />
        </div>
        <FormBahan aksi={simpanBahan.bind(null, id)} awal={b} supplier={supplier ?? []} />
      </div>

      <StokOpname
        aksi={sesuaikanStok.bind(null, { jenis: "bahan", id, path: `/bahan-baku/${id}` })}
        stok={Number(b.stok)}
        satuan={b.satuan}
      />

      <section className="card p-5">
        <h2 className="text-base font-semibold">Dipakai di resep ({dipakaiDi.length} produk)</h2>
        {dipakaiDi.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Belum dipakai di BOM produk mana pun.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {dipakaiDi.map((d) => (
              <li key={d.produk.id} className="flex justify-between gap-3 py-2 text-sm">
                <Link href={`/produk/${d.produk.id}`} className="text-sky-700 hover:underline">
                  {d.produk.nama}
                </Link>
                <span className="tabular-nums text-slate-600">
                  {angka(d.qty_per_unit)} {b.satuan} / pak
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
