import Link from "next/link";
import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Paginasi, TabStatus } from "@/components/paginasi";
import { Badge, BadgeStatus, BannerOk, Tabel, TabelKosong, TombolTambah } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { paramTeks } from "@/lib/cari";
import { rupiah, tanggal } from "@/lib/format";
import { stokCukup, totalPesanan } from "@/lib/hitung-pesanan";
import { STATUS_PESANAN, type StatusPesanan } from "@/lib/status";

export const metadata: Metadata = { title: "Pesanan & kirim" };

const PER_HALAMAN = 25;

type Baris = {
  id: number;
  nomor: string;
  status: StatusPesanan;
  tanggal: string;
  tanggal_kirim: string | null;
  tanggal_terima: string | null;
  reseller: { id: number; nama: string; kota: string | null };
  pesanan_item: { qty: number; harga_satuan: number; produk: { stok: number } | null }[];
};

export default async function PesananPage({ searchParams }: PageProps<"/pesanan">) {
  const sp = await searchParams;
  const status = paramTeks(sp.status);
  const resellerId = paramTeks(sp.reseller);
  const q = paramTeks(sp.q).replace(/[^A-Za-z0-9-]/g, ""); // nomor pesanan hanya huruf/angka/strip
  const halaman = Math.max(1, Number.parseInt(paramTeks(sp.hal), 10) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("pesanan")
    .select(
      "id, nomor, status, tanggal, tanggal_kirim, tanggal_terima, reseller(id, nama, kota), pesanan_item(qty, harga_satuan, produk(stok))",
      { count: "exact" },
    )
    .order("tanggal", { ascending: false })
    .order("id", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);
  if (status in STATUS_PESANAN) query = query.eq("status", status);
  if (resellerId) query = query.eq("reseller_id", Number(resellerId));
  if (q) query = query.ilike("nomor", `%${q}%`);

  const hitung = (s?: StatusPesanan) => {
    let c = supabase.from("pesanan").select("id", { count: "exact", head: true });
    if (s) c = c.eq("status", s);
    if (resellerId) c = c.eq("reseller_id", Number(resellerId));
    return c;
  };

  const [{ data, count, error }, { data: daftarReseller }, semua, diproses, dikirim, diterima, dibatalkan] = await Promise.all([
    query,
    supabase.from("reseller").select("id, nama").order("nama"),
    hitung(),
    hitung("diproses"),
    hitung("dikirim"),
    hitung("diterima"),
    hitung("dibatalkan"),
  ]);
  if (error) throw new Error(error.message);
  const daftar = (data ?? []) as unknown as Baris[];
  const params = { status, reseller: resellerId, q };

  return (
    <>
      <JudulHalaman
        judul="Pesanan & kirim"
        deskripsi="Pesanan reseller: diproses → dikirim (stok produk berkurang) → diterima."
        aksi={
          <TombolTambah href={resellerId ? `/pesanan/baru?reseller=${resellerId}` : "/pesanan/baru"}>Pesanan baru</TombolTambah>
        }
      />
      <BannerOk ok={sp.ok} />

      <TabStatus
        basePath="/pesanan"
        aktif={status}
        params={params}
        pilihan={[
          { nilai: "", label: "Semua", jumlah: semua.count ?? 0 },
          { nilai: "diproses", label: "Diproses", jumlah: diproses.count ?? 0 },
          { nilai: "dikirim", label: "Dikirim", jumlah: dikirim.count ?? 0 },
          { nilai: "diterima", label: "Diterima", jumlah: diterima.count ?? 0 },
          { nilai: "dibatalkan", label: "Dibatalkan", jumlah: dibatalkan.count ?? 0 },
        ]}
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Cari nomor pesanan" className="input sm:max-w-48" aria-label="Cari nomor pesanan" />
        <select name="reseller" defaultValue={resellerId} className="input sm:max-w-64" aria-label="Filter reseller">
          <option value="">Semua reseller</option>
          {(daftarReseller ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.nama}
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
            <th>Reseller</th>
            <th className="text-right">Item</th>
            <th className="text-right">Total</th>
            <th>Status</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap">
                <Link href={`/pesanan/${p.id}`} className="font-mono text-xs font-medium text-sky-700 hover:underline">
                  {p.nomor}
                </Link>
              </td>
              <td className="whitespace-nowrap text-slate-600">{tanggal(p.tanggal)}</td>
              <td className="min-w-40">
                {p.reseller.nama}
                {p.reseller.kota && <span className="text-xs text-slate-500"> · {p.reseller.kota}</span>}
              </td>
              <td className="text-right tabular-nums">{p.pesanan_item.length}</td>
              <td className="whitespace-nowrap text-right tabular-nums">{rupiah(totalPesanan(p.pesanan_item))}</td>
              <td>
                <BadgeStatus info={STATUS_PESANAN[p.status]} />
              </td>
              <td className="whitespace-nowrap text-xs text-slate-500">
                {p.status === "diproses" &&
                  (stokCukup(p.pesanan_item) ? <Badge warna="hijau">Siap kirim</Badge> : <Badge warna="kuning">Stok kurang</Badge>)}
                {p.status === "dikirim" && p.tanggal_kirim && `Dikirim ${tanggal(p.tanggal_kirim)}`}
                {p.status === "diterima" && p.tanggal_terima && `Diterima ${tanggal(p.tanggal_terima)}`}
              </td>
            </tr>
          ))}
          {daftar.length === 0 && <TabelKosong kolom={7}>Tidak ada pesanan yang cocok dengan filter.</TabelKosong>}
        </tbody>
      </Tabel>
      <Paginasi halaman={halaman} total={count ?? 0} perHalaman={PER_HALAMAN} basePath="/pesanan" params={params} />
    </>
  );
}
