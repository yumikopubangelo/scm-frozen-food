"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pesanGalat } from "@/lib/galat-db";
import { angkaWajib, bacaForm, bulatWajib, teksWajib, type StatusForm } from "@/lib/validasi";

// ---------- Produk ----------

const skemaProduk = z.object({
  kode: teksWajib("Kode", 20),
  nama: teksWajib("Nama produk"),
  satuan: teksWajib("Satuan", 20),
  harga_jual: angkaWajib("Harga jual"),
  stok_minimum: bulatWajib("Stok minimum", { min: 0 }),
});

export async function simpanProduk(id: number | null, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skemaProduk, fd);
  if (!hasil.ok) return hasil.status;

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("produk").update(hasil.data).eq("id", id);
    if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };
    revalidatePath("/produk");
    redirect(`/produk?ok=diubah`);
  }

  // Produk baru langsung dibuka halaman detailnya supaya BOM bisa diisi
  const { data, error } = await supabase.from("produk").insert(hasil.data).select("id").single();
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };
  revalidatePath("/produk");
  redirect(`/produk/${data.id}?ok=ditambah`);
}

export async function hapusProduk(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("produk").delete().eq("id", id);
  if (error) return { pesan: pesanGalat(error) };
  revalidatePath("/produk");
  redirect("/produk?ok=dihapus");
}

// ---------- BOM (resep) ----------

const skemaBom = z.object({
  bahan_id: z.coerce.number({ error: "Pilih bahan" }).int().positive({ error: "Pilih bahan" }),
  qty_per_unit: angkaWajib("Jumlah per pak", { min: 0, lebihDari: true }),
});

export async function tambahBom(produkId: number, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skemaBom, fd);
  if (!hasil.ok) return hasil.status;

  const supabase = await createClient();
  const { error } = await supabase.from("bom").insert({ produk_id: produkId, ...hasil.data });
  if (error) {
    const pesan = error.code === "23505" ? "Bahan itu sudah ada di resep. Ubah jumlahnya di baris yang ada." : pesanGalat(error);
    return { pesan, nilai: hasil.nilai, versi: Date.now() };
  }
  revalidatePath(`/produk/${produkId}`);
  return { sukses: "Bahan ditambahkan ke resep.", versi: Date.now() };
}

const skemaQty = z.object({ qty_per_unit: angkaWajib("Jumlah per pak", { min: 0, lebihDari: true }) });

export async function ubahBom(bomId: number, produkId: number, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skemaQty, fd);
  if (!hasil.ok) return hasil.status;

  const supabase = await createClient();
  const { error } = await supabase.from("bom").update(hasil.data).eq("id", bomId);
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };
  revalidatePath(`/produk/${produkId}`);
  return { sukses: "Tersimpan", versi: Date.now() };
}

export async function hapusBom(bomId: number, produkId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("bom").delete().eq("id", bomId);
  if (error) return { pesan: pesanGalat(error) };
  revalidatePath(`/produk/${produkId}`);
}
