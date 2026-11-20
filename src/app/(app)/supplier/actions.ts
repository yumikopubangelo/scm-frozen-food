"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pesanGalat } from "@/lib/galat-db";
import { bacaForm, bulatWajib, teksOpsional, teksWajib, type StatusForm } from "@/lib/validasi";

const skema = z.object({
  kode: teksWajib("Kode", 20),
  nama: teksWajib("Nama supplier"),
  kontak: teksOpsional(80),
  telepon: teksOpsional(30),
  alamat: teksOpsional(200),
  lead_time_hari: bulatWajib("Lead time", { min: 0 }),
});

/** Tambah (id = null) atau ubah supplier. Dipanggil lewat useActionState di form. */
export async function simpanSupplier(id: number | null, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skema, fd);
  if (!hasil.ok) return hasil.status;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("supplier").update(hasil.data).eq("id", id)
    : await supabase.from("supplier").insert(hasil.data);
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };

  revalidatePath("/supplier");
  redirect(`/supplier?ok=${id ? "diubah" : "ditambah"}`);
}

export async function hapusSupplier(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("supplier").delete().eq("id", id);
  if (error) return { pesan: pesanGalat(error) };
  revalidatePath("/supplier");
  redirect("/supplier?ok=dihapus");
}
