"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, PesanForm, TombolSimpan } from "@/components/form";
import { statusAwal, type StatusForm } from "@/lib/validasi";
import type { Supplier } from "@/lib/tipe";

export function FormSupplier({
  aksi,
  awal,
}: {
  aksi: (prev: StatusForm, fd: FormData) => Promise<StatusForm>;
  awal: Partial<Supplier>;
}) {
  const [status, formAction] = useActionState(aksi, statusAwal);

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field name="kode" label="Kode" status={status} awal={awal.kode} required />
        <Field name="nama" label="Nama supplier" status={status} awal={awal.nama} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="kontak" label="Nama kontak" status={status} awal={awal.kontak} placeholder="Pak/Bu ..." />
        <Field name="telepon" label="Telepon / WhatsApp" status={status} awal={awal.telepon} inputMode="tel" />
      </div>
      <Field name="alamat" label="Alamat" status={status} awal={awal.alamat} />
      <Field
        name="lead_time_hari"
        label="Lead time (hari)"
        status={status}
        awal={awal.lead_time_hari ?? 1}
        inputMode="numeric"
        required
        className="sm:max-w-48"
        petunjuk="Berapa hari barang sampai sejak PO dikirim. Dipakai menghitung reorder point."
      />
      <PesanForm status={status} />
      <div className="flex gap-2">
        <TombolSimpan />
        <Link href="/supplier" className="btn-secondary">
          Batal
        </Link>
      </div>
    </form>
  );
}
