import Link from "next/link";

/**
 * Navigasi halaman (‹ Sebelumnya · Halaman 2 dari 32 · Berikutnya ›).
 * Filter lain di URL (status, q, supplier) tetap dibawa.
 */
export function Paginasi({
  halaman,
  total,
  perHalaman,
  basePath,
  params,
}: {
  halaman: number;
  total: number;
  perHalaman: number;
  basePath: string;
  params: Record<string, string>;
}) {
  const jumlahHalaman = Math.max(1, Math.ceil(total / perHalaman));
  if (jumlahHalaman <= 1) return null;

  const href = (h: number) => {
    const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    if (h > 1) p.set("hal", String(h));
    else p.delete("hal");
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const kelas = "btn-secondary px-3 py-1.5";
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Navigasi halaman">
      {halaman > 1 ? (
        <Link href={href(halaman - 1)} className={kelas}>
          ‹ Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <span className="text-slate-500">
        Halaman {halaman} dari {jumlahHalaman} · {total.toLocaleString("id-ID")} data
      </span>
      {halaman < jumlahHalaman ? (
        <Link href={href(halaman + 1)} className={kelas}>
          Berikutnya ›
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Tab filter status (link biasa, jadi tetap jalan tanpa JavaScript). */
export function TabStatus({
  pilihan,
  aktif,
  basePath,
  params,
}: {
  pilihan: { nilai: string; label: string; jumlah?: number }[];
  aktif: string;
  basePath: string;
  params: Record<string, string>;
}) {
  const href = (nilai: string) => {
    const p = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== "hal" && k !== "status"));
    if (nilai) p.set("status", nilai);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200" role="tablist">
      {pilihan.map((t) => (
        <Link
          key={t.nilai}
          href={href(t.nilai)}
          role="tab"
          aria-selected={aktif === t.nilai}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
            aktif === t.nilai
              ? "border-sky-600 font-medium text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t.label}
          {t.jumlah !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.jumlah}</span>}
        </Link>
      ))}
    </div>
  );
}
