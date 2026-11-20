"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pesanGalat } from "@/lib/galat-db";
import { angkaWajib, bacaForm, idOpsional, teksWajib, type StatusForm } from "@/lib/validasi";

// Catatan: kolom "stok" sengaja TIDAK ada di skema ini. Database menolak
// perubahan stok langsung; stok berubah lewat PO, produksi, atau stok opname.
const skema = z.object({
  kode: teksWajib("Kode", 20),
  nama: teksWajib("Nama bahan"),
  satuan: teksWajib("Satuan", 20),
  reorder_point: angkaWajib("Reorder point"),
  harga_satuan: angkaWajib("Harga satuan"),
  supplier_id: idOpsional,
});

export async function simpanBahan(id: number | null, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skema, fd);
  if (!hasil.ok) return hasil.status;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("bahan_baku").update(hasil.data).eq("id", id)
    : await supabase.from("bahan_baku").insert(hasil.data);
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };

  revalidatePath("/bahan-baku");
  redirect(`/bahan-baku?ok=${id ? "diubah" : "ditambah"}`);
}

export async function hapusBahan(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("bahan_baku").delete().eq("id", id);
  if (error) return { pesan: pesanGalat(error) };
  revalidatePath("/bahan-baku");
  redirect("/bahan-baku?ok=dihapus");
}
