"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pesanGalat } from "@/lib/galat-db";
import { angkaWajib, bacaForm, bulatWajib, teksOpsional, type StatusForm } from "@/lib/validasi";

// =====================================================================
// Membuat pesanan reseller. Item dikirim dari form sebagai JSON (baris
// dinamis), lalu fungsi database buat_pesanan membuat header + item dalam
// SATU transaksi. Pesanan baru berstatus "diproses": stok BELUM berubah.
// =====================================================================

const skemaItem = z.object({
  produk_id: z.number().int().positive({ error: "Pilih produk" }),
  qty: z
    .number({ error: "Jumlah harus angka" })
    .int({ error: "Jumlah harus bilangan bulat (pak)" })
    .positive({ error: "Jumlah harus lebih dari 0" }),
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
  revalidatePath("/");
  redirect(`/pesanan/${id}?ok=ditambah`);
}

// =====================================================================
// Perubahan status: semuanya lewat fungsi database.
//   kirim_pesanan   diproses -> dikirim   stok produk -= qty (mutasi_stok)
//   terima_pesanan  dikirim  -> diterima  stok tidak berubah
//   batalkan_pesanan diproses -> dibatalkan (stok belum keluar)
// =====================================================================

const HASIL = { kirim_pesanan: "dikirim", terima_pesanan: "diterima", batalkan_pesanan: "dibatalkan" } as const;

async function jalankan(fungsi: keyof typeof HASIL, pesananId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fungsi, { p_pesanan_id: pesananId });
  if (error) return { pesan: pesanGalat(error) };
  revalidatePath("/pesanan");
  revalidatePath("/produk");
  revalidatePath("/mutasi-stok");
  revalidatePath("/");
  redirect(`/pesanan/${pesananId}?ok=pesanan-${HASIL[fungsi]}`);
}

/** diproses -> dikirim. Stok setiap produk di pesanan berkurang (ditolak kalau ada yang kurang). */
export async function kirimPesanan(pesananId: number) {
  return jalankan("kirim_pesanan", pesananId);
}

/** dikirim -> diterima (konfirmasi dari reseller). */
export async function terimaPesanan(pesananId: number) {
  return jalankan("terima_pesanan", pesananId);
}

export async function batalkanPesanan(pesananId: number) {
  return jalankan("batalkan_pesanan", pesananId);
}

export async function simpanCatatanPesanan(pesananId: number, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(z.object({ catatan: teksOpsional(300) }), fd);
  if (!hasil.ok) return hasil.status;
  const supabase = await createClient();
  const { error } = await supabase.from("pesanan").update({ catatan: hasil.data.catatan }).eq("id", pesananId);
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };
  revalidatePath(`/pesanan/${pesananId}`);
  return { sukses: "Catatan disimpan.", versi: Date.now() };
}

// =====================================================================
// Edit item selama pesanan masih DIPROSES. Trigger database
// (_jaga_item_pesanan) menolak perubahan setelah pesanan dikirim.
// =====================================================================

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
