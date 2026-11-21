// Perhitungan pesanan reseller. Dipakai di daftar, form, dan detail pesanan (M6).
// Aturan stok yang sebenarnya tetap dijaga fungsi database kirim_pesanan;
// fungsi di sini hanya untuk PRATINJAU di layar, dengan aturan yang sama.

export type ItemUntukKirim = {
  produk_id: number;
  nama: string;
  satuan: string;
  qty: number;
  stok: number;
};

export type BarisKirim = ItemUntukKirim & {
  /** stok produk setelah pesanan dikirim (tidak pernah negatif) */
  sisa: number;
  /** kekurangan stok; 0 kalau cukup */
  kurang: number;
};

/**
 * Pratinjau pengiriman: stok setiap produk berkurang sebesar qty pesanan.
 *   sisa   = stok − qty
 *   kurang = max(0, qty − stok)
 * Pesanan hanya bisa dikirim kalau SEMUA produk cukup (stok >= qty),
 * sama dengan pemeriksaan "p.stok < i.qty" di kirim_pesanan.
 */
export function cekKirim(items: ItemUntukKirim[]): { baris: BarisKirim[]; bisaKirim: boolean } {
  const baris = items.map((i) => {
    const qty = Number(i.qty);
    const stok = Number(i.stok);
    return { ...i, qty, stok, sisa: Math.max(0, stok - qty), kurang: Math.max(0, qty - stok) };
  });
  return { baris, bisaKirim: baris.length > 0 && baris.every((b) => b.kurang === 0) };
}

/** Total nilai pesanan = Σ qty × harga_satuan. */
export function totalPesanan(items: { qty: number; harga_satuan: number }[]) {
  return items.reduce((s, i) => s + Number(i.qty) * Number(i.harga_satuan), 0);
}

/** Pesanan diproses yang stoknya sudah cukup semua -> siap dikirim. */
export function stokCukup(items: { qty: number; produk: { stok: number } | null }[]) {
  return items.length > 0 && items.every((i) => Number(i.produk?.stok ?? 0) >= Number(i.qty));
}
