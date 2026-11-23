// Grafik SVG buatan sendiri (Server Component, tanpa JavaScript di browser).
// Kenapa tidak pakai Recharts/Chart.js? Hanya butuh 2 jenis grafik sederhana;
// SVG murni = 0 KB JavaScript tambahan, langsung tampil saat halaman dimuat,
// dan tooltip cukup memakai elemen <title> bawaan browser.
import { angkaRingkas, skalaRapi } from "@/lib/grafik";

const L = 720; // lebar viewBox
const T = 220; // tinggi viewBox
const KIRI = 52;
const KANAN = 8;
const ATAS = 10;
const BAWAH = 26;
const lebarPlot = L - KIRI - KANAN;
const tinggiPlot = T - ATAS - BAWAH;

/** "2026-11-23" -> "23/11" */
const labelTgl = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export type Seri = { nama: string; warna: string; nilai: number[] };

function Sumbu({ garis, atas, format }: { garis: number[]; atas: number; format: (n: number) => string }) {
  return (
    <g>
      {garis.map((g) => {
        const y = ATAS + tinggiPlot - (g / atas) * tinggiPlot;
        return (
          <g key={g}>
            <line x1={KIRI} x2={L - KANAN} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={KIRI - 6} y={y + 4} textAnchor="end" fontSize={11} fill="#64748b">
              {format(g)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function LabelX({ label, x }: { label: string[]; x: (i: number) => number }) {
  // Tampilkan ±7 label saja supaya tidak bertumpuk; label terakhir (hari ini) selalu tampil.
  const tiap = Math.max(1, Math.ceil(label.length / 7));
  return (
    <g>
      {label.map((l, i) =>
        i % tiap === 0 || i === label.length - 1 ? (
          <text key={i} x={x(i)} y={T - 8} textAnchor="middle" fontSize={11} fill="#64748b">
            {labelTgl(l)}
          </text>
        ) : null,
      )}
    </g>
  );
}

function Legenda({ seri }: { seri: { nama: string; warna: string }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
      {seri.map((s) => (
        <span key={s.nama} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: s.warna }} aria-hidden />
          {s.nama}
        </span>
      ))}
    </div>
  );
}

/**
 * Grafik batang berkelompok per tanggal (mis. masuk vs keluar).
 * `satuan` dipakai di tooltip, mis. "pak" atau "" (untuk rupiah pakai formatNilai).
 */
export function GrafikBatang({
  tanggal,
  seri,
  judul,
  formatNilai = (n) => n.toLocaleString("id-ID"),
}: {
  tanggal: string[];
  seri: Seri[];
  judul: string;
  formatNilai?: (n: number) => string;
}) {
  const max = Math.max(0, ...seri.flatMap((s) => s.nilai));
  const { atas, garis } = skalaRapi(max);
  const lebarHari = lebarPlot / Math.max(1, tanggal.length);
  const lebarBatang = Math.max(2, (lebarHari * 0.75) / seri.length);
  const xTengah = (i: number) => KIRI + lebarHari * (i + 0.5);

  return (
    <figure>
      <Legenda seri={seri} />
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${L} ${T}`} className="h-auto w-full min-w-[540px]" role="img" aria-label={judul}>
          <Sumbu garis={garis} atas={atas} format={angkaRingkas} />
          {tanggal.map((t, i) => (
            <g key={t}>
              {seri.map((s, j) => {
                const v = s.nilai[i] ?? 0;
                const h = (v / atas) * tinggiPlot;
                const x = xTengah(i) - (lebarBatang * seri.length) / 2 + j * lebarBatang;
                return (
                  <rect key={s.nama} x={x} y={ATAS + tinggiPlot - h} width={lebarBatang - 1} height={h} fill={s.warna} rx={1.5}>
                    <title>{`${labelTgl(t)} · ${s.nama}: ${formatNilai(v)}`}</title>
                  </rect>
                );
              })}
            </g>
          ))}
          <line x1={KIRI} x2={L - KANAN} y1={ATAS + tinggiPlot} y2={ATAS + tinggiPlot} stroke="#94a3b8" />
          <LabelX label={tanggal} x={xTengah} />
        </svg>
      </div>
    </figure>
  );
}

/**
 * Grafik garis tangga (step) untuk riwayat stok satu barang.
 * Stok berubah per kejadian, bukan bergerak mulus, jadi garis tangga lebih jujur
 * daripada garis miring. `batas` = garis putus-putus reorder point / stok minimum.
 */
export function GrafikStok({
  titik,
  batas,
  labelBatas,
  satuan,
  judul,
}: {
  titik: { waktu: string; stok: number }[];
  batas?: number;
  labelBatas?: string;
  satuan: string;
  judul: string;
}) {
  if (titik.length === 0) return null;
  const max = Math.max(batas ?? 0, ...titik.map((t) => t.stok));
  const { atas, garis } = skalaRapi(max);
  const t0 = new Date(titik[0].waktu).getTime();
  const t1 = Math.max(t0 + 1, new Date(titik[titik.length - 1].waktu).getTime());
  const x = (w: string) => KIRI + ((new Date(w).getTime() - t0) / (t1 - t0)) * lebarPlot;
  const y = (v: number) => ATAS + tinggiPlot - (v / atas) * tinggiPlot;

  let d = `M ${x(titik[0].waktu)} ${y(titik[0].stok)}`;
  for (let i = 1; i < titik.length; i++) d += ` H ${x(titik[i].waktu)} V ${y(titik[i].stok)}`;

  // Label sumbu X: tanggal awal, tengah, akhir
  const tglX = [0, Math.floor((titik.length - 1) / 2), titik.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const tglWib = (w: string) => new Date(w).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  return (
    <figure>
      <Legenda
        seri={[
          { nama: `Stok (${satuan})`, warna: "#0284c7" },
          ...(batas !== undefined ? [{ nama: labelBatas ?? "Batas", warna: "#f59e0b" }] : []),
        ]}
      />
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${L} ${T}`} className="h-auto w-full min-w-[540px]" role="img" aria-label={judul}>
          <Sumbu garis={garis} atas={atas} format={angkaRingkas} />
          {batas !== undefined && (
            <line x1={KIRI} x2={L - KANAN} y1={y(batas)} y2={y(batas)} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" />
          )}
          <path d={d} fill="none" stroke="#0284c7" strokeWidth={2} />
          {titik.length <= 120 &&
            titik.map((t, i) => (
              <circle key={i} cx={x(t.waktu)} cy={y(t.stok)} r={2.5} fill="#0284c7">
                <title>{`${labelTgl(tglWib(t.waktu))} · stok ${t.stok.toLocaleString("id-ID")} ${satuan}`}</title>
              </circle>
            ))}
          <line x1={KIRI} x2={L - KANAN} y1={ATAS + tinggiPlot} y2={ATAS + tinggiPlot} stroke="#94a3b8" />
          {tglX.map((i) => (
            <text key={i} x={x(titik[i].waktu)} y={T - 8} textAnchor={i === 0 ? "start" : i === titik.length - 1 ? "end" : "middle"} fontSize={11} fill="#64748b">
              {labelTgl(tglWib(titik[i].waktu))}
            </text>
          ))}
        </svg>
      </div>
    </figure>
  );
}
