"use client";

import { useActionState } from "react";
import { Field, PesanForm, Pilihan, TombolSimpan } from "@/components/form";
import { TombolHapus } from "@/components/tombol-hapus";
import { angka, rupiah } from "@/lib/format";
import { statusAwal, type StatusForm } from "@/lib/validasi";
import type { BarisBom } from "@/lib/tipe";
import { hapusBom, tambahBom, ubahBom } from "./actions";

type OpsiBahan = { id: number; nama: string; satuan: string };

/**
 * Editor resep (Bill of Materials): daftar bahan per 1 pak produk.
 * Setiap baris punya form sendiri (ubah jumlah / hapus), lalu ada form tambah di bawah.
 */
export function EditorBom({
  produkId,
  baris,
  semuaBahan,
}: {
  produkId: number;
  baris: BarisBom[];
  semuaBahan: OpsiBahan[];
}) {
  const sudahDipakai = new Set(baris.map((b) => b.bahan_baku.id));
  const tersedia = semuaBahan.filter((b) => !sudahDipakai.has(b.id));

  return (
    <div className="flex flex-col gap-4">
      {baris.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Resep masih kosong. Produk ini belum bisa diproduksi sampai minimal satu bahan ditambahkan.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabel">
            <thead>
              <tr>
                <th>Bahan</th>
                <th>Jumlah per pak</th>
                <th className="text-right">Stok bahan</th>
                <th className="text-right">Biaya / pak</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <BarisResep key={b.id} produkId={produkId} baris={b} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <FormTambahBahan produkId={produkId} tersedia={tersedia} />
    </div>
  );
}

function BarisResep({ produkId, baris }: { produkId: number; baris: BarisBom }) {
  const [status, formAction] = useActionState(ubahBom.bind(null, baris.id, produkId), statusAwal);
  const formId = `bom-${baris.id}`;
  const biaya = Number(baris.qty_per_unit) * Number(baris.bahan_baku.harga_satuan);

  return (
    <tr>
      <td>
        <p className="font-medium">{baris.bahan_baku.nama}</p>
        <p className="text-xs text-slate-500">
          {rupiah(baris.bahan_baku.harga_satuan)}/{baris.bahan_baku.satuan}
        </p>
      </td>
      <td>
        <form id={formId} action={formAction} className="flex items-center gap-2">
          <input
            key={status.versi ?? 0}
            name="qty_per_unit"
            // tampilkan koma desimal (0,25) supaya sama dengan cara admin mengetik
            defaultValue={status.nilai?.qty_per_unit ?? String(baris.qty_per_unit).replace(".", ",")}
            inputMode="decimal"
            aria-label={`Jumlah ${baris.bahan_baku.nama} per pak`}
            className={`input w-24 ${status.galat?.qty_per_unit ? "border-red-400" : ""}`}
          />
          <span className="text-xs text-slate-500">{baris.bahan_baku.satuan}</span>
          <TombolSimpan className="rounded-md px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50">Simpan</TombolSimpan>
        </form>
        {(status.galat?.qty_per_unit || status.pesan) && (
          <p className="mt-1 text-xs text-red-600">{status.galat?.qty_per_unit ?? status.pesan}</p>
        )}
        {status.sukses && !status.galat && <p className="mt-1 text-xs text-emerald-700">{status.sukses}</p>}
      </td>
      <td className="whitespace-nowrap text-right tabular-nums text-slate-600">
        {angka(baris.bahan_baku.stok)} {baris.bahan_baku.satuan}
      </td>
      <td className="whitespace-nowrap text-right tabular-nums">{rupiah(biaya)}</td>
      <td>
        <TombolHapus kecil aksi={hapusBom.bind(null, baris.id, produkId)} nama={`${baris.bahan_baku.nama} dari resep`} />
      </td>
    </tr>
  );
}

function FormTambahBahan({ produkId, tersedia }: { produkId: number; tersedia: OpsiBahan[] }) {
  const [status, formAction] = useActionState<StatusForm, FormData>(tambahBom.bind(null, produkId), statusAwal);

  if (tersedia.length === 0) {
    return <p className="text-sm text-slate-500">Semua bahan baku sudah ada di resep ini.</p>;
  }

  return (
    <form action={formAction} className="rounded-lg border border-dashed border-slate-300 p-4" noValidate>
      <p className="mb-3 text-sm font-medium text-slate-700">Tambah bahan ke resep</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-start">
        <Pilihan
          name="bahan_id"
          label="Bahan"
          status={status}
          kosong="— pilih bahan —"
          opsi={tersedia.map((b) => ({ nilai: b.id, label: `${b.nama} (${b.satuan})` }))}
        />
        <Field name="qty_per_unit" label="Jumlah per pak" status={status} inputMode="decimal" placeholder="0,15" />
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
