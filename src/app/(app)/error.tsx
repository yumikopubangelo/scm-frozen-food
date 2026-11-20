"use client";

// Ditampilkan kalau sebuah halaman di dalam (app) melempar error saat dirender
// (misalnya koneksi ke Supabase putus). Sidebar tetap tampil.
export default function ErrorHalaman({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="text-base font-semibold text-slate-800">Terjadi kesalahan saat memuat halaman</p>
      <p className="max-w-md text-sm text-slate-500">{error.message || "Coba muat ulang halaman."}</p>
      <button onClick={reset} className="btn-secondary mt-2">
        Coba lagi
      </button>
    </div>
  );
}
