import Link from "next/link";
import type { Metadata } from "next";
import { JudulHalaman } from "@/components/judul-halaman";
import { Paginasi, TabStatus } from "@/components/paginasi";
import { Badge, BadgeStatus, BannerOk, Tabel, TabelKosong, TombolTambah } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { paramTeks } from "@/lib/cari";
import { hariIni, rupiah, selisihHari, tambahHari, tanggal } from "@/lib/format";
import { STATUS_PO, type StatusPo } from "@/lib/status";

export const metadata: Metadata = { title: "Purchase order" };

const PER_HALAMAN = 25;

type Baris = {
  id: number;
  nomor: string;
  status: StatusPo;
  sumber: "manual" | "agen";
  tanggal: string;
  tanggal_dikirim: string | null;
  tanggal_diterima: string | null;
  supplier: { id: number; nama: string; lead_time_hari: number };
  po_item: { qty: number; harga_satuan: number }[];
};

export default async function PurchaseOrderPage({ searchParams }: PageProps<"/purchase-order">) {
  const sp = await searchParams;
  const status = paramTeks(sp.status);
  const supplierId = paramTeks(sp.supplier);
  const q = paramTeks(sp.q).replace(/[^A-Za-z0-9-]/g, ""); // nomor PO hanya huruf/angka/strip
  const halaman = Math.max(1, Number.parseInt(paramTeks(sp.hal), 10) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("purchase_order")
    .select("id, nomor, status, sumber, tanggal, tanggal_dikirim, tanggal_diterima, supplier(id, nama, lead_time_hari), po_item(qty, harga_satuan)", {
      count: "exact",
    })
    .order("tanggal", { ascending: false })
    .order("id", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);
  if (status in STATUS_PO) query = query.eq("status", status);
  if (supplierId) query = query.eq("supplier_id", Number(supplierId));
  if (q) query = query.ilike("nomor", `%${q}%`);

  // Jumlah per status untuk angka di tab (head: true = hanya hitung, tanpa data)
  const hitung = (s?: StatusPo) => {
    let c = supabase.from("purchase_order").select("id", { count: "exact", head: true });
    if (s) c = c.eq("status", s);
    if (supplierId) c = c.eq("supplier_id", Number(supplierId));
    return c;
  };

  const [{ data, count, error }, { data: daftarSupplier }, semua, draft, dikirim, diterima, dibatalkan] = await Promise.all([
    query,
    supabase.from("supplier").select("id, nama").order("nama"),
    hitung(),
    hitung("draft"),
    hitung("dikirim"),
    hitung("diterima"),
    hitung("dibatalkan"),
  ]);
  if (error) throw new Error(error.message);
  const daftar = (data ?? []) as unknown as Baris[];
  const hari = hariIni();
  const params = { status, supplier: supplierId, q };

  return (
    <>
      <JudulHalaman
        judul="Purchase order"
        deskripsi="Pembelian bahan baku ke supplier: draft → dikirim → diterima (stok bahan bertambah)."
        aksi={<TombolTambah href="/purchase-order/baru">Buat PO</TombolTambah>}
      />
      <BannerOk ok={sp.ok} />

      <TabStatus
        basePath="/purchase-order"
        aktif={status}
        params={params}
        pilihan={[
          { nilai: "", label: "Semua", jumlah: semua.count ?? 0 },
          { nilai: "draft", label: "Draft", jumlah: draft.count ?? 0 },
          { nilai: "dikirim", label: "Dikirim", jumlah: dikirim.count ?? 0 },
          { nilai: "diterima", label: "Diterima", jumlah: diterima.count ?? 0 },
          { nilai: "dibatalkan", label: "Dibatalkan", jumlah: dibatalkan.count ?? 0 },
        ]}
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Cari nomor PO" className="input sm:max-w-48" aria-label="Cari nomor PO" />
        <select name="supplier" defaultValue={supplierId} className="input sm:max-w-64" aria-label="Filter supplier">
          <option value="">Semua supplier</option>
          {(daftarSupplier ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.nama}
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
            <th>Supplier</th>
            <th className="text-right">Item</th>
            <th className="text-right">Total</th>
            <th>Status</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((po) => {
            const total = po.po_item.reduce((s, i) => s + Number(i.qty) * Number(i.harga_satuan), 0);
            // Perkiraan tiba = tanggal dikirim + lead time supplier
            const tiba = po.tanggal_dikirim ? tambahHari(po.tanggal_dikirim, po.supplier.lead_time_hari) : null;
            const telat = po.status === "dikirim" && tiba ? selisihHari(tiba, hari) : 0;
            return (
              <tr key={po.id}>
                <td className="whitespace-nowrap">
                  <Link href={`/purchase-order/${po.id}`} className="font-mono text-xs font-medium text-sky-700 hover:underline">
                    {po.nomor}
                  </Link>
                  {po.sumber === "agen" && (
                    <span className="ml-1.5">
                      <Badge warna="biru">agen</Badge>
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap text-slate-600">{tanggal(po.tanggal)}</td>
                <td className="min-w-40">{po.supplier.nama}</td>
                <td className="text-right tabular-nums">{po.po_item.length}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{rupiah(total)}</td>
                <td>
                  <BadgeStatus info={STATUS_PO[po.status]} />
                </td>
                <td className="whitespace-nowrap text-xs text-slate-500">
                  {po.status === "dikirim" && tiba && (
                    <span className={telat > 0 ? "font-medium text-red-600" : ""}>
                      {telat > 0 ? `Terlambat ${telat} hari` : telat === 0 ? "Perkiraan tiba hari ini" : `Perkiraan tiba ${tanggal(tiba)}`}
                    </span>
                  )}
                  {po.status === "diterima" && po.tanggal_diterima && `Diterima ${tanggal(po.tanggal_diterima)}`}
                  {po.status === "draft" && (po.sumber === "agen" ? "Menunggu persetujuan" : "Belum dikirim")}
                </td>
              </tr>
            );
          })}
          {daftar.length === 0 && <TabelKosong kolom={7}>Tidak ada PO yang cocok dengan filter.</TabelKosong>}
        </tbody>
      </Tabel>
      <Paginasi halaman={halaman} total={count ?? 0} perHalaman={PER_HALAMAN} basePath="/purchase-order" params={params} />
    </>
  );
}
