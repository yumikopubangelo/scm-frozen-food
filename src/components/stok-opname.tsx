"use client";

import { useActionState } from "react";
import { Field, PesanForm, TombolSimpan } from "@/components/form";
import { statusAwal, type StatusForm } from "@/lib/validasi";
import { angka } from "@/lib/format";

/** Kartu "Stok opname": masukkan hasil hitung fisik, sistem mencatat selisihnya. */
export function StokOpname({
  aksi,
  stok,
  satuan,
}: {
  aksi: (prev: StatusForm, fd: FormData) => Promise<StatusForm>;
  stok: number;
  satuan: string;
}) {
  const [status, formAction] = useActionState(aksi, statusAwal);

  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold">Stok opname</h2>
      <p className="mt-1 text-sm text-slate-500">
        Stok di sistem: <strong className="text-slate-800">{angka(stok)} {satuan}</strong>. Kalau hasil hitung fisik
        berbeda, isi angka sebenarnya. Selisihnya dicatat sebagai &quot;penyesuaian&quot; di mutasi stok.
      </p>
      <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-start">
        <Field name="stok_baru" label={`Stok fisik (${satuan})`} status={status} awal={stok} inputMode="decimal" required />
        <Field name="keterangan" label="Keterangan" status={status} placeholder="Stok opname" />
        <div className="sm:pt-6">
          <TombolSimpan className="btn-secondary">Sesuaikan</TombolSimpan>
        </div>
      </form>
      <div className="mt-3">
        <PesanForm status={status} />
        {status.sukses && (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {status.sukses}
          </p>
        )}
      </div>
    </section>
  );
}
