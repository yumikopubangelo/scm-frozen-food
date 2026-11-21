import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JudulHalaman } from "@/components/judul-halaman";
import { BannerOk, Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { angka, rupiah, tanggal } from "@/lib/format";
import { cekGalatMuat } from "@/lib/galat-db";

export const metadata: Metadata = { title: "Detail produksi" };

type Produksi = {
  id: number;
  nomor: string;
  tanggal: string;
  qty: number;
  catatan: string | null;
  produk: { id: number; nama: string; satuan: string; harga_jual: number };
};
type Mutasi = {
  qty: number;
  stok_setelah: number;
  bahan_baku: { id: number; nama: string; satuan: string; harga_satuan: number } | null;
  produk: { nama: string; satuan: string } | null;
};

export default async function ProduksiDetailPage({ params, searchParams }: PageProps<"/produksi/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;

  const supabase = await createClient();
  const [{ data, error: e1 }, { data: mutasi, error: e2 }] = await Promise.all([
    supabase.from("produksi").select("id, nomor, tanggal, qty, catatan, produk(id, nama, satuan, harga_jual)").eq("id", id).maybeSingle(),
    supabase
      .from("mutasi_stok")
      .select("qty, stok_setelah, bahan_baku(id, nama, satuan, harga_satuan), produk(nama, satuan)")
      .eq("sumber", "produksi")
      .eq("ref_id", id)
      .order("id"),
  ]);
  cekGalatMuat(e1, e2);
  if (!data) notFound();
  const pr = data as unknown as Produksi;
  const baris = (mutasi ?? []) as unknown as Mutasi[];
  const bahanKeluar = baris.filter((m) => m.bahan_baku);
  const produkMasuk = baris.find((m) => m.produk);
  // Perkiraan biaya bahan memakai harga master SAAT INI (harga historis tidak disimpan)
  const biaya = bahanKeluar.reduce((s, m) => s + Math.abs(Number(m.qty)) * Number(m.bahan_baku!.harga_satuan), 0);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Kembali href="/produksi">Riwayat produksi</Kembali>
        <JudulHalaman
          judul={pr.nomor}
          deskripsi={`${tanggal(pr.tanggal)} · ${angka(pr.qty)} ${pr.produk.satuan} ${pr.produk.nama}`}
        />
        <BannerOk ok={sp.ok} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Hasil produksi</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            +{angka(pr.qty)} {pr.produk.satuan}
          </p>
          {produkMasuk && (
            <p className="text-xs text-slate-500">
              stok menjadi {angka(produkMasuk.stok_setelah)} {pr.produk.satuan}
            </p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Perkiraan biaya bahan</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{rupiah(biaya)}</p>
          <p className="text-xs text-slate-500">≈ {rupiah(biaya / pr.qty)} per {pr.produk.satuan}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Nilai jual hasil</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{rupiah(pr.qty * Number(pr.produk.harga_jual))}</p>
          <p className="text-xs text-slate-500">harga jual {rupiah(pr.produk.harga_jual)}</p>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="text-base font-semibold">Bahan yang terpakai ({bahanKeluar.length})</h2>
        <p className="mb-3 mt-1 text-sm text-slate-500">Dicatat di buku besar mutasi stok sebagai keluar dari gudang bahan baku.</p>
        <div className="overflow-x-auto">
          <table className="tabel">
            <thead>
              <tr>
                <th>Bahan</th>
                <th className="text-right">Keluar</th>
                <th className="text-right">Stok sesudahnya</th>
              </tr>
            </thead>
            <tbody>
              {bahanKeluar.map((m, i) => (
                <tr key={i}>
                  <td>
                    <Link href={`/bahan-baku/${m.bahan_baku!.id}`} className="text-sky-700 hover:underline">
                      {m.bahan_baku!.nama}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums text-red-700">
                    {angka(m.qty)} {m.bahan_baku!.satuan}
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums">
                    {angka(m.stok_setelah)} {m.bahan_baku!.satuan}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pr.catatan && <p className="mt-3 text-sm text-slate-600">Catatan: {pr.catatan}</p>}
        <p className="mt-3 text-xs text-slate-500">
          Biaya memakai harga bahan saat ini; harga pada tanggal produksi tidak disimpan terpisah.
        </p>
      </section>

      <div className="flex gap-2">
        <Link href={`/produksi/baru?produk=${pr.produk.id}`} className="btn-secondary">
          Produksi {pr.produk.nama} lagi
        </Link>
        <Link href={`/produk/${pr.produk.id}`} className="btn-secondary">
          Lihat produk
        </Link>
      </div>
    </div>
  );
}
