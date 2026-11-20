import Link from "next/link";
import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Badge, BannerOk, Pencarian, Tabel, TabelKosong, TombolTambah } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { filterCari, paramTeks } from "@/lib/cari";
import type { Reseller } from "@/lib/tipe";

export const metadata: Metadata = { title: "Reseller" };

export default async function ResellerPage({ searchParams }: PageProps<"/reseller">) {
  const sp = await searchParams;
  const q = paramTeks(sp.q);
  const tipe = paramTeks(sp.tipe);

  const supabase = await createClient();
  let query = supabase.from("reseller").select("*").order("kode");
  const filter = filterCari(q, ["kode", "nama", "kota", "alamat"]);
  if (filter) query = query.or(filter);
  if (tipe === "reseller" || tipe === "toko") query = query.eq("tipe", tipe);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const daftar = (data ?? []) as Reseller[];

  return (
    <>
      <JudulHalaman
        judul="Reseller"
        deskripsi="Reseller dan toko tujuan distribusi barang jadi."
        aksi={<TombolTambah href="/reseller/baru">Tambah reseller</TombolTambah>}
      />
      <BannerOk ok={sp.ok} />
      <Pencarian q={q} placeholder="Cari kode, nama, kota">
        <select name="tipe" defaultValue={tipe} className="input sm:w-40" aria-label="Filter tipe">
          <option value="">Semua tipe</option>
          <option value="reseller">Reseller</option>
          <option value="toko">Toko</option>
        </select>
      </Pencarian>
      <Tabel>
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama</th>
            <th>Tipe</th>
            <th>Kota</th>
            <th>Telepon</th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap font-mono text-xs text-slate-500">{r.kode}</td>
              <td>
                <Link href={`/reseller/${r.id}`} className="font-medium text-sky-700 hover:underline">
                  {r.nama}
                </Link>
                {r.alamat && <p className="text-xs text-slate-500">{r.alamat}</p>}
              </td>
              <td>
                <Badge warna={r.tipe === "toko" ? "biru" : "abu"}>{r.tipe === "toko" ? "Toko" : "Reseller"}</Badge>
              </td>
              <td>{r.kota ?? "–"}</td>
              <td className="whitespace-nowrap">{r.telepon ?? "–"}</td>
            </tr>
          ))}
          {daftar.length === 0 && (
            <TabelKosong kolom={5}>{q || tipe ? "Tidak ada reseller yang cocok dengan filter." : "Belum ada reseller."}</TabelKosong>
          )}
        </tbody>
      </Tabel>
    </>
  );
}
