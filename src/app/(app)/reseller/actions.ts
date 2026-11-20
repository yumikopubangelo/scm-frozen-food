"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pesanGalat } from "@/lib/galat-db";
import { bacaForm, teksOpsional, teksWajib, type StatusForm } from "@/lib/validasi";

const skema = z.object({
  kode: teksWajib("Kode", 20),
  nama: teksWajib("Nama reseller/toko"),
  tipe: z.enum(["reseller", "toko"], { error: "Pilih tipe" }),
  telepon: teksOpsional(30),
  alamat: teksOpsional(200),
  kota: teksOpsional(80),
});

export async function simpanReseller(id: number | null, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skema, fd);
  if (!hasil.ok) return hasil.status;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("reseller").update(hasil.data).eq("id", id)
    : await supabase.from("reseller").insert(hasil.data);
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };

  revalidatePath("/reseller");
  redirect(`/reseller?ok=${id ? "diubah" : "ditambah"}`);
}

export async function hapusReseller(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("reseller").delete().eq("id", id);
  if (error) return { pesan: pesanGalat(error) };
  revalidatePath("/reseller");
  redirect("/reseller?ok=dihapus");
}
