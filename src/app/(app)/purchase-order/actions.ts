"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pesanGalat } from "@/lib/galat-db";
import { angkaWajib, bacaForm, teksOpsional, type StatusForm } from "@/lib/validasi";

// =====================================================================
// Membuat PO baru. Item dikirim dari form sebagai JSON (baris dinamis),
// lalu diteruskan ke fungsi database buat_po yang membuat header + item
// dalam SATU transaksi (tidak mungkin ada PO tanpa item).
// =====================================================================

const skemaItem = z.object({
  bahan_id: z.number().int().positive({ error: "Pilih bahan" }),
  qty: z.number({ error: "Jumlah harus angka" }).positive({ error: "Jumlah harus lebih dari 0" }),
  harga_satuan: z.number({ error: "Harga harus angka" }).min(0, { error: "Harga tidak boleh negatif" }),
});

const skemaPo = z.object({
  supplier_id: z.coerce.number({ error: "Pilih supplier" }).int().positive({ error: "Pilih supplier" }),
  catatan: teksOpsional(300),
  items: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Daftar bahan tidak terbaca" });
        return z.NEVER;
      }
    })
    .pipe(z.array(skemaItem).min(1, { error: "Tambahkan minimal satu bahan" })),
});

export async function buatPo(_prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skemaPo, fd);
  if (!hasil.ok) return hasil.status;
  const { supplier_id, catatan, items } = hasil.data;

  const ids = items.map((i) => i.bahan_id);
  if (new Set(ids).size !== ids.length) {
    return { pesan: "Ada bahan yang dipilih dua kali. Gabungkan jumlahnya di satu baris.", nilai: hasil.nilai, versi: Date.now() };
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("buat_po", {
    p_supplier_id: supplier_id,
    p_items: items,
    p_sumber: "manual",
    p_catatan: catatan,
  });
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };

  revalidatePath("/purchase-order");
  redirect(`/purchase-order/${id}?ok=ditambah`);
}

// =====================================================================
// Perubahan status: semuanya lewat fungsi database (tidak ada UPDATE
// status langsung — role aplikasi memang tidak punya haknya).
// =====================================================================

const HASIL = { kirim_po: "dikirim", terima_po: "diterima", batalkan_po: "dibatalkan" } as const;

async function jalankan(fungsi: keyof typeof HASIL, poId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fungsi, { p_po_id: poId });
  if (error) return { pesan: pesanGalat(error) };
  revalidatePath("/purchase-order");
  revalidatePath("/bahan-baku");
  revalidatePath("/");
  // Redirect dengan ?ok= baru supaya banner menyebut aksi yang barusan terjadi
  redirect(`/purchase-order/${poId}?ok=po-${HASIL[fungsi]}`);
}

/** draft -> dikirim. Ini juga "persetujuan admin" untuk draft buatan agen restock. */
export async function kirimPo(poId: number) {
  return jalankan("kirim_po", poId);
}

/** dikirim -> diterima. Stok setiap bahan di PO bertambah. */
export async function terimaPo(poId: number) {
  return jalankan("terima_po", poId);
}

export async function batalkanPo(poId: number) {
  return jalankan("batalkan_po", poId);
}

export async function simpanCatatanPo(poId: number, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(z.object({ catatan: teksOpsional(300) }), fd);
  if (!hasil.ok) return hasil.status;
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_order").update({ catatan: hasil.data.catatan }).eq("id", poId);
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };
  revalidatePath(`/purchase-order/${poId}`);
  return { sukses: "Catatan disimpan.", versi: Date.now() };
}

// =====================================================================
// Edit item selama PO masih DRAFT. Trigger database (_jaga_item_po)
// menolak perubahan kalau PO sudah dikirim, jadi aman walau tombolnya
// entah bagaimana masih bisa diklik.
// =====================================================================

const skemaUbahItem = z.object({
  qty: angkaWajib("Jumlah", { min: 0, lebihDari: true }),
  harga_satuan: angkaWajib("Harga"),
});

export async function ubahItemPo(itemId: number, poId: number, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skemaUbahItem, fd);
  if (!hasil.ok) return hasil.status;
  const supabase = await createClient();
  const { error } = await supabase.from("po_item").update(hasil.data).eq("id", itemId);
  if (error) return { pesan: pesanGalat(error), nilai: hasil.nilai, versi: Date.now() };
  revalidatePath(`/purchase-order/${poId}`);
  return { sukses: "Tersimpan", versi: Date.now() };
}

export async function hapusItemPo(itemId: number, poId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("po_item").delete().eq("id", itemId);
  if (error) return { pesan: pesanGalat(error) };
  revalidatePath(`/purchase-order/${poId}`);
}

const skemaTambahItem = z.object({
  bahan_id: z.coerce.number({ error: "Pilih bahan" }).int().positive({ error: "Pilih bahan" }),
  qty: angkaWajib("Jumlah", { min: 0, lebihDari: true }),
});

export async function tambahItemPo(poId: number, _prev: StatusForm, fd: FormData): Promise<StatusForm> {
  const hasil = bacaForm(skemaTambahItem, fd);
  if (!hasil.ok) return hasil.status;

  const supabase = await createClient();
  const { data: bahan } = await supabase.from("bahan_baku").select("harga_satuan").eq("id", hasil.data.bahan_id).single();
  const { error } = await supabase
    .from("po_item")
    .insert({ po_id: poId, ...hasil.data, harga_satuan: bahan?.harga_satuan ?? 0 });
  if (error) {
    const pesan = error.code === "23505" ? "Bahan itu sudah ada di PO ini. Ubah jumlahnya di baris yang ada." : pesanGalat(error);
    return { pesan, nilai: hasil.nilai, versi: Date.now() };
  }
  revalidatePath(`/purchase-order/${poId}`);
  return { sukses: "Bahan ditambahkan.", versi: Date.now() };
}
