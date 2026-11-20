"use client";

import { useFormStatus } from "react-dom";
import type { StatusForm } from "@/lib/validasi";

type DasarField = {
  name: string;
  label: string;
  status: StatusForm;
  /** Nilai awal (saat edit) */
  awal?: string | number | null;
  petunjuk?: string;
  required?: boolean;
  className?: string;
};

/**
 * Nilai yang ditampilkan: isian terakhir (kalau ada error) atau nilai awal.
 * Angka ditampilkan dengan koma desimal (37,5) agar sama dengan cara admin
 * mengetik; validasi (lib/validasi.ts) menerima koma maupun titik.
 */
const nilaiDari = (s: StatusForm, name: string, awal: DasarField["awal"]) =>
  s.nilai?.[name] ??
  (awal === null || awal === undefined ? "" : typeof awal === "number" ? String(awal).replace(".", ",") : String(awal));

function Label({ htmlFor, label, required }: { htmlFor: string; label: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );
}

function Keterangan({ status, name, petunjuk }: { status: StatusForm; name: string; petunjuk?: string }) {
  const galat = status.galat?.[name];
  if (galat) return <p id={`${name}-galat`} className="text-xs text-red-600">{galat}</p>;
  if (petunjuk) return <p className="text-xs text-slate-500">{petunjuk}</p>;
  return null;
}

/** Input teks/angka dengan label, petunjuk, dan pesan error per kolom. */
export function Field({
  name,
  label,
  status,
  awal,
  petunjuk,
  required,
  className = "",
  ...input
}: DasarField & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "defaultValue">) {
  const galat = status.galat?.[name];
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={name} label={label} required={required} />
      <input
        // key berubah tiap submit -> input dibuat ulang dengan defaultValue terbaru
        key={status.versi ?? 0}
        id={name}
        name={name}
        required={required}
        defaultValue={nilaiDari(status, name, awal)}
        aria-invalid={galat ? true : undefined}
        aria-describedby={galat ? `${name}-galat` : undefined}
        className={`input ${galat ? "border-red-400" : ""}`}
        {...input}
      />
      <Keterangan status={status} name={name} petunjuk={petunjuk} />
    </div>
  );
}

/** Dropdown pilihan. */
export function Pilihan({
  name,
  label,
  status,
  awal,
  petunjuk,
  required,
  className = "",
  opsi,
  kosong,
}: DasarField & { opsi: { nilai: string | number; label: string }[]; kosong?: string }) {
  const galat = status.galat?.[name];
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={name} label={label} required={required} />
      <select
        key={status.versi ?? 0}
        id={name}
        name={name}
        required={required}
        defaultValue={nilaiDari(status, name, awal)}
        aria-invalid={galat ? true : undefined}
        className={`input ${galat ? "border-red-400" : ""}`}
      >
        {kosong !== undefined && <option value="">{kosong}</option>}
        {opsi.map((o) => (
          <option key={o.nilai} value={o.nilai}>
            {o.label}
          </option>
        ))}
      </select>
      <Keterangan status={status} name={name} petunjuk={petunjuk} />
    </div>
  );
}

/** Tombol submit yang otomatis nonaktif + berganti teks saat form diproses. */
export function TombolSimpan({ children = "Simpan", className = "btn-primary" }: { children?: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Menyimpan…" : children}
    </button>
  );
}

/** Kotak pesan error umum di atas/bawah form. */
export function PesanForm({ status }: { status: StatusForm }) {
  if (!status.pesan) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {status.pesan}
    </p>
  );
}
