import Link from "next/link";
import type { Metadata } from "next";
import { Bot, CheckCircle2, Eye, Calculator, ClipboardList, UserCheck } from "lucide-react";
import { JudulHalaman } from "@/components/judul-halaman";
import { TombolAksi } from "@/components/tombol-aksi";
import { Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { cekGalatMuat } from "@/lib/galat-db";
import { paramTeks } from "@/lib/cari";
import { angka, rupiah } from "@/lib/format";
import { sidikRencana, type BarisRencana } from "@/lib/agen-restock";
import { jalankanAgen } from "./actions";
import { HARI_RATA_RATA, muatRencana } from "./data";

export const metadata: Metadata = { title: "Agen restock" };

type Log = { id: number; waktu: string; jumlah_po_dibuat: number; ringkasan: { total_biaya?: number; po?: { id: number; nomor: string }[] } };

const jamWib = (w: string) =>
  new Date(w).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const LANGKAH = [
  { ikon: Eye, judul: "1. Amati", isi: "Baca stok bahan, pesanan reseller yang belum dikirim, PO yang sedang berjalan, dan permintaan harian per produk." },
  { ikon: Calculator, judul: "2. Hitung", isi: "Kebutuhan bahan = maks(kekurangan pesanan × resep, permintaan selama lead time × resep). Pesan bila proyeksi stok < reorder point." },
  { ikon: ClipboardList, judul: "3. Usulkan", isi: "Kelompokkan per supplier utama dan buat satu DRAFT PO per supplier. Tidak ada yang dikirim ke supplier." },
  { ikon: UserCheck, judul: "4. Anda setujui", isi: "Periksa draft di halaman PO, ubah jumlah bila perlu, lalu tekan \"Setujui & kirim ke supplier\"." },
];

export default async function AgenRestockPage({ searchParams }: PageProps<"/agen-restock">) {
  const sp = await searchParams;
  const logId = Number.parseInt(paramTeks(sp.log), 10);
  const supabase = await createClient();

  const [{ dihitung, masukan, rencana }, riwayatQ] = await Promise.all([
    muatRencana(supabase),
    supabase.from("agen_log").select("id, waktu, jumlah_po_dibuat, ringkasan").order("waktu", { ascending: false }).limit(10),
  ]);
  cekGalatMuat(riwayatQ.error);
  const riwayat = (riwayatQ.data ?? []) as Log[];
  const hasil = Number.isInteger(logId) ? riwayat.find((l) => l.id === logId) : undefined;

  const dipesan = rencana.baris.filter((b) => b.status === "pesan");
  const tanpaSupplier = rencana.baris.filter((b) => b.status === "tanpa_supplier");
  const aman = rencana.baris.filter((b) => b.status === "aman");
  const jumlahPesanan = masukan.pesananTerbuka.length;
  const pakaiS4 = rencana.sumberRamalan.includes("s4");

  return (
    <div className="flex flex-col gap-6">
      <JudulHalaman
        judul="Agen restock"
        deskripsi="Agen berbasis aturan yang mengusulkan pembelian bahan baku. Agen hanya membuat DRAFT PO; keputusan kirim ke supplier tetap di tangan admin."
      />

      {hasil && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-4" aria-hidden /> Agen membuat {hasil.jumlah_po_dibuat} draft PO
            {hasil.ringkasan.total_biaya ? ` senilai ${rupiah(hasil.ringkasan.total_biaya)}` : ""}.
          </p>
          <p className="mt-1">Belum ada yang dikirim ke supplier. Buka tiap draft, periksa jumlahnya, lalu setujui:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {(hasil.ringkasan.po ?? []).map((p) => (
              <li key={p.id}>
                <Link href={`/purchase-order/${p.id}`} className="btn-secondary">
                  {p.nomor}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Cara kerja ---- */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LANGKAH.map((l) => (
          <div key={l.judul} className="card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <l.ikon className="size-4 text-sky-700" aria-hidden /> {l.judul}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{l.isi}</p>
          </div>
        ))}
      </section>

      {/* ---- Yang diamati ---- */}
      <section className="card p-5">
        <h2 className="text-base font-semibold">Yang diamati agen sekarang</h2>
        <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li>
            • {masukan.bahan.length} bahan baku; <strong>{masukan.bahan.filter((b) => Number(b.stok) < Number(b.reorder_point)).length}</strong> di bawah reorder point
          </li>
          <li>
            • {jumlahPesanan} baris pesanan reseller berstatus <em>diproses</em>
          </li>
          <li>
            • {masukan.poTerbuka.length} baris PO berjalan (draft + dikirim), dikurangkan dari kebutuhan
          </li>
          <li>
            • Permintaan harian:{" "}
            {pakaiS4 ? (
              <>
                <Badge warna="biru">ramalan S4</Badge> untuk produk yang punya ramalan, sisanya rata-rata {HARI_RATA_RATA} hari
              </>
            ) : (
              <>rata-rata bergerak {HARI_RATA_RATA} hari terakhir (pak dikirim ÷ {HARI_RATA_RATA})</>
            )}
          </li>
        </ul>
        {rencana.kekuranganProduk.length > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Barang jadi yang kurang untuk pesanan reseller:</p>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {rencana.kekuranganProduk.map((k) => (
                <li key={k.produk_id}>
                  {k.nama}: dipesan {angka(k.dipesan)}, stok {angka(k.stok)} →{" "}
                  <Link href={`/produksi/baru?produk=${k.produk_id}`} className="font-medium underline">
                    kurang {angka(k.kurang)} {k.satuan}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Agen memesan bahannya; produksinya tetap dicatat admin setelah bahan datang.</p>
          </div>
        )}
      </section>

      {/* ---- Usulan ---- */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Usulan pembelian</h2>
            <p className="text-sm text-slate-500">
              {rencana.grup.length > 0
                ? `${dipesan.length} bahan dari ${rencana.grup.length} supplier · perkiraan total ${rupiah(rencana.totalBiaya)}`
                : "Tidak ada bahan yang perlu dipesan saat ini."}
            </p>
          </div>
          {rencana.grup.length > 0 && (
            <TombolAksi
              aksi={jalankanAgen.bind(null, dihitung, sidikRencana(rencana))}
              konfirmasi={`Buat ${rencana.grup.length} draft PO (total ${rupiah(rencana.totalBiaya)})? Draft belum dikirim ke supplier sampai Anda setujui.`}
              labelProses="Membuat draft PO…"
            >
              <Bot className="size-4" aria-hidden /> Buat {rencana.grup.length} draft PO
            </TombolAksi>
          )}
        </div>

        {rencana.grup.map((g) => (
          <div key={g.supplier.id} className="card p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                {g.supplier.nama} <span className="text-sm font-normal text-slate-500">· lead time {g.supplier.lead_time_hari} hari</span>
              </h3>
              <p className="text-sm">
                Draft PO: <strong className="tabular-nums">{rupiah(g.total)}</strong>
              </p>
            </div>
            <TabelRencana baris={g.items} />
          </div>
        ))}

        {tanpaSupplier.length > 0 && (
          <div className="card border-red-200 p-5">
            <h3 className="font-semibold text-red-700">Perlu dipesan, tapi belum punya supplier ({tanpaSupplier.length})</h3>
            <TabelRencana baris={tanpaSupplier} />
          </div>
        )}

        <details className="card p-5">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Bahan yang aman ({aman.length}) — tidak dipesan</summary>
          <div className="mt-3">
            <TabelRencana baris={aman} />
          </div>
        </details>
      </section>

      {/* ---- Riwayat ---- */}
      <section className="card p-5">
        <h2 className="text-base font-semibold">Riwayat agen</h2>
        <p className="mb-3 mt-1 text-xs text-slate-500">Setiap kali agen membuat draft, keputusan dan alasannya disimpan di tabel <code>agen_log</code>.</p>
        {riwayat.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Agen belum pernah dijalankan.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {riwayat.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-slate-600">{jamWib(l.waktu)}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {l.jumlah_po_dibuat} draft PO{l.ringkasan.total_biaya ? ` · ${rupiah(l.ringkasan.total_biaya)}` : ""}
                  {(l.ringkasan.po ?? []).map((p) => (
                    <Link key={p.id} href={`/purchase-order/${p.id}`} className="text-sky-700 hover:underline">
                      {p.nomor}
                    </Link>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TabelRencana({ baris }: { baris: BarisRencana[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="tabel">
        <thead>
          <tr>
            <th>Bahan</th>
            <th className="text-right">Stok / ROP</th>
            <th className="text-right">Sedang dipesan</th>
            <th className="text-right">Kebutuhan</th>
            <th className="text-right">Proyeksi</th>
            <th className="text-right">Usulan</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.bahan_id} className="align-top">
              <td>
                <Link href={`/bahan-baku/${b.bahan_id}`} className="font-medium hover:underline">
                  {b.nama}
                </Link>
                {b.alasan.length > 0 && (
                  <details className="mt-1 text-xs text-slate-600">
                    <summary className="cursor-pointer text-sky-700">Alasan</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {b.alasan.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </td>
              <td className="whitespace-nowrap text-right tabular-nums">
                <span className={b.stok < b.reorder_point ? "font-medium text-red-700" : ""}>{angka(b.stok)}</span> / {angka(b.reorder_point)} {b.satuan}
              </td>
              <td className="whitespace-nowrap text-right tabular-nums">{b.dalam_po ? angka(b.dalam_po) : "–"}</td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {angka(b.kebutuhan)}
                {b.kebutuhan > 0 && (
                  <span className="block text-xs text-slate-500">{b.butuh_pesanan >= b.butuh_ramalan ? "dari pesanan" : "dari ramalan"}</span>
                )}
              </td>
              <td className={`whitespace-nowrap text-right tabular-nums ${b.proyeksi < b.reorder_point ? "text-red-700" : ""}`}>{angka(b.proyeksi)}</td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {b.qty_pesan > 0 ? (
                  <>
                    <strong>
                      {angka(b.qty_pesan)} {b.satuan}
                    </strong>
                    <span className="block text-xs text-slate-500">{rupiah(b.biaya)}</span>
                  </>
                ) : (
                  "–"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
