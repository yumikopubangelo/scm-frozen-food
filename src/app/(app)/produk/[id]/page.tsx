import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JudulHalaman } from "@/components/judul-halaman";
import { StokOpname } from "@/components/stok-opname";
import { TombolHapus } from "@/components/tombol-hapus";
import { BadgeStok, BannerOk, Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { sesuaikanStok } from "@/lib/aksi-stok";
import { angka, rupiah } from "@/lib/format";
import { biayaBahanPerPak, kapasitasProduksi } from "@/lib/hitung-produk";
import type { BarisBom, Produk } from "@/lib/tipe";
import { hapusProduk, simpanProduk } from "../actions";
import { EditorBom } from "../editor-bom";
import { FormProduk } from "../form-produk";

export const metadata: Metadata = { title: "Produk & resep" };

export default async function ProdukDetailPage({ params, searchParams }: PageProps<"/produk/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;

  const supabase = await createClient();
  const [{ data: p }, { data: bom }, { data: bahan }] = await Promise.all([
    supabase.from("produk").select("*").eq("id", id).maybeSingle<Produk>(),
    supabase
      .from("bom")
      .select("id, qty_per_unit, bahan_baku(id, kode, nama, satuan, harga_satuan, stok)")
      .eq("produk_id", id)
      .order("id"),
    supabase.from("bahan_baku").select("id, nama, satuan").order("nama"),
  ]);
  if (!p) notFound();

  const baris = (bom ?? []) as unknown as BarisBom[];
  const biaya = biayaBahanPerPak(baris);
  const margin = Number(p.harga_jual) - biaya;
  const kapasitas = kapasitasProduksi(baris);
  // Bahan pembatas: yang membuat kapasitas produksi paling kecil
  const pembatas = baris.length
    ? baris.reduce((a, b) =>
        Number(b.bahan_baku.stok) / Number(b.qty_per_unit) < Number(a.bahan_baku.stok) / Number(a.qty_per_unit) ? b : a,
      )
    : null;

  const ringkasan = [
    { label: "Stok", nilai: `${angka(p.stok)} ${p.satuan}`, ekstra: <BadgeStok stok={p.stok} batas={p.stok_minimum} /> },
    { label: "Biaya bahan / pak", nilai: baris.length ? rupiah(biaya) : "–" },
    {
      label: "Margin kotor / pak",
      nilai: baris.length ? `${rupiah(margin)} (${((margin / Number(p.harga_jual || 1)) * 100).toFixed(0)}%)` : "–",
    },
    {
      label: "Bisa diproduksi sekarang",
      nilai: kapasitas === null ? "–" : `${angka(kapasitas)} ${p.satuan}`,
      ekstra: pembatas && <span className="text-xs text-slate-500">dibatasi {pembatas.bahan_baku.nama}</span>,
    },
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <Kembali href="/produk">Daftar produk</Kembali>
        <JudulHalaman
          judul={p.nama}
          deskripsi={`Kode ${p.kode} · harga jual ${rupiah(p.harga_jual)}`}
          aksi={<TombolHapus aksi={hapusProduk.bind(null, id)} nama={`produk ${p.nama}`} />}
        />
        <BannerOk ok={sp.ok} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ringkasan.map((r) => (
            <div key={r.label} className="card p-4">
              <p className="text-xs text-slate-500">{r.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{r.nilai}</p>
              {r.ekstra && <div className="mt-1">{r.ekstra}</div>}
            </div>
          ))}
        </div>
      </div>

      <section className="card p-5">
        <h2 className="text-base font-semibold">Resep / Bill of Materials (per 1 {p.satuan})</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Saat produksi dicatat, setiap bahan berkurang sebesar jumlah per {p.satuan} × jumlah produksi.
        </p>
        <EditorBom produkId={id} baris={baris} semuaBahan={bahan ?? []} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-semibold">Data produk</h2>
          <FormProduk aksi={simpanProduk.bind(null, id)} awal={p} />
        </section>
        <section>
          <h2 className="mb-3 text-base font-semibold">&nbsp;</h2>
          <StokOpname
            aksi={sesuaikanStok.bind(null, { jenis: "produk", id, path: `/produk/${id}` })}
            stok={p.stok}
            satuan={p.satuan}
          />
        </section>
      </div>
    </div>
  );
}
