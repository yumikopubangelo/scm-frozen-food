import Link from "next/link";
import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Badge, BadgeStok, BannerOk, Pencarian, Tabel, TabelKosong, TombolTambah } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { filterCari, paramTeks } from "@/lib/cari";
import { angka, rupiah } from "@/lib/format";
import { biayaBahanPerPak, kapasitasProduksi } from "@/lib/hitung-produk";
import type { Produk } from "@/lib/tipe";

export const metadata: Metadata = { title: "Produk & BOM" };

type Baris = Produk & { bom: { qty_per_unit: number; bahan_baku: { stok: number; harga_satuan: number } | null }[] };

export default async function ProdukPage({ searchParams }: PageProps<"/produk">) {
  const sp = await searchParams;
  const q = paramTeks(sp.q);

  const supabase = await createClient();
  // Satu query: produk + resepnya + stok & harga tiap bahan (embed relasi PostgREST)
  let query = supabase.from("produk").select("*, bom(qty_per_unit, bahan_baku(stok, harga_satuan))").order("kode");
  const filter = filterCari(q, ["kode", "nama"]);
  if (filter) query = query.or(filter);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const daftar = (data ?? []) as Baris[];

  return (
    <>
      <JudulHalaman
        judul="Produk & BOM"
        deskripsi="Gudang barang jadi. Klik produk untuk mengatur resepnya (Bill of Materials)."
        aksi={<TombolTambah href="/produk/baru">Tambah produk</TombolTambah>}
      />
      <BannerOk ok={sp.ok} />
      <Pencarian q={q} placeholder="Cari kode atau nama produk" />
      <Tabel>
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama</th>
            <th className="text-right">Stok</th>
            <th>Status</th>
            <th className="text-right">Harga jual</th>
            <th className="text-right" title="Biaya bahan per pak, dari BOM">Biaya bahan</th>
            <th className="text-right">Margin</th>
            <th className="text-right" title="Maksimum pak yang bisa diproduksi dari stok bahan sekarang">Bisa diproduksi</th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((p) => {
            const biaya = biayaBahanPerPak(p.bom);
            const margin = Number(p.harga_jual) - biaya;
            const persen = Number(p.harga_jual) > 0 ? (margin / Number(p.harga_jual)) * 100 : 0;
            const kapasitas = kapasitasProduksi(p.bom);
            return (
              <tr key={p.id}>
                <td className="whitespace-nowrap font-mono text-xs text-slate-500">{p.kode}</td>
                <td className="min-w-44">
                  <Link href={`/produk/${p.id}`} className="font-medium text-sky-700 hover:underline">
                    {p.nama}
                  </Link>
                  <p className="text-xs text-slate-500">{p.bom.length} bahan di resep</p>
                </td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {angka(p.stok)} <span className="text-xs text-slate-500">{p.satuan}</span>
                </td>
                <td>
                  <BadgeStok stok={p.stok} batas={p.stok_minimum} />
                </td>
                <td className="whitespace-nowrap text-right tabular-nums">{rupiah(p.harga_jual)}</td>
                <td className="whitespace-nowrap text-right tabular-nums text-slate-600">{p.bom.length ? rupiah(biaya) : "–"}</td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {p.bom.length ? (
                    <span className={margin < 0 ? "text-red-600" : ""}>{persen.toFixed(0)}%</span>
                  ) : (
                    "–"
                  )}
                </td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {kapasitas === null ? <Badge warna="kuning">BOM kosong</Badge> : `${angka(kapasitas)} ${p.satuan}`}
                </td>
              </tr>
            );
          })}
          {daftar.length === 0 && (
            <TabelKosong kolom={8}>{q ? `Tidak ada produk yang cocok dengan "${q}".` : "Belum ada produk."}</TabelKosong>
          )}
        </tbody>
      </Tabel>
      <p className="mt-3 text-xs text-slate-500">
        Biaya bahan = Σ (jumlah per pak × harga bahan), belum termasuk tenaga kerja, listrik/freezer, dan susut.
        &quot;Bisa diproduksi&quot; = stok bahan yang paling cepat habis dibagi kebutuhannya per pak.
      </p>
    </>
  );
}
