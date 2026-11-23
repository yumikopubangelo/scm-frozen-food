// Perhitungan murni untuk grafik SVG (tanpa pustaka grafik).
// Dipisah dari komponen supaya bisa diuji unit.

/**
 * Batas atas sumbu Y yang "rapi" + garis bantu.
 * Contoh: max 237 -> atas 250, garis [0, 50, 100, 150, 200, 250].
 * Langkah dipilih dari deret 1-2-2,5-5 x 10^n supaya label mudah dibaca.
 */
export function skalaRapi(max: number, targetGaris = 5): { atas: number; garis: number[] } {
  if (!Number.isFinite(max) || max <= 0) return { atas: 1, garis: [0, 1] };
  const kasar = max / targetGaris;
  const pangkat = 10 ** Math.floor(Math.log10(kasar));
  const langkah = [1, 2, 2.5, 5, 10].map((k) => k * pangkat).find((l) => l >= kasar - 1e-9) ?? 10 * pangkat;
  const atas = Math.ceil(max / langkah - 1e-9) * langkah;
  const garis: number[] = [];
  for (let v = 0; v <= atas + langkah / 2; v += langkah) garis.push(Number(v.toPrecision(12)));
  return { atas, garis };
}

/** Label ringkas sumbu: 1.250.000 -> "1,3 jt", 12.000 -> "12 rb". */
export function angkaRingkas(n: number): string {
  const abs = Math.abs(n);
  const f = (x: number) => x.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  if (abs >= 1e9) return `${f(n / 1e9)} M`;
  if (abs >= 1e6) return `${f(n / 1e6)} jt`;
  if (abs >= 1e3) return `${f(n / 1e3)} rb`;
  return f(n);
}
