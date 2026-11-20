"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, PesanForm, TombolSimpan } from "@/components/form";
import { statusAwal, type StatusForm } from "@/lib/validasi";
import type { Produk } from "@/lib/tipe";

export function FormProduk({
  aksi,
  awal,
}: {
  aksi: (prev: StatusForm, fd: FormData) => Promise<StatusForm>;
  awal: Partial<Produk>;
}) {
  const [status, formAction] = useActionState(aksi, statusAwal);

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field name="kode" label="Kode" status={status} awal={awal.kode} required />
        <Field name="nama" label="Nama produk" status={status} awal={awal.nama} required placeholder="mis. Dimsum Ayam isi 10" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="satuan" label="Satuan jual" status={status} awal={awal.satuan ?? "pak"} required />
        <Field name="harga_jual" label="Harga jual (Rp)" status={status} awal={awal.harga_jual ?? 0} inputMode="decimal" required />
        <Field
          name="stok_minimum"
          label="Stok minimum"
          status={status}
          awal={awal.stok_minimum ?? 0}
          inputMode="numeric"
          required
          petunjuk="Di bawah angka ini produk ditandai kritis."
        />
      </div>
      <PesanForm status={status} />
      <div className="flex gap-2">
        <TombolSimpan />
        <Link href="/produk" className="btn-secondary">
          Batal
        </Link>
      </div>
    </form>
  );
}
