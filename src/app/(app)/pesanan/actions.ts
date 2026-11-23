"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pesanGalat } from "@/lib/galat-db";
import { angkaWajib, bacaForm, bulatWajib, teksOpsional, type StatusForm } from "@/lib/validasi";

// =====================================================================
// Pesanan reseller: diproses -> dikirim -> diterima (atau dibatalkan).
// Stok produk BERKURANG saat dikirim (barang keluar gudang barang jadi),
// bukan saat pesanan dicatat. Pesanan yang masih diproses dihitung sebagai
// "kebutuhan" oleh agen restock (M8).
// =====================================================================

const skemaItem = z.object({
  produk_id: z.number().int().positive({ error: "Pilih produk" }),
  qty: z.number({ error: "Jumlah harus angka" }).int({ error: "Jumlah harus bilangan bulat (pak)" }).positive({ error: "Jumlah harus lebih dari 0" }),
  harga_satuan: z.number({ error: "Harga harus angka" }).min(0, { error: "Harga tidak boleh negatif" }),
});

const skemaPesanan = z.object({
  reseller_id: z.coerce.number({ error: "Pilih reseller" }).int().positive({ error: "Pilih reseller" }),
  catatan: teksOpsional(300),
  items: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Daftar produk tidak terbaca" });
        return z.NEVER;
      }
    })
    .pipe(z.array(skemaItem).min(1, { error: "Tambahkan minimal satu produk" })),
});

export async function buatPesanan(_prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skemaPesanan, fd);
  if (!hasil.ok) return hasil.status;
  const { reseller_id, catatan, items } = hasil.data;

  const ids = items.map((i) => i.produk_id);
  if (new Set(ids).size !== ids.length) {
    return { pesan: "Ada produk yang dipilih dua kali. Gabungkan jumlahnya di satu baris.", nilai: hasil.nilai, versi: Date.now() };
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("buat_pesanan", {
    p_reseller_id: reseller_id,
    p_items: items,
    p_catatan: catatan,
  });
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };

  revalidatePath("/pesanan");
  redirect(`/pesanan/${id}?ok=ditambah`);
}

const HASIL = { kirim_pesanan: "dikirim", terima_pesanan: "diterima", batalkan_pesanan: "dibatalkan" } as const;

async function jalankan(fungsi: keyof typeof HASIL, pesananId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fungsi, { p_pesanan_id: pesananId });
  if (error) return { pesan: pesanGalat(error) };
  revalidatePath("/pesanan");
  revalidatePath("/produk");
  revalidatePath("/");
  redirect(`/pesanan/${pesananId}?ok=pesanan-${HASIL[fungsi]}`);
}

/** diproses -> dikirim. Stok setiap produk berkurang; ditolak kalau ada yang kurang. */
export async function kirimPesanan(id: number) {
  return jalankan("kirim_pesanan", id);
}

/** dikirim -> diterima (konfirmasi dari reseller). Stok tidak berubah lagi. */
export async function terimaPesanan(id: number) {
  return jalankan("terima_pesanan", id);
}

/** Hanya pesanan yang belum dikirim yang bisa dibatalkan. */
export async function batalkanPesanan(id: number) {
  return jalankan("batalkan_pesanan", id);
}

export async function simpanCatatanPesanan(id: number, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(z.object({ catatan: teksOpsional(300) }), fd);
  if (!hasil.ok) return hasil.status;
  const supabase = await createClient();
  const { error } = await supabase.from("pesanan").update({ catatan: hasil.data.catatan }).eq("id", id);
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };
  revalidatePath(`/pesanan/${id}`);
  return { sukses: "Catatan disimpan.", versi: Date.now() };
}

// ---------- Edit item selama pesanan masih "diproses" (trigger DB menjaga) ----------

const skemaUbahItem = z.object({
  qty: bulatWajib("Jumlah", { min: 0, lebihDari: true }),
  harga_satuan: angkaWajib("Harga"),
});

export async function ubahItemPesanan(itemId: number, pesananId: number, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skemaUbahItem, fd);
  if (!hasil.ok) return hasil.status;
  const supabase = await createClient();
  const { error } = await supabase.from("pesanan_item").update(hasil.data).eq("id", itemId);
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };
  revalidatePath(`/pesanan/${pesananId}`);
  return { sukses: "Tersimpan", versi: Date.now() };
}

export async function hapusItemPesanan(itemId: number, pesananId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("pesanan_item").delete().eq("id", itemId);
  if (error) return { pesan: pesanGalat(error) };
  revalidatePath(`/pesanan/${pesananId}`);
}

const skemaTambahItem = z.object({
  produk_id: z.coerce.number({ error: "Pilih produk" }).int().positive({ error: "Pilih produk" }),
  qty: bulatWajib("Jumlah", { min: 0, lebihDari: true }),
});

export async function tambahItemPesanan(pesananId: number, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skemaTambahItem, fd);
  if (!hasil.ok) return hasil.status;
  const supabase = await createClient();
  const { data: produk } = await supabase.from("produk").select("harga_jual").eq("id", hasil.data.produk_id).single();
  const { error } = await supabase
    .from("pesanan_item")
    .insert({ pesanan_id: pesananId, ...hasil.data, harga_satuan: produk?.harga_jual ?? 0 });
  if (error) {
    const pesan = error.code === "23505" ? "Produk itu sudah ada di pesanan ini. Ubah jumlahnya di baris yang ada." : pesanGalat(error);
    return { pesan, nilai: hasil.nilai, versi: Date.now() };
  }
  revalidatePath(`/pesanan/${pesananId}`);
  return { sukses: "Produk ditambahkan.", versi: Date.now() };
}
