// Halaman sementara (M0). Akan diganti dashboard di M7.
const alur = [
  "Supplier",
  "Gudang bahan baku",
  "Produksi",
  "Gudang barang jadi",
  "Reseller / toko",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div>
        <p className="text-sm font-medium text-sky-700">UMKM Frozen Food · Tasikmalaya</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          SCM Galunggung Frozen Food
        </h1>
        <p className="mt-3 text-slate-600">
          Aplikasi sedang dibangun. Milestone berjalan: <strong>M0 — setup proyek</strong>.
        </p>
      </div>
      <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {alur.map((tahap, i) => (
          <li key={tahap} className="flex items-center gap-2">
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
              {tahap}
            </span>
            {i < alur.length - 1 && (
              <span aria-hidden className="text-slate-400 rotate-90 sm:rotate-0">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}
