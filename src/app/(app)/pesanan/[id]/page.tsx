import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, MessageCircle } from "lucide-react";
import { CatatanDokumen } from "@/components/catatan";
import { JudulHalaman } from "@/components/judul-halaman";
import { TombolAksi } from "@/components/tombol-aksi";
import { BadgeStatus, BannerOk, Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { angka, nomorWa, rupiah, tanggal } from "@/lib/format";
import { cekGalatMuat } from "@/lib/galat-db";
import { STATUS_PESANAN, type StatusPesanan } from "@/lib/status";
import { batalkanPesanan, kirimPesanan, simpanCatatanPesanan, terimaPesanan } from "../actions";
import { EditorItemPesanan, type ItemPesanan } from "../editor-item-pesanan";

export const metadata: Metadata = { title: "Detail pesanan" };

type Pesanan = {
  id: number;
  nomor: string;
  status: StatusPesanan;
  tanggal: string;
  tanggal_kirim: string | null;
  tanggal_terima: string | null;
  catatan: string | null;
  reseller: { id: number; nama: string; telepon: string | null; alamat: string | null; kota: string | null };
  pesanan_item: ItemPesanan[];
};
type Mutasi = { qty: number; stok_setelah: number; produk: { nama: string; satuan: string } | null };

export default async function PesananDetailPage({ params, searchParams }: PageProps<"/pesanan/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pesanan")
    .select(
      "id, nomor, status, tanggal, tanggal_kirim, tanggal_terima, catatan, reseller(id, nama, telepon, alamat, kota), pesanan_item(id, qty, harga_satuan, produk(id, nama, satuan, stok))",
    )
    .eq("id", id)
    .order("id", { referencedTable: "pesanan_item" })
    .maybeSingle();
  cekGalatMuat(error);
  if (!data) notFound();
  const ps = data as unknown as Pesanan;

  const [{ data: semuaProduk, error: e2 }, { data: mutasi, error: e3 }] = await Promise.all([
    ps.status === "diproses" ? supabase.from("produk").select("id, nama, satuan, stok").order("kode") : Promise.resolve({ data: [], error: null }),
    ps.status === "dikirim" || ps.status === "diterima"
      ? supabase.from("mutasi_stok").select("qty, stok_setelah, produk(nama, satuan)").eq("sumber", "pesanan").eq("ref_id", id).order("id")
      : Promise.resolve({ data: [], error: null }),
  ]);
  cekGalatMuat(e2, e3);

  const total = ps.pesanan_item.reduce((s, i) => s + i.qty * Number(i.harga_satuan), 0);
  const pak = ps.pesanan_item.reduce((s, i) => s + i.qty, 0);
  const kurang = ps.pesanan_item.filter((i) => i.produk.stok < i.qty);

  // Pesan WhatsApp ke reseller (dibuka di WA admin; admin sendiri yang menekan kirim)
  const wa = nomorWa(ps.reseller.telepon);
  const teksWa = [
    `Halo ${ps.reseller.nama}, dari Galunggung Frozen Food.`,
    ps.status === "dikirim"
      ? `Pesanan ${ps.nomor} sudah kami kirim hari ini:`
      : `Pesanan ${ps.nomor} sudah kami terima dan sedang disiapkan:`,
    ...ps.pesanan_item.map((i) => `- ${i.produk.nama}: ${i.qty} ${i.produk.satuan}`),
    `Total ${rupiah(total)}.`,
    "Terima kasih.",
  ].join("\n");

  const langkah = [
    { label: "Pesanan masuk", tgl: ps.tanggal, selesai: true },
    { label: "Dikirim", tgl: ps.tanggal_kirim, selesai: !!ps.tanggal_kirim },
    { label: "Diterima reseller", tgl: ps.tanggal_terima, selesai: !!ps.tanggal_terima },
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <Kembali href="/pesanan">Daftar pesanan</Kembali>
        <JudulHalaman
          judul={ps.nomor}
          deskripsi={`${ps.reseller.nama}${ps.reseller.kota ? ` · ${ps.reseller.kota}` : ""} · ${pak} pak · ${rupiah(total)}`}
          aksi={<BadgeStatus info={STATUS_PESANAN[ps.status]} />}
        />
        <BannerOk ok={sp.ok} />
      </div>

      <section className="card p-5">
        <ol className="grid gap-4 sm:grid-cols-3">
          {langkah.map((l, i) => (
            <li key={l.label} className="flex items-start gap-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  l.selesai ? "bg-emerald-600 text-white" : ps.status === "dibatalkan" ? "bg-slate-100 text-slate-400" : "bg-slate-200 text-slate-600"
                }`}
              >
                {l.selesai ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{l.label}</p>
                <p className="text-xs text-slate-500">{l.tgl ? tanggal(l.tgl) : "–"}</p>
              </div>
            </li>
          ))}
        </ol>

        {ps.status === "diproses" && kurang.length > 0 && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Belum bisa dikirim: stok {kurang.map((i) => `${i.produk.nama} (ada ${angka(i.produk.stok)}, dipesan ${i.qty})`).join(", ")}.{" "}
            <Link href={`/produksi/baru?produk=${kurang[0].produk.id}`} className="font-medium underline">
              Catat produksi
            </Link>{" "}
            dulu, atau kurangi jumlahnya.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-start gap-2 border-t border-slate-100 pt-4">
          {ps.status === "diproses" && (
            <TombolAksi
              aksi={kirimPesanan.bind(null, id)}
              konfirmasi={`Kirim ${ps.nomor} ke ${ps.reseller.nama}? Stok ${ps.pesanan_item.length} produk akan berkurang dan isi pesanan terkunci.`}
            >
              Kirim pesanan (stok berkurang)
            </TombolAksi>
          )}
          {ps.status === "dikirim" && (
            <TombolAksi aksi={terimaPesanan.bind(null, id)} konfirmasi={`Reseller sudah menerima ${ps.nomor}?`}>
              Konfirmasi diterima
            </TombolAksi>
          )}
          {ps.status === "diproses" && (
            <TombolAksi aksi={batalkanPesanan.bind(null, id)} konfirmasi={`Batalkan ${ps.nomor}?`} className="btn-secondary text-red-600">
              Batalkan pesanan
            </TombolAksi>
          )}
          {wa && (ps.status === "diproses" || ps.status === "dikirim") && (
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent(teksWa)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <MessageCircle className="size-4" aria-hidden /> Kabari reseller via WhatsApp
            </a>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">{STATUS_PESANAN[ps.status].arti}</p>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold">Produk ({ps.pesanan_item.length})</h2>
        {ps.status === "diproses" ? (
          <EditorItemPesanan pesananId={id} items={ps.pesanan_item} semuaProduk={semuaProduk ?? []} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th className="text-right">Jumlah</th>
                  <th className="text-right">Harga / pak</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {ps.pesanan_item.map((i) => (
                  <tr key={i.id}>
                    <td className="font-medium">{i.produk.nama}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">
                      {i.qty} {i.produk.satuan}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums">{rupiah(i.harga_satuan)}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{rupiah(i.qty * Number(i.harga_satuan))}</td>
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

      {(mutasi ?? []).length > 0 && (
        <section className="card p-5">
          <h2 className="text-base font-semibold">Keluar dari gudang barang jadi</h2>
          <p className="mb-3 mt-1 text-sm text-slate-500">Dicatat di buku besar mutasi stok saat pesanan dikirim.</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {(mutasi as unknown as Mutasi[]).map((m, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span>{m.produk?.nama}</span>
                <span className="tabular-nums text-slate-600">
                  <span className="font-medium text-red-700">{angka(m.qty)}</span> → stok {angka(m.stok_setelah)} {m.produk?.satuan}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5">
        <CatatanDokumen aksi={simpanCatatanPesanan.bind(null, id)} awal={ps.catatan} />
        <p className="mt-3 text-xs text-slate-500">
          Reseller:{" "}
          <Link href={`/reseller/${ps.reseller.id}`} className="text-sky-700 hover:underline">
            {ps.reseller.nama}
          </Link>
          {ps.reseller.telepon && ` · ${ps.reseller.telepon}`}
          {ps.reseller.alamat && ` · ${ps.reseller.alamat}`}
        </p>
      </section>
    </div>
  );
}
