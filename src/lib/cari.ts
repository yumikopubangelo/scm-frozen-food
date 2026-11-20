/**
 * Membuat filter pencarian PostgREST: cocokkan kata kunci di beberapa kolom.
 *   filterCari("ayam", ["kode","nama"]) -> "kode.ilike.%ayam%,nama.ilike.%ayam%"
 *
 * Karakter , ( ) * % \ dibuang dari kata kunci karena punya arti khusus di
 * sintaks filter PostgREST. Tanpa ini, mengetik "a,b" bisa merusak query
 * atau menyisipkan filter lain (mirip SQL injection versi PostgREST).
 */
export function filterCari(q: string | undefined, kolom: string[]): string | null {
  const bersih = (q ?? "").replace(/[,()*%\\]/g, " ").trim();
  if (!bersih) return null;
  return kolom.map((k) => `${k}.ilike.%${bersih}%`).join(",");
}

/** searchParams bisa string | string[] | undefined; ambil string pertamanya. */
export const paramTeks = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
