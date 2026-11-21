import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, MessageCircle } from "lucide-react";
import { JudulHalaman } from "@/components/judul-halaman";
import { TombolAksi } from "@/components/tombol-aksi";
import { Badge, BadgeStatus, BannerOk, Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { angka, hariIni, nomorWa, rupiah, selisihHari, tambahHari, tanggal } from "@/lib/format";
import { STATUS_PO, type StatusPo } from "@/lib/status";
import { cekGalatMuat } from "@/lib/galat-db";
import { batalkanPo, kirimPo, simpanCatatanPo, terimaPo } from "../actions";
import { CatatanPo } from "../catatan-po";
import { EditorItemPo, type ItemPo } from "../editor-item-po";

export const metadata: Metadata = { title: "Detail PO" };

type Po = {
  id: number;
  nomor: string;
  status: StatusPo;
  sumber: "manual" | "agen";
  tanggal: string;
  tanggal_dikirim: string | null;
  tanggal_diterima: string | null;
  catatan: string | null;
  supplier: { id: number; nama: string; kontak: string | null; telepon: string | null; lead_time_hari: number };
  po_item: ItemPo[];
};

type Mutasi = { qty: number; stok_setelah: number; bahan_baku: { nama: string; satuan: string } | null };

export default async function PoDetailPage({ params, searchParams }: PageProps<"/purchase-order/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_order")
    .select(
      "id, nomor, status, sumber, tanggal, tanggal_dikirim, tanggal_diterima, catatan, supplier(id, nama, kontak, telepon, lead_time_hari), po_item(id, qty, harga_satuan, bahan_baku(id, nama, satuan))",
    )
    .eq("id", id)
    .order("id", { referencedTable: "po_item" })
    .maybeSingle();
  cekGalatMuat(error);
  if (!data) notFound();
  const po = data as unknown as Po;

  const [{ data: semuaBahan }, { data: mutasi }] = await Promise.all([
    po.status === "draft" ? supabase.from("bahan_baku").select("id, nama, satuan").order("nama") : Promise.resolve({ data: [] }),
    po.status === "diterima"
      ? supabase.from("mutasi_stok").select("qty, stok_setelah, bahan_baku(nama, satuan)").eq("sumber", "po").eq("ref_id", id)
      : Promise.resolve({ data: [] }),
  ]);

  const total = po.po_item.reduce((s, i) => s + Number(i.qty) * Number(i.harga_satuan), 0);
  const tiba = po.tanggal_dikirim ? tambahHari(po.tanggal_dikirim, po.supplier.lead_time_hari) : null;
  const telat = po.status === "dikirim" && tiba ? selisihHari(tiba, hariIni()) : 0;

  // Pesan WhatsApp ke supplier (dibuka di aplikasi WA admin; tidak terkirim otomatis)
  const wa = nomorWa(po.supplier.telepon);
  const teksWa = [
    `Assalamu'alaikum ${po.supplier.kontak ?? ""}, kami dari Galunggung Frozen Food ingin memesan (${po.nomor}):`,
    ...po.po_item.map((i) => `- ${i.bahan_baku.nama}: ${angka(i.qty)} ${i.bahan_baku.satuan}`),
    po.catatan ? `Catatan: ${po.catatan}` : "",
    "Mohon konfirmasinya. Terima kasih.",
  ]
    .filter(Boolean)
    .join("\n");

  const langkah = [
    { label: "Dibuat", tgl: po.tanggal, selesai: true },
    { label: "Dikirim ke supplier", tgl: po.tanggal_dikirim, selesai: !!po.tanggal_dikirim },
    {
      label: "Diterima di gudang",
      tgl: po.tanggal_diterima ?? (po.status === "dikirim" ? tiba : null),
      selesai: !!po.tanggal_diterima,
      perkiraan: po.status === "dikirim",
    },
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <Kembali href="/purchase-order">Daftar PO</Kembali>
        <JudulHalaman
          judul={po.nomor}
          deskripsi={`Supplier ${po.supplier.nama} · total ${rupiah(total)}`}
          aksi={
            <div className="flex items-center gap-2">
              {po.sumber === "agen" && <Badge warna="biru">dibuat agen restock</Badge>}
              <BadgeStatus info={STATUS_PO[po.status]} />
            </div>
          }
        />
        <BannerOk ok={sp.ok} />
        {po.status === "draft" && po.sumber === "agen" && (
          <p className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Draft ini dibuat otomatis oleh <strong>agen restock</strong>. Periksa jumlahnya, ubah bila perlu, lalu klik
            &quot;Setujui &amp; kirim ke supplier&quot;. Tanpa persetujuan admin, PO tidak pernah terkirim.
          </p>
        )}
      </div>

      {/* Linimasa status */}
      <section className="card p-5">
        <ol className="grid gap-4 sm:grid-cols-3">
          {langkah.map((l, i) => (
            <li key={l.label} className="flex items-start gap-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  po.status === "dibatalkan" && !l.selesai
                    ? "bg-slate-100 text-slate-400"
                    : l.selesai
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-600"
                }`}
              >
                {l.selesai ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{l.label}</p>
                <p className="text-xs text-slate-500">
                  {l.tgl ? `${l.perkiraan ? "Perkiraan " : ""}${tanggal(l.tgl)}` : "–"}
                  {l.perkiraan && telat > 0 && <span className="font-medium text-red-600"> · terlambat {telat} hari</span>}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* Tombol aksi sesuai status */}
        <div className="mt-5 flex flex-wrap items-start gap-2 border-t border-slate-100 pt-4">
          {po.status === "draft" && (
            <TombolAksi
              aksi={kirimPo.bind(null, id)}
              konfirmasi={`Kirim ${po.nomor} ke ${po.supplier.nama}? Setelah dikirim, isi PO tidak bisa diubah.`}
            >
              {po.sumber === "agen" ? "Setujui & kirim ke supplier" : "Kirim ke supplier"}
            </TombolAksi>
          )}
          {po.status === "dikirim" && (
            <TombolAksi
              aksi={terimaPo.bind(null, id)}
              konfirmasi={`Barang ${po.nomor} sudah datang lengkap? Stok ${po.po_item.length} bahan akan bertambah.`}
            >
              Terima barang (stok bertambah)
            </TombolAksi>
          )}
          {(po.status === "draft" || po.status === "dikirim") && (
            <TombolAksi aksi={batalkanPo.bind(null, id)} konfirmasi={`Batalkan ${po.nomor}?`} className="btn-secondary text-red-600">
              Batalkan PO
            </TombolAksi>
          )}
          {wa && (po.status === "draft" || po.status === "dikirim") && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(teksWa)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <MessageCircle className="size-4" aria-hidden /> Kirim pesan WhatsApp
            </a>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">{STATUS_PO[po.status].arti}</p>
      </section>

      {/* Item */}
      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold">Bahan ({po.po_item.length})</h2>
        {po.status === "draft" ? (
          <EditorItemPo poId={id} items={po.po_item} semuaBahan={semuaBahan ?? []} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Bahan</th>
                  <th className="text-right">Jumlah</th>
                  <th className="text-right">Harga / satuan</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {po.po_item.map((i) => (
                  <tr key={i.id}>
                    <td className="font-medium">{i.bahan_baku.nama}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">
                      {angka(i.qty)} {i.bahan_baku.satuan}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums">{rupiah(i.harga_satuan)}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{rupiah(Number(i.qty) * Number(i.harga_satuan))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-right text-sm">
          Total: <strong className="tabular-nums">{rupiah(total)}</strong>
        </p>
      </section>

      {po.status === "diterima" && (mutasi ?? []).length > 0 && (
        <section className="card p-5">
          <h2 className="text-base font-semibold">Masuk gudang bahan baku</h2>
          <p className="mb-3 mt-1 text-sm text-slate-500">Dicatat di buku besar mutasi stok saat PO diterima.</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {(mutasi as unknown as Mutasi[]).map((m, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span>{m.bahan_baku?.nama}</span>
                <span className="tabular-nums text-slate-600">
                  <span className="font-medium text-emerald-700">+{angka(m.qty)}</span> → stok {angka(m.stok_setelah)} {m.bahan_baku?.satuan}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5">
        <CatatanPo aksi={simpanCatatanPo.bind(null, id)} awal={po.catatan} />
        <p className="mt-3 text-xs text-slate-500">
          Supplier:{" "}
          <Link href={`/supplier/${po.supplier.id}`} className="text-sky-700 hover:underline">
            {po.supplier.nama}
          </Link>
          {po.supplier.telepon && ` · ${po.supplier.telepon}`} · lead time {po.supplier.lead_time_hari} hari
        </p>
      </section>
    </div>
  );
}
