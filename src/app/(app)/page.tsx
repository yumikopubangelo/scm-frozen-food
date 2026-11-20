import { JudulHalaman } from "@/components/judul-halaman";
import { createClient } from "@/lib/supabase/server";

// Dashboard sementara (M2): ringkasan angka untuk membuktikan login + hak akses
// database berjalan. Grafik & daftar lengkap dibangun di M7.
export default async function DashboardPage() {
  const supabase = await createClient();

  const [bahan, po, pesanan, produk] = await Promise.all([
    supabase.from("bahan_baku").select("stok, reorder_point"),
    supabase.from("purchase_order").select("id", { count: "exact", head: true }).in("status", ["draft", "dikirim"]),
    supabase.from("pesanan").select("id", { count: "exact", head: true }).in("status", ["diproses", "dikirim"]),
    supabase.from("produk").select("stok, stok_minimum"),
  ]);

  const galat = bahan.error ?? po.error ?? pesanan.error ?? produk.error;
  if (galat) throw new Error(`Gagal memuat data: ${galat.message}`);
  const daftarBahan = bahan.data ?? [];
  const daftarProduk = produk.data ?? [];

  // PostgREST tidak bisa membandingkan dua kolom (stok < reorder_point) di filter,
  // jadi dihitung di sini. Datanya kecil (puluhan baris).
  const bahanKritis = daftarBahan.filter((b) => Number(b.stok) < Number(b.reorder_point)).length;
  const produkKritis = daftarProduk.filter((p) => p.stok < p.stok_minimum).length;

  const kartu = [
    { label: "Bahan di bawah reorder point", nilai: bahanKritis, dari: daftarBahan.length, warna: "text-red-600" },
    { label: "Produk di bawah stok minimum", nilai: produkKritis, dari: daftarProduk.length, warna: "text-amber-600" },
    { label: "PO berjalan (draft + dikirim)", nilai: po.count ?? 0, warna: "text-sky-700" },
    { label: "Pesanan berjalan (diproses + dikirim)", nilai: pesanan.count ?? 0, warna: "text-sky-700" },
  ];

  return (
    <>
      <JudulHalaman
        judul="Dashboard"
        deskripsi="Ringkasan rantai pasok hari ini. Grafik pergerakan stok menyusul di M7."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kartu.map((k) => (
          <div key={k.label} className="card p-5">
            <p className="text-sm text-slate-500">{k.label}</p>
            <p className={`mt-2 text-3xl font-semibold tabular-nums ${k.warna}`}>
              {k.nilai}
              {k.dari !== undefined && <span className="text-base font-normal text-slate-400"> / {k.dari}</span>}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
