"use client";

import { useState, useTransition } from "react";

/**
 * Tombol yang menjalankan Server Action (mis. kirim/terima/batalkan PO) setelah
 * konfirmasi. Kalau action mengembalikan { pesan }, pesan error ditampilkan.
 * Kalau berhasil, action biasanya revalidatePath sehingga halaman ter-update.
 */
export function TombolAksi({
  aksi,
  children,
  konfirmasi,
  className = "btn-primary",
  labelProses = "Memproses…",
}: {
  aksi: () => Promise<{ pesan?: string } | void>;
  children: React.ReactNode;
  konfirmasi?: string;
  className?: string;
  labelProses?: string;
}) {
  const [pesan, setPesan] = useState("");
  const [pending, startTransition] = useTransition();

  function klik() {
    if (konfirmasi && !window.confirm(konfirmasi)) return;
    setPesan("");
    startTransition(async () => {
      const hasil = await aksi();
      if (hasil?.pesan) setPesan(hasil.pesan);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" onClick={klik} disabled={pending} className={className}>
        {pending ? labelProses : children}
      </button>
      {pesan && (
        <p role="alert" className="max-w-md text-sm text-red-700">
          {pesan}
        </p>
      )}
    </div>
  );
}
