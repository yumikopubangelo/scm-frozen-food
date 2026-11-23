import Link from "next/link";
import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Paginasi } from "@/components/paginasi";
import { BannerOk, Tabel, TabelKosong, TombolTambah } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { kembaliKeHalaman1 } from "@/lib/galat-db";
import { paramTeks } from "@/lib/cari";
import { angka, hariIni, tambahHari, tanggal } from "@/lib/format";

export const metadata: Metadata = { title: "Produksi" };

const PER_HALAMAN = 25;

type Baris = { id: number; nomor: string; tanggal: string; qty: number; catatan: string | null; produk: { id: number; nama: string; satuan: string } };

export default async function ProduksiPage({ searchParams }: PageProps<"/produksi">) {
  const sp = await searchParams;
  const produkId = paramTeks(sp.produk);
  const halaman = Math.max(1, Number.parseInt(paramTeks(sp.hal), 10) || 1);
  const dari30 = tambahHari(hariIni(), -29);

  const supabase = await createClient();
  let query = supabase
    .from("produksi")
    .select("id, nomor, tanggal, qty, catatan, produk(id, nama, satuan)", { count: "exact" })
    .order("tanggal", { ascending: false })
    .order("id", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);
  if (produkId) query = query.eq("produk_id", Number(produkId));

  const [{ data, count, error }, { data: daftarProduk }, { data: sebulan }] = await Promise.all([
    query,
    supabase.from("produk").select("id, nama, satuan").order("kode"),
    supabase.from("produksi").select("produk_id, qty").gte("tanggal", dari30),
  ]);
  kembaliKeHalaman1(error, "/produksi", { produk: produkId });
  if (error) throw new Error(error.message);
  const daftar = (data ?? []) as unknown as Baris[];

  // Ringkasan 30 hari terakhir: total pak per produk
  const total30 = new Map<number, number>();
  for (const r of sebulan ?? []) total30.set(r.produk_id, (total30.get(r.produk_id) ?? 0) + r.qty);
  const ringkasan = (daftarProduk ?? []).map((p) => ({ ...p, total: total30.get(p.id) ?? 0 }));
  const maks = Math.max(1, ...ringkasan.map((r) => r.total));

  return (
    <>
      <JudulHalaman
        judul="Produksi"
        deskripsi="Riwayat batch produksi: bahan baku diubah menjadi produk jadi sesuai resep."
        aksi={<TombolTambah href="/produksi/baru">Catat produksi</TombolTambah>}
      />
      <BannerOk ok={sp.ok} />

      <section className="card mb-6 p-5">
        <h2 className="text-base font-semibold">Hasil produksi 30 hari terakhir</h2>
        <p className="mb-4 mt-1 text-xs text-slate-500">
          {tanggal(dari30)} – {tanggal(hariIni())}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ringkasan.map((r) => (
            <li key={r.id} className="text-sm">
              <div className="flex justify-between gap-2">
                <Link href={`/produksi?produk=${r.id}`} className="truncate text-slate-700 hover:text-sky-700">
                  {r.nama}
                </Link>
                <span className="tabular-nums text-slate-600">
                  {angka(r.total)} {r.satuan}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${(r.total / maks) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select name="produk" defaultValue={produkId} className="input sm:max-w-72" aria-label="Filter produk">
          <option value="">Semua produk</option>
          {(daftarProduk ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Terapkan</button>
      </form>

      <Tabel>
        <thead>
          <tr>
            <th>Nomor</th>
            <th>Tanggal</th>
            <th>Produk</th>
            <th className="text-right">Jumlah</th>
            <th>Catatan</th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap">
                <Link href={`/produksi/${r.id}`} className="font-mono text-xs font-medium text-sky-700 hover:underline">
                  {r.nomor}
                </Link>
              </td>
              <td className="whitespace-nowrap text-slate-600">{tanggal(r.tanggal)}</td>
              <td className="min-w-44">{r.produk.nama}</td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {angka(r.qty)} {r.produk.satuan}
              </td>
              <td className="text-xs text-slate-500">{r.catatan ?? ""}</td>
            </tr>
          ))}
          {daftar.length === 0 && <TabelKosong kolom={5}>Belum ada produksi yang cocok dengan filter.</TabelKosong>}
        </tbody>
      </Tabel>
      <Paginasi halaman={halaman} total={count ?? 0} perHalaman={PER_HALAMAN} basePath="/produksi" params={{ produk: produkId }} />
    </>
  );
}
