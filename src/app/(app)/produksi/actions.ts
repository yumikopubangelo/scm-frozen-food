"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pesanGalat } from "@/lib/galat-db";
import { hariIni } from "@/lib/format";
import { bacaForm, bulatWajib, teksOpsional, type StatusForm } from "@/lib/validasi";

const skema = z.object({
  produk_id: z.coerce.number({ error: "Pilih produk" }).int().positive({ error: "Pilih produk" }),
  qty: bulatWajib("Jumlah produksi", { min: 0, lebihDari: true }),
  tanggal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Tanggal tidak valid" })
    .refine((t) => t <= hariIni(), { error: "Tanggal produksi tidak boleh di masa depan" }),
  catatan: teksOpsional(300),
});

/**
 * Catat satu batch produksi. Seluruh perhitungan stok dikerjakan fungsi
 * database catat_produksi dalam satu transaksi:
 *   setiap bahan di BOM  -= qty_per_unit × qty
 *   stok produk          += qty
 * Kalau ada bahan yang kurang, database menolak dan menyebut SEMUA bahan
 * yang kurang; tidak ada stok yang berubah.
 */
export async function catatProduksi(_prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skema, fd);
  if (!hasil.ok) return hasil.status;
  const { produk_id, qty, tanggal, catatan } = hasil.data;

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("catat_produksi", {
    p_produk_id: produk_id,
    p_qty: qty,
    p_catatan: catatan,
    p_tanggal: tanggal,
  });
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };

  revalidatePath("/produksi");
  revalidatePath("/produk");
  revalidatePath("/bahan-baku");
  revalidatePath("/");
  redirect(`/produksi/${id}?ok=produksi-dicatat`);
}
