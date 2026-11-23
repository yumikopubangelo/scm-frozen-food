"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pesanGalat } from "@/lib/galat-db";
import { sidikRencana } from "@/lib/agen-restock";
import { HARI_RATA_RATA, muatRencana } from "./data";

/**
 * Langkah BERTINDAK. `dihitung` & `sidik` berasal dari pratinjau yang dilihat admin.
 * Rencana DIHITUNG ULANG di server (data dari browser tidak dipercaya), lalu
 * dibandingkan sidiknya: kalau beda, data sudah berubah -> admin diminta memeriksa ulang.
 */
export async function jalankanAgen(dihitung: string, sidik: string): Promise<{ pesan?: string }> {
  const supabase = await createClient();
  const { rencana } = await muatRencana(supabase);

  if (sidikRencana(rencana) !== sidik) {
    return { pesan: "Data stok/pesanan/PO berubah sejak pratinjau ditampilkan. Muat ulang halaman, periksa usulan baru, lalu jalankan lagi." };
  }
  if (rencana.grup.length === 0) return { pesan: "Tidak ada bahan yang perlu dipesan." };

  const grup = rencana.grup.map((g) => ({
    supplier_id: g.supplier.id,
    items: g.items.map((i) => ({ bahan_id: i.bahan_id, qty: i.qty_pesan, harga_satuan: i.harga_satuan })),
  }));
  // Jejak keputusan untuk agen_log: cukup bahan yang diputuskan dipesan / bermasalah
  const ringkasan = {
    hari_rata_rata: HARI_RATA_RATA,
    sumber_ramalan: rencana.sumberRamalan,
    total_biaya: rencana.totalBiaya,
    kekurangan_produk: rencana.kekuranganProduk,
    bahan: rencana.baris
      .filter((b) => b.status !== "aman")
      .map((b) => ({
        bahan_id: b.bahan_id,
        nama: b.nama,
        stok: b.stok,
        reorder_point: b.reorder_point,
        dalam_po: b.dalam_po,
        kebutuhan: b.kebutuhan,
        qty_pesan: b.qty_pesan,
        status: b.status,
        alasan: b.alasan,
      })),
  };

  const { data, error } = await supabase.rpc("simpan_hasil_agen", { p_grup: grup, p_ringkasan: ringkasan, p_dihitung: dihitung });
  if (error) return { pesan: pesanGalat(error) };

  revalidatePath("/", "layout");
  redirect(`/agen-restock?log=${(data as { log_id: number }).log_id}`);
}
