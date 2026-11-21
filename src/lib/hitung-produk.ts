// Perhitungan turunan dari BOM. Dipakai di daftar produk, detail produk, dan form produksi.

type BahanDiBom = { qty_per_unit: number; bahan_baku: { stok: number; harga_satuan: number } | null };

/**
 * Pembagian yang dibulatkan ke bawah, tahan galat pecahan biner.
 * Di JavaScript 0.6 / 0.15 = 3.9999999999999996, sehingga Math.floor memberi 3
 * padahal jawabannya 4. Toleransi 1e-9 jauh di bawah ketelitian stok (0,01).
 */
export function bagiBulatBawah(a: number, b: number) {
  return Math.floor(a / b + 1e-9);
}

/** Pembulatan 2 desimal, sama dengan round(x, 2) di database (_mutasi). */
export const bulat2 = (x: number) => Math.round(x * 100 + Number.EPSILON) / 100;

/**
 * Biaya bahan per pak (HPP bahan) = Σ (qty_per_unit × harga_satuan bahan).
 * Belum termasuk tenaga kerja, listrik/freezer, dan susut; jadi ini batas bawah HPP.
 */
export function biayaBahanPerPak(bom: BahanDiBom[]) {
  return bom.reduce((s, b) => s + Number(b.qty_per_unit) * Number(b.bahan_baku?.harga_satuan ?? 0), 0);
}

/**
 * Kapasitas produksi dari stok sekarang = min over bahan ( ⌊stok / qty_per_unit⌋ ).
 * Bahan yang paling cepat habis (bottleneck) menentukan jumlah pak maksimum.
 * Produk tanpa BOM -> null (tidak bisa diproduksi).
 */
export function kapasitasProduksi(bom: BahanDiBom[]): number | null {
  if (bom.length === 0) return null;
  return Math.min(...bom.map((b) => bagiBulatBawah(Number(b.bahan_baku?.stok ?? 0), Number(b.qty_per_unit))));
}

export type BarisKebutuhan = {
  bahan_id: number;
  nama: string;
  satuan: string;
  butuh: number;
  stok: number;
  sisa: number;
  kurang: number;
};

/**
 * Kebutuhan bahan untuk memproduksi `qty` pak:
 *   butuh = qty_per_unit × qty   (dibulatkan 2 desimal seperti di database)
 *   kurang = max(0, butuh − stok)
 * Dipakai untuk pratinjau di form produksi sebelum disimpan.
 */
export function kebutuhanProduksi(
  bom: { qty_per_unit: number; bahan_baku: { id: number; nama: string; satuan: string; stok: number } }[],
  qty: number,
): BarisKebutuhan[] {
  return bom.map((b) => {
    const butuh = bulat2(Number(b.qty_per_unit) * qty);
    const stok = Number(b.bahan_baku.stok);
    return {
      bahan_id: b.bahan_baku.id,
      nama: b.bahan_baku.nama,
      satuan: b.bahan_baku.satuan,
      butuh,
      stok,
      sisa: bulat2(stok - butuh),
      kurang: Math.max(0, bulat2(butuh - stok)),
    };
  });
}
