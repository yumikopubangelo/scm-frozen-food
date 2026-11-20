"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

/**
 * Tombol hapus dengan konfirmasi. `aksi` adalah Server Action yang sudah di-bind
 * dengan id (mis. hapusSupplier.bind(null, id)). Kalau berhasil, action melakukan
 * redirect; kalau gagal (mis. masih dipakai di PO), pesannya ditampilkan di sini.
 */
export function TombolHapus({
  aksi,
  nama,
  label = "Hapus",
  kecil = false,
}: {
  aksi: () => Promise<{ pesan?: string } | void>;
  nama: string;
  label?: string;
  kecil?: boolean;
}) {
  const [pesan, setPesan] = useState("");
  const [pending, startTransition] = useTransition();

  function klik() {
    if (!window.confirm(`Hapus ${nama}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setPesan("");
    startTransition(async () => {
      const hasil = await aksi();
      if (hasil?.pesan) setPesan(hasil.pesan);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={klik}
        disabled={pending}
        className={kecil ? "rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" : "btn-secondary text-red-600"}
        aria-label={kecil ? `${label} ${nama}` : undefined}
        title={kecil ? `${label} ${nama}` : undefined}
      >
        <Trash2 className="size-4" aria-hidden />
        {!kecil && (pending ? "Menghapus…" : label)}
      </button>
      {pesan && (
        <p role="alert" className="max-w-sm text-sm text-red-700">
          {pesan}
        </p>
      )}
    </div>
  );
}
