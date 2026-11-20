// Format tampilan angka & tanggal gaya Indonesia (titik ribuan, koma desimal).

const rp = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const tgl = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

/** 52000 -> "Rp 52.000" */
export const rupiah = (n: number | string | null | undefined) => rp.format(Number(n ?? 0));

/** 1234.5 -> "1.234,5" */
export const angka = (n: number | string | null | undefined) => num.format(Number(n ?? 0));

/** "2026-11-20" -> "20 Nov 2026" (tanggal tanpa jam dibaca sebagai tanggal WIB) */
export const tanggal = (s: string | null | undefined) =>
  s ? tgl.format(new Date(s.length === 10 ? `${s}T00:00:00+07:00` : s)) : "–";

/**
 * Kode berikutnya dari daftar kode yang ada: ["SUP-01","SUP-08"] -> "SUP-09".
 * Dipakai sebagai saran di form tambah (admin tetap boleh mengganti).
 */
export function kodeBerikutnya(kodeAda: string[], awalan: string, digit = 2) {
  const maks = kodeAda
    .filter((k) => k.startsWith(awalan))
    .map((k) => Number.parseInt(k.slice(awalan.length), 10))
    .filter(Number.isFinite)
    .reduce((a, b) => Math.max(a, b), 0);
  return awalan + String(maks + 1).padStart(digit, "0");
}
