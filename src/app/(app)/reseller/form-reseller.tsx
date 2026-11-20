"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, PesanForm, Pilihan, TombolSimpan } from "@/components/form";
import { statusAwal, type StatusForm } from "@/lib/validasi";
import type { Reseller } from "@/lib/tipe";

export function FormReseller({
  aksi,
  awal,
  daftarKota,
}: {
  aksi: (prev: StatusForm, fd: FormData) => Promise<StatusForm>;
  awal: Partial<Reseller>;
  daftarKota: string[];
}) {
  const [status, formAction] = useActionState(aksi, statusAwal);

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field name="kode" label="Kode" status={status} awal={awal.kode} required />
        <Field name="nama" label="Nama reseller / toko" status={status} awal={awal.nama} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Pilihan
          name="tipe"
          label="Tipe"
          status={status}
          awal={awal.tipe ?? "reseller"}
          required
          opsi={[
            { nilai: "reseller", label: "Reseller (menjual ulang, biasanya rumahan/online)" },
            { nilai: "toko", label: "Toko (warung, minimarket, toko frozen)" },
          ]}
        />
        <Field name="telepon" label="Telepon / WhatsApp" status={status} awal={awal.telepon} inputMode="tel" />
      </div>
      <Field name="alamat" label="Alamat" status={status} awal={awal.alamat} />
      <Field
        name="kota"
        label="Kota / kabupaten"
        status={status}
        awal={awal.kota}
        list="daftar-kota"
        className="sm:max-w-xs"
        petunjuk="Pilih dari saran atau ketik kota baru."
      />
      <datalist id="daftar-kota">
        {daftarKota.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <PesanForm status={status} />
      <div className="flex gap-2">
        <TombolSimpan />
        <Link href="/reseller" className="btn-secondary">
          Batal
        </Link>
      </div>
    </form>
  );
}
