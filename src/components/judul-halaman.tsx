/** Judul + deskripsi singkat di atas setiap halaman, dengan slot tombol aksi di kanan. */
export function JudulHalaman({
  judul,
  deskripsi,
  aksi,
}: {
  judul: string;
  deskripsi?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{judul}</h1>
        {deskripsi && <p className="mt-1 text-sm text-slate-500">{deskripsi}</p>}
      </div>
      {aksi && <div className="flex shrink-0 gap-2">{aksi}</div>}
    </div>
  );
}

/** Penanda halaman yang belum dibangun (dipakai sementara sampai milestone-nya tiba). */
export function SegeraHadir({ milestone, isi }: { milestone: string; isi: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-medium text-slate-700">Halaman ini dibangun di milestone {milestone}</p>
      <p className="max-w-md text-sm text-slate-500">{isi}</p>
    </div>
  );
}
