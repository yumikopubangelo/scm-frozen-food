import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { cekGalatMuat } from "@/lib/galat-db";
import { hitungRencana, type MasukanAgen } from "@/lib/agen-restock";

/** Jendela rata-rata bergerak permintaan (hari penuh terakhir). */
export const HARI_RATA_RATA = 28;

/**
 * Langkah AMATI: baca semua data yang dibutuhkan agen, lalu hitung rencananya.
 * Dipakai halaman (pratinjau) dan Server Action (hitung ulang sebelum menyimpan).
 */
export async function muatRencana(supabase: Awaited<ReturnType<typeof createClient>>) {
  const dihitung = new Date().toISOString(); // sebelum membaca data: lihat simpan_hasil_agen
  const [bahanQ, produkQ, bomQ, pesananQ, poQ, ramalanQ] = await Promise.all([
    supabase.from("bahan_baku").select("id, nama, satuan, stok, reorder_point, harga_satuan, supplier(id, nama, lead_time_hari)").order("nama"),
    supabase.from("produk").select("id, nama, satuan, stok").order("nama"),
    supabase.from("bom").select("produk_id, bahan_id, qty_per_unit"),
    supabase.from("pesanan_item").select("produk_id, qty, pesanan!inner(status)").eq("pesanan.status", "diproses"),
    supabase.from("po_item").select("bahan_id, qty, purchase_order!inner(status)").in("purchase_order.status", ["draft", "dikirim"]),
    supabase.rpc("rata_permintaan_harian", { p_hari: HARI_RATA_RATA }),
  ]);
  cekGalatMuat(bahanQ.error, produkQ.error, bomQ.error, pesananQ.error, poQ.error, ramalanQ.error);

  const masukan: MasukanAgen = {
    bahan: (bahanQ.data ?? []) as unknown as MasukanAgen["bahan"],
    produk: produkQ.data ?? [],
    bom: bomQ.data ?? [],
    pesananTerbuka: (pesananQ.data ?? []).map((i) => ({ produk_id: i.produk_id, qty: i.qty })),
    poTerbuka: (poQ.data ?? []).map((i) => ({ bahan_id: i.bahan_id, qty: Number(i.qty) })),
    ramalan: (ramalanQ.data ?? []) as MasukanAgen["ramalan"],
  };
  return { dihitung, masukan, rencana: hitungRencana(masukan) };
}
