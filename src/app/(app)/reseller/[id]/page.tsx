import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JudulHalaman } from "@/components/judul-halaman";
import { TombolHapus } from "@/components/tombol-hapus";
import { Kembali } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";
import { cekGalatMuat } from "@/lib/galat-db";
import type { Reseller } from "@/lib/tipe";
import { hapusReseller, simpanReseller } from "../actions";
import { FormReseller } from "../form-reseller";

export const metadata: Metadata = { title: "Ubah reseller" };

export default async function ResellerDetailPage({ params }: PageProps<"/reseller/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [{ data: r, error: e1 }, { data: semua, error: e2 }, { data: pesanan, error: e3 }] = await Promise.all([
    supabase.from("reseller").select("*").eq("id", id).maybeSingle<Reseller>(),
    supabase.from("reseller").select("kota"),
    supabase.from("pesanan").select("status, pesanan_item(qty, harga_satuan)").eq("reseller_id", id).neq("status", "dibatalkan"),
  ]);
  cekGalatMuat(e1, e2, e3);
  if (!r) notFound();
  const daftarKota = [...new Set((semua ?? []).map((x) => x.kota).filter(Boolean))].sort() as string[];

  // Ringkasan transaksi reseller ini (selain pesanan yang dibatalkan)
  const daftarPesanan = (pesanan ?? []) as { status: string; pesanan_item: { qty: number; harga_satuan: number }[] }[];
  const totalNilai = daftarPesanan.reduce(
    (s, p) => s + p.pesanan_item.reduce((t, i) => t + i.qty * Number(i.harga_satuan), 0),
    0,
  );

  return (
    <div className="max-w-2xl">
      <Kembali href="/reseller">Daftar reseller</Kembali>
      <JudulHalaman
        judul={r.nama}
        deskripsi={`Kode ${r.kode} · ${daftarPesanan.length} pesanan · total ${rupiah(totalNilai)}`}
        aksi={<TombolHapus aksi={hapusReseller.bind(null, id)} nama={`reseller ${r.nama}`} />}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`/pesanan/baru?reseller=${id}`} className="btn-secondary">
          Buat pesanan
        </Link>
        <Link href={`/pesanan?reseller=${id}`} className="btn-secondary">
          Lihat pesanan
        </Link>
      </div>
      <FormReseller aksi={simpanReseller.bind(null, id)} awal={r} daftarKota={daftarKota} />
    </div>
  );
}
