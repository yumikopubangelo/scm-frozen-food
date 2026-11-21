"use client";

import { useActionState } from "react";
import { Field, PesanForm, TombolSimpan } from "@/components/form";
import { statusAwal, type StatusForm } from "@/lib/validasi";

/** Form satu baris untuk catatan dokumen (PO, pesanan). */
export function CatatanDokumen({
  aksi,
  awal,
  placeholder = "mis. minta dikirim pagi",
}: {
  aksi: (p: StatusForm, fd: FormData) => Promise<StatusForm>;
  awal: string | null;
  placeholder?: string;
}) {
  const [status, formAction] = useActionState(aksi, statusAwal);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Field name="catatan" label="Catatan" status={status} awal={awal} className="flex-1" placeholder={placeholder} />
        <TombolSimpan className="btn-secondary">Simpan</TombolSimpan>
      </div>
      <PesanForm status={status} />
      {status.sukses && <p className="text-xs text-emerald-700">{status.sukses}</p>}
    </form>
  );
}
