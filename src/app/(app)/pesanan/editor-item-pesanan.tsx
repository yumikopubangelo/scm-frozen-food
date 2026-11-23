"use client";

import { useActionState } from "react";
import { Field, PesanForm, Pilihan, TombolSimpan } from "@/components/form";
import { TombolHapus } from "@/components/tombol-hapus";
import { angka, rupiah } from "@/lib/format";
import { statusAwal, type StatusForm } from "@/lib/validasi";
import { hapusItemPesanan, tambahItemPesanan, ubahItemPesanan } from "./actions";

export type ItemPesanan = {
  id: number;
  qty: number;
  harga_satuan: number;
  produk: { id: number; nama: string; satuan: string; stok: number };
};

/** Edit isi pesanan selama masih "diproses" (mis. reseller menambah/mengurangi). */
export function EditorItemPesanan({
  pesananId,
  items,
  semuaProduk,
}: {
  pesananId: number;
  items: ItemPesanan[];
  semuaProduk: { id: number; nama: string; satuan: string; stok: number }[];
}) {
  const dipakai = new Set(items.map((i) => i.produk.id));
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="tabel">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Jumlah</th>
              <th>Harga / pak</th>
              <th className="text-right">Stok gudang</th>
              <th className="text-right">Subtotal</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <BarisItem key={i.id} pesananId={pesananId} item={i} bisaHapus={items.length > 1} />
            ))}
          </tbody>
        </table>
      </div>
      <FormTambah pesananId={pesananId} tersedia={semuaProduk.filter((p) => !dipakai.has(p.id))} />
    </div>
  );
}

function BarisItem({ pesananId, item, bisaHapus }: { pesananId: number; item: ItemPesanan; bisaHapus: boolean }) {
  const [status, formAction] = useActionState(ubahItemPesanan.bind(null, item.id, pesananId), statusAwal);
  const formId = `item-${item.id}`;
  const galat = status.galat?.qty ?? status.galat?.harga_satuan ?? status.pesan;
  const kurang = Math.max(0, item.qty - item.produk.stok);

  return (
    <tr className={kurang > 0 ? "bg-red-50/60" : ""}>
      <td className="font-medium">{item.produk.nama}</td>
      <td>
        <div className="flex items-center gap-1.5">
          <input form={formId} key={`q${status.versi ?? 0}`} name="qty" defaultValue={status.nilai?.qty ?? String(item.qty)} inputMode="numeric" className="input w-20" aria-label={`Jumlah ${item.produk.nama}`} />
          <span className="text-xs text-slate-500">{item.produk.satuan}</span>
        </div>
      </td>
      <td>
        <input form={formId} key={`h${status.versi ?? 0}`} name="harga_satuan" defaultValue={status.nilai?.harga_satuan ?? String(item.harga_satuan)} inputMode="decimal" className="input w-28" aria-label={`Harga ${item.produk.nama}`} />
      </td>
      <td className={`whitespace-nowrap text-right tabular-nums ${kurang > 0 ? "font-medium text-red-700" : "text-slate-600"}`}>
        {angka(item.produk.stok)}
        {kurang > 0 && <span className="block text-xs">kurang {angka(kurang)}</span>}
      </td>
      <td className="whitespace-nowrap text-right tabular-nums">{rupiah(item.qty * Number(item.harga_satuan))}</td>
      <td>
        <div className="flex items-center gap-1">
          <form id={formId} action={formAction}>
            <TombolSimpan className="rounded-md px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50">Simpan</TombolSimpan>
          </form>
          {bisaHapus && <TombolHapus kecil aksi={hapusItemPesanan.bind(null, item.id, pesananId)} nama={`${item.produk.nama} dari pesanan`} />}
        </div>
        {galat && <p className="mt-1 text-xs text-red-600">{galat}</p>}
        {status.sukses && !galat && <p className="mt-1 text-xs text-emerald-700">{status.sukses}</p>}
      </td>
    </tr>
  );
}

function FormTambah({ pesananId, tersedia }: { pesananId: number; tersedia: { id: number; nama: string; satuan: string; stok: number }[] }) {
  const [status, formAction] = useActionState<StatusForm, FormData>(tambahItemPesanan.bind(null, pesananId), statusAwal);
  if (tersedia.length === 0) return null;
  return (
    <form action={formAction} className="rounded-lg border border-dashed border-slate-300 p-4" noValidate>
      <p className="mb-3 text-sm font-medium text-slate-700">Tambah produk ke pesanan</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-start">
        <Pilihan name="produk_id" label="Produk" status={status} kosong="— pilih produk —" opsi={tersedia.map((p) => ({ nilai: p.id, label: `${p.nama} (stok ${angka(p.stok)})` }))} />
        <Field name="qty" label="Jumlah" status={status} inputMode="numeric" />
        <div className="sm:pt-6">
          <TombolSimpan className="btn-secondary">Tambah</TombolSimpan>
        </div>
      </div>
      <div className="mt-2">
        <PesanForm status={{ ...status, pesan: status.galat && Object.keys(status.galat).length ? undefined : status.pesan }} />
        {status.sukses && <p className="text-sm text-emerald-700">{status.sukses}</p>}
      </div>
    </form>
  );
}
