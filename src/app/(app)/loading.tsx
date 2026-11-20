// Kerangka abu-abu yang tampil selagi halaman di dalam (app) dimuat
// (mis. menunggu query Supabase). Sidebar tetap tampil karena ada di layout.
export default function Memuat() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Memuat halaman">
      <div className="mb-2 h-7 w-48 rounded bg-slate-200" />
      <div className="mb-6 h-4 w-80 max-w-full rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-28 bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
