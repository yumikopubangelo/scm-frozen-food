import Link from "next/link";
import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { BannerOk, Pencarian, Tabel, TabelKosong, TombolTambah } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { filterCari, paramTeks } from "@/lib/cari";
import type { Supplier } from "@/lib/tipe";

export const metadata: Metadata = { title: "Supplier" };

export default async function SupplierPage({ searchParams }: PageProps<"/supplier">) {
  const sp = await searchParams;
  const q = paramTeks(sp.q);

  const supabase = await createClient();
  let query = supabase.from("supplier").select("*, bahan_baku(count)").order("kode");
  const filter = filterCari(q, ["kode", "nama", "kontak", "alamat"]);
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const daftar = (data ?? []) as (Supplier & { bahan_baku: { count: number }[] })[];

  return (
    <>
      <JudulHalaman
        judul="Supplier"
        deskripsi="Pemasok bahan baku beserta lead time pengirimannya."
        aksi={<TombolTambah href="/supplier/baru">Tambah supplier</TombolTambah>}
      />
      <BannerOk ok={sp.ok} />
      <Pencarian q={q} placeholder="Cari kode, nama, kontak, alamat" />
      <Tabel>
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama</th>
            <th>Kontak</th>
            <th className="text-right">Lead time</th>
            <th className="text-right">Bahan dipasok</th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((s) => (
            <tr key={s.id}>
              <td className="whitespace-nowrap font-mono text-xs text-slate-500">{s.kode}</td>
              <td>
                <Link href={`/supplier/${s.id}`} className="font-medium text-sky-700 hover:underline">
                  {s.nama}
                </Link>
                {s.alamat && <p className="text-xs text-slate-500">{s.alamat}</p>}
              </td>
              <td>
                {s.kontak ?? "–"}
                {s.telepon && <p className="whitespace-nowrap text-xs text-slate-500">{s.telepon}</p>}
              </td>
              <td className="whitespace-nowrap text-right tabular-nums">{s.lead_time_hari} hari</td>
              <td className="text-right tabular-nums">{s.bahan_baku[0]?.count ?? 0}</td>
            </tr>
          ))}
          {daftar.length === 0 && (
            <TabelKosong kolom={5}>{q ? `Tidak ada supplier yang cocok dengan "${q}".` : "Belum ada supplier."}</TabelKosong>
          )}
        </tbody>
      </Tabel>
    </>
  );
}
