// Perhitungan turunan dari BOM. Dipakai di daftar produk & halaman detail.

type BahanDiBom = { qty_per_unit: number; bahan_baku: { stok: number; harga_satuan: number } | null };

/**
 * Biaya bahan per pak (HPP bahan) = Σ (qty_per_unit × harga_satuan bahan).
 * Belum termasuk tenaga kerja, listrik/freezer, dan susut; jadi ini batas bawah HPP.
 */
export function biayaBahanPerPak(bom: BahanDiBom[]) {
  return bom.reduce((s, b) => s + Number(b.qty_per_unit) * Number(b.bahan_baku?.harga_satuan ?? 0), 0);
}

/**
 * Kapasitas produksi dari stok sekarang = min over bahan ( floor(stok / qty_per_unit) ).
 * Bahan yang paling cepat habis (bottleneck) menentukan jumlah pak maksimum.
 * Produk tanpa BOM -> null (tidak bisa diproduksi).
 */
export function kapasitasProduksi(bom: BahanDiBom[]): number | null {
  if (bom.length === 0) return null;
  return Math.min(...bom.map((b) => Math.floor(Number(b.bahan_baku?.stok ?? 0) / Number(b.qty_per_unit))));
}
