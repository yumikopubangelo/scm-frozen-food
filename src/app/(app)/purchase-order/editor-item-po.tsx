"use client";

import { useActionState } from "react";
import { Field, PesanForm, Pilihan, TombolSimpan } from "@/components/form";
import { TombolHapus } from "@/components/tombol-hapus";
import { rupiah } from "@/lib/format";
import { statusAwal, type StatusForm } from "@/lib/validasi";
import { hapusItemPo, tambahItemPo, ubahItemPo } from "./actions";

export type ItemPo = {
  id: number;
  qty: number;
  harga_satuan: number;
  bahan_baku: { id: number; nama: string; satuan: string };
};

/** Edit item PO selama masih DRAFT (mis. admin menyesuaikan usulan agen restock). */
export function EditorItemPo({
  poId,
  items,
  semuaBahan,
}: {
  poId: number;
  items: ItemPo[];
  semuaBahan: { id: number; nama: string; satuan: string }[];
}) {
  const dipakai = new Set(items.map((i) => i.bahan_baku.id));
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="tabel">
          <thead>
            <tr>
              <th>Bahan</th>
              <th>Jumlah</th>
              <th>Harga / satuan</th>
              <th className="text-right">Subtotal</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <BarisItem key={i.id} poId={poId} item={i} bisaHapus={items.length > 1} />
            ))}
          </tbody>
        </table>
      </div>
      <FormTambah poId={poId} tersedia={semuaBahan.filter((b) => !dipakai.has(b.id))} />
    </div>
  );
}

function BarisItem({ poId, item, bisaHapus }: { poId: number; item: ItemPo; bisaHapus: boolean }) {
  const [status, formAction] = useActionState(ubahItemPo.bind(null, item.id, poId), statusAwal);
  const formId = `item-${item.id}`;
  const koma = (n: number) => String(n).replace(".", ",");
  const galat = status.galat?.qty ?? status.galat?.harga_satuan ?? status.pesan;

  return (
    <tr>
      <td className="font-medium">{item.bahan_baku.nama}</td>
      <td>
        <div className="flex items-center gap-1.5">
          <input
            form={formId}
            key={`q${status.versi ?? 0}`}
            name="qty"
            defaultValue={status.nilai?.qty ?? koma(item.qty)}
            inputMode="decimal"
            className="input w-24"
            aria-label={`Jumlah ${item.bahan_baku.nama}`}
          />
          <span className="text-xs text-slate-500">{item.bahan_baku.satuan}</span>
        </div>
      </td>
      <td>
        <input
          form={formId}
          key={`h${status.versi ?? 0}`}
          name="harga_satuan"
          defaultValue={status.nilai?.harga_satuan ?? koma(item.harga_satuan)}
          inputMode="decimal"
          className="input w-32"
          aria-label={`Harga ${item.bahan_baku.nama}`}
        />
      </td>
      <td className="whitespace-nowrap text-right tabular-nums">{rupiah(Number(item.qty) * Number(item.harga_satuan))}</td>
      <td>
        <div className="flex items-center gap-1">
          {/* Form "kosong" yang dirujuk kedua input lewat atribut form= */}
          <form id={formId} action={formAction}>
            <TombolSimpan className="rounded-md px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50">Simpan</TombolSimpan>
          </form>
          {bisaHapus && <TombolHapus kecil aksi={hapusItemPo.bind(null, item.id, poId)} nama={`${item.bahan_baku.nama} dari PO`} />}
        </div>
        {galat && <p className="mt-1 text-xs text-red-600">{galat}</p>}
        {status.sukses && !galat && <p className="mt-1 text-xs text-emerald-700">{status.sukses}</p>}
      </td>
    </tr>
  );
}

function FormTambah({ poId, tersedia }: { poId: number; tersedia: { id: number; nama: string; satuan: string }[] }) {
  const [status, formAction] = useActionState<StatusForm, FormData>(tambahItemPo.bind(null, poId), statusAwal);
  if (tersedia.length === 0) return null;
  return (
    <form action={formAction} className="rounded-lg border border-dashed border-slate-300 p-4" noValidate>
      <p className="mb-3 text-sm font-medium text-slate-700">Tambah bahan ke PO</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-start">
        <Pilihan name="bahan_id" label="Bahan" status={status} kosong="— pilih bahan —" opsi={tersedia.map((b) => ({ nilai: b.id, label: `${b.nama} (${b.satuan})` }))} />
        <Field name="qty" label="Jumlah" status={status} inputMode="decimal" />
        <div className="sm:pt-6">
          <TombolSimpan className="btn-secondary">Tambah</TombolSimpan>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Harga diambil dari master bahan baku; bisa diubah setelah ditambahkan.</p>
      <div className="mt-2">
        <PesanForm status={{ ...status, pesan: status.galat && Object.keys(status.galat).length ? undefined : status.pesan }} />
        {status.sukses && <p className="text-sm text-emerald-700">{status.sukses}</p>}
      </div>
    </form>
  );
}
