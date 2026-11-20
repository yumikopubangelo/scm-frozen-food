import Link from "next/link";
import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { BadgeStok, BannerOk, Pencarian, Tabel, TabelKosong, TombolTambah } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { filterCari, paramTeks } from "@/lib/cari";
import { angka, rupiah } from "@/lib/format";
import type { BahanBaku } from "@/lib/tipe";

export const metadata: Metadata = { title: "Bahan baku" };

type Baris = BahanBaku & { supplier: { nama: string } | null };

export default async function BahanBakuPage({ searchParams }: PageProps<"/bahan-baku">) {
  const sp = await searchParams;
  const q = paramTeks(sp.q);
  const hanyaKritis = paramTeks(sp.kritis) === "1";

  const supabase = await createClient();
  let query = supabase.from("bahan_baku").select("*, supplier(nama)").order("kode");
  const filter = filterCari(q, ["kode", "nama"]);
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let daftar = (data ?? []) as Baris[];
  // stok < reorder_point membandingkan dua kolom -> tidak bisa di filter PostgREST, disaring di sini
  if (hanyaKritis) daftar = daftar.filter((b) => Number(b.stok) < Number(b.reorder_point));
  const nilaiStok = daftar.reduce((s, b) => s + Number(b.stok) * Number(b.harga_satuan), 0);

  return (
    <>
      <JudulHalaman
        judul="Bahan baku"
        deskripsi={`Gudang bahan baku · nilai persediaan ${rupiah(nilaiStok)}${hanyaKritis ? " (yang ditampilkan)" : ""}`}
        aksi={<TombolTambah href="/bahan-baku/baru">Tambah bahan</TombolTambah>}
      />
      <BannerOk ok={sp.ok} />
      <Pencarian q={q} placeholder="Cari kode atau nama bahan">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="kritis" value="1" defaultChecked={hanyaKritis} className="size-4 accent-sky-600" />
          Hanya di bawah reorder point
        </label>
      </Pencarian>
      <Tabel>
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama</th>
            <th className="text-right">Stok</th>
            <th className="text-right">Reorder point</th>
            <th>Status</th>
            <th className="text-right">Harga</th>
            <th>Supplier utama</th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((b) => (
            <tr key={b.id}>
              <td className="whitespace-nowrap font-mono text-xs text-slate-500">{b.kode}</td>
              <td className="min-w-44">
                <Link href={`/bahan-baku/${b.id}`} className="font-medium text-sky-700 hover:underline">
                  {b.nama}
                </Link>
              </td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {angka(b.stok)} <span className="text-xs text-slate-500">{b.satuan}</span>
              </td>
              <td className="whitespace-nowrap text-right tabular-nums text-slate-600">{angka(b.reorder_point)}</td>
              <td>
                <BadgeStok stok={Number(b.stok)} batas={Number(b.reorder_point)} />
              </td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {rupiah(b.harga_satuan)}
                <span className="text-xs text-slate-500">/{b.satuan}</span>
              </td>
              <td className="text-slate-600">{b.supplier?.nama ?? "–"}</td>
            </tr>
          ))}
          {daftar.length === 0 && (
            <TabelKosong kolom={7}>
              {hanyaKritis ? "Tidak ada bahan di bawah reorder point." : q ? `Tidak ada bahan yang cocok dengan "${q}".` : "Belum ada bahan baku."}
            </TabelKosong>
          )}
        </tbody>
      </Tabel>
    </>
  );
}
