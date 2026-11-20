"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pesanGalat } from "@/lib/galat-db";
import { angka } from "@/lib/format";
import { angkaWajib, bacaForm, teksOpsional, type StatusForm } from "@/lib/validasi";

const skema = z.object({
  stok_baru: angkaWajib("Stok fisik"),
  keterangan: teksOpsional(200),
});

/**
 * Stok opname: samakan stok sistem dengan hasil hitung fisik di gudang.
 * Memanggil fungsi database sesuaikan_stok, yang mencatat selisihnya di
 * mutasi_stok sebagai "penyesuaian". Kolom stok tidak pernah diubah langsung.
 */
export async function sesuaikanStok(
  target: { jenis: "bahan" | "produk"; id: number; path: string },
  _prev: StatusForm,
  fd: FormData,
): Promise<StatusForm> {
  const hasil = bacaForm(skema, fd);
  if (!hasil.ok) return hasil.status;

  if (target.jenis === "produk" && !Number.isInteger(hasil.data.stok_baru)) {
    return { galat: { stok_baru: "Stok produk harus bilangan bulat (pak)" }, nilai: hasil.nilai, versi: Date.now() };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sesuaikan_stok", {
    p_bahan_id: target.jenis === "bahan" ? target.id : null,
    p_produk_id: target.jenis === "produk" ? target.id : null,
    p_stok_baru: hasil.data.stok_baru,
    p_keterangan: hasil.data.keterangan ?? "Stok opname",
  });
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };

  revalidatePath(target.path);
  return {
    sukses: `Stok sekarang ${angka(hasil.data.stok_baru)}. Kalau ada selisih dengan stok sebelumnya, selisih itu tercatat di mutasi stok.`,
    versi: Date.now(),
  };
}
