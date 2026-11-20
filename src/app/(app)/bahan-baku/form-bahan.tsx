"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, PesanForm, Pilihan, TombolSimpan } from "@/components/form";
import { statusAwal, type StatusForm } from "@/lib/validasi";
import { SATUAN_BAHAN, type BahanBaku } from "@/lib/tipe";

export function FormBahan({
  aksi,
  awal,
  supplier,
}: {
  aksi: (prev: StatusForm, fd: FormData) => Promise<StatusForm>;
  awal: Partial<BahanBaku>;
  supplier: { id: number; nama: string; lead_time_hari: number }[];
}) {
  const [status, formAction] = useActionState(aksi, statusAwal);
  // Satuan lama yang tidak ada di daftar tetap ditampilkan supaya tidak hilang saat edit
  const satuan = [...new Set([...SATUAN_BAHAN, ...(awal.satuan ? [awal.satuan] : [])])];

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field name="kode" label="Kode" status={status} awal={awal.kode} required />
        <Field name="nama" label="Nama bahan" status={status} awal={awal.nama} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Pilihan
          name="satuan"
          label="Satuan"
          status={status}
          awal={awal.satuan ?? "kg"}
          required
          opsi={satuan.map((s) => ({ nilai: s, label: s }))}
        />
        <Field
          name="harga_satuan"
          label="Harga per satuan (Rp)"
          status={status}
          awal={awal.harga_satuan ?? 0}
          inputMode="decimal"
          required
        />
        <Field
          name="reorder_point"
          label="Reorder point"
          status={status}
          awal={awal.reorder_point ?? 0}
          inputMode="decimal"
          required
          petunjuk="Pesan ulang kalau stok di bawah angka ini."
        />
      </div>
      <Pilihan
        name="supplier_id"
        label="Supplier utama"
        status={status}
        awal={awal.supplier_id}
        kosong="— belum ditentukan —"
        opsi={supplier.map((s) => ({ nilai: s.id, label: `${s.nama} (lead time ${s.lead_time_hari} hari)` }))}
        petunjuk="Agen restock membuat draft PO ke supplier ini."
      />
      <p className="text-xs text-slate-500">
        Rumus saran reorder point: pemakaian harian × (lead time + 2 hari cadangan). Penjelasan lengkap di{" "}
        <code>docs/alur-stok.md</code>.
      </p>
      <PesanForm status={status} />
      <div className="flex gap-2">
        <TombolSimpan />
        <Link href="/bahan-baku" className="btn-secondary">
          Batal
        </Link>
      </div>
    </form>
  );
}
