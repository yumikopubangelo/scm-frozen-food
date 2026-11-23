// Menerjemahkan error dari Supabase/Postgres menjadi kalimat yang dimengerti admin.
// Kode error Postgres: https://www.postgresql.org/docs/current/errcodes-appendix.html

import { redirect } from "next/navigation";

type GalatSupabase = { code?: string; message: string; details?: string | null };

const NAMA_TABEL: Record<string, string> = {
  purchase_order: "purchase order",
  po_item: "item purchase order",
  bahan_baku: "bahan baku",
  bom: "BOM (resep produk)",
  produksi: "riwayat produksi",
  pesanan: "pesanan",
  pesanan_item: "item pesanan",
  mutasi_stok: "riwayat mutasi stok",
};

/**
 * Untuk halaman yang MEMBACA data: kalau query gagal (mis. Supabase sedang
 * gangguan), lempar error supaya yang tampil halaman error, BUKAN "404 tidak
 * ditemukan". Tanpa ini, data null karena gangguan terlihat sama dengan data
 * yang memang tidak ada.
 */
export function cekGalatMuat(...galat: (GalatSupabase | null | undefined)[]) {
  const e = galat.find(Boolean);
  if (e) throw new Error(`Gagal memuat data dari database (${e.code ?? "tanpa kode"}): ${e.message}`);
}

export function pesanGalat(e: GalatSupabase): string {
  switch (e.code) {
    case "23505": // unique_violation
      if (/kode/.test(e.message + (e.details ?? ""))) return "Kode itu sudah dipakai. Gunakan kode lain.";
      return "Data yang sama sudah ada.";
    case "23503": {
      // foreign_key_violation: data masih dirujuk tabel lain
      const tabel = /from table "(\w+)"/.exec(e.details ?? "")?.[1];
      const lokasi = tabel ? NAMA_TABEL[tabel] ?? tabel : "data lain";
      return `Tidak bisa dihapus karena masih dipakai di ${lokasi}. Data transaksi lama harus tetap utuh.`;
    }
    case "23514": // check_violation
      return "Nilai tidak valid (misalnya angka negatif).";
    case "42501": // insufficient_privilege
      return "Anda tidak punya izin untuk tindakan ini. Coba login ulang.";
    case "P0001": // raise exception dari fungsi stok: pesannya sudah bahasa Indonesia
      return e.message;
    default:
      return `Terjadi kesalahan database: ${e.message}`;
  }
}

/**
 * Nomor halaman di URL melebihi jumlah data (mis. ?hal=99, atau filter dipersempit
 * saat sedang di halaman 5): PostgREST menolak dengan PGRST103 "Requested range not
 * satisfiable". Itu bukan gangguan, jadi arahkan ke halaman 1 dengan filter yang sama.
 */
export function kembaliKeHalaman1(e: GalatSupabase | null | undefined, basePath: string, params: Record<string, string>) {
  if (e?.code !== "PGRST103") return;
  const qs = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== "hal")).toString();
  redirect(qs ? `${basePath}?${qs}` : basePath);
}
