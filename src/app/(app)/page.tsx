import Link from "next/link";
import { Bot } from "lucide-react";
import { GrafikBatang } from "@/components/grafik";
import { JudulHalaman } from "@/components/judul-halaman";
import { Badge, BadgeStatus, BadgeStok } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { angka, hariIni, rupiah, selisihHari, tambahHari, tanggal } from "@/lib/format";
import { STATUS_PESANAN, STATUS_PO, type StatusPesanan, type StatusPo } from "@/lib/status";

type Bahan = {
  id: number;
  nama: string;
  satuan: string;
  stok: number;
  reorder_point: number;
  supplier: { id: number; nama: string } | null;
};
type Produk = { id: number; nama: string; satuan: string; stok: number; stok_minimum: number };
type Po = {
  id: number;
  nomor: string;
  status: StatusPo;
  sumber: "manual" | "agen";
  tanggal: string;
  tanggal_dikirim: string | null;
  supplier: { nama: string; lead_time_hari: number };
  po_item: { bahan_id: number; qty: number }[];
};
type Pesanan = {
  id: number;
  nomor: string;
  status: StatusPesanan;
  tanggal: string;
  reseller: { nama: string };
  pesanan_item: { qty: number; produk_id: number }[];
};
type Harian = { tanggal: string; produk_masuk: number; produk_keluar: number; bahan_masuk_rp: number; bahan_keluar_rp: number };

const HARI_GRAFIK = 30;

export default async function DashboardPage() {
  const supabase = await createClient();

  const [bahanQ, produkQ, poQ, pesananQ, harianQ] = await Promise.all([
    supabase.from("bahan_baku").select("id, nama, satuan, stok, reorder_point, supplier(id, nama)").order("kode"),
    supabase.from("produk").select("id, nama, satuan, stok, stok_minimum").order("kode"),
    supabase
      .from("purchase_order")
      .select("id, nomor, status, sumber, tanggal, tanggal_dikirim, supplier(nama, lead_time_hari), po_item(bahan_id, qty)")
      .in("status", ["draft", "dikirim"])
      .order("tanggal")
      .order("id"),
    supabase
      .from("pesanan")
      .select("id, nomor, status, tanggal, reseller(nama), pesanan_item(qty, produk_id)")
      .in("status", ["diproses", "dikirim"])
      .order("tanggal")
      .order("id"),
    supabase.rpc("mutasi_harian", { p_hari: HARI_GRAFIK }),
  ]);

  const galat = bahanQ.error ?? produkQ.error ?? poQ.error ?? pesananQ.error ?? harianQ.error;
  if (galat) throw new Error(`Gagal memuat data: ${galat.message}`);

  const bahan = (bahanQ.data ?? []) as unknown as Bahan[];
  const produk = (produkQ.data ?? []) as Produk[];
  const po = (poQ.data ?? []) as unknown as Po[];
  const pesanan = (pesananQ.data ?? []) as unknown as Pesanan[];
  const harian = ((harianQ.data ?? []) as Harian[]).map((h) => ({
    tanggal: h.tanggal,
    produkMasuk: Number(h.produk_masuk),
    produkKeluar: Number(h.produk_keluar),
    bahanMasuk: Number(h.bahan_masuk_rp),
    bahanKeluar: Number(h.bahan_keluar_rp),
  }));

  // ---- Stok kritis ----
  // Bahan yang sedang dipesan (PO draft/dikirim) per bahan: supaya admin tahu
  // mana yang SUDAH ditangani dan mana yang belum ada PO sama sekali.
  const dipesan = new Map<number, number>();
  for (const p of po) for (const i of p.po_item) dipesan.set(i.bahan_id, (dipesan.get(i.bahan_id) ?? 0) + Number(i.qty));

  // PostgREST tidak bisa membandingkan dua kolom (stok < reorder_point), jadi disaring di sini (puluhan baris).
  const bahanKritis = bahan
    .filter((b) => Number(b.stok) < Number(b.reorder_point))
    .sort((a, b) => Number(a.stok) / Number(a.reorder_point) - Number(b.stok) / Number(b.reorder_point));
  const tanpaPo = bahanKritis.filter((b) => !dipesan.has(b.id));
  const produkKritis = produk.filter((p) => p.stok < p.stok_minimum);

  // Kebutuhan produk dari pesanan yang belum dikirim
  const stokProduk = new Map(produk.map((p) => [p.id, p.stok]));
  const dipesanReseller = new Map<number, number>();
  for (const ps of pesanan)
    if (ps.status === "diproses") for (const i of ps.pesanan_item) dipesanReseller.set(i.produk_id, (dipesanReseller.get(i.produk_id) ?? 0) + i.qty);

  // ---- Dokumen berjalan ----
  const hari = hariIni();
  const poTerlambat = po.filter((p) => p.status === "dikirim" && p.tanggal_dikirim && tambahHari(p.tanggal_dikirim, p.supplier.lead_time_hari) < hari);
  const pesananDiproses = pesanan.filter((p) => p.status === "diproses");
  const siapKirim = (ps: Pesanan) => ps.pesanan_item.every((i) => (stokProduk.get(i.produk_id) ?? 0) >= i.qty);
  const jumlahSiap = pesananDiproses.filter(siapKirim).length;

  // ---- Ringkasan 30 hari ----
  const total = (k: keyof (typeof harian)[number]) => harian.reduce((s, h) => s + (h[k] as number), 0);

  const kartu = [
    {
      label: "Bahan di bawah reorder point",
      nilai: bahanKritis.length,
      dari: bahan.length,
      catatan: tanpaPo.length ? `${tanpaPo.length} belum ada PO` : "semua sudah dipesan",
      warna: "text-red-600",
      href: "/bahan-baku?kritis=1",
    },
    {
      label: "Produk di bawah stok minimum",
      nilai: produkKritis.length,
      dari: produk.length,
      catatan: produkKritis.length ? "perlu dijadwalkan produksi" : "stok aman",
      warna: "text-amber-600",
      href: "/produk",
    },
    {
      label: "PO berjalan",
      nilai: po.length,
      catatan: `${po.filter((p) => p.status === "draft").length} draft · ${po.filter((p) => p.status === "dikirim").length} dikirim${poTerlambat.length ? ` · ${poTerlambat.length} terlambat` : ""}`,
      warna: "text-sky-700",
      href: "/purchase-order",
    },
    {
      label: "Pesanan berjalan",
      nilai: pesanan.length,
      catatan: `${pesananDiproses.length} diproses (${jumlahSiap} siap kirim) · ${pesanan.length - pesananDiproses.length} dikirim`,
      warna: "text-sky-700",
      href: "/pesanan",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <JudulHalaman judul="Dashboard" deskripsi={`Ringkasan rantai pasok Galunggung Frozen Food per ${tanggal(hari)}.`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kartu.map((k) => (
          <Link key={k.label} href={k.href} className="card block p-5 transition hover:ring-2 hover:ring-sky-200">
            <p className="text-sm text-slate-500">{k.label}</p>
            <p className={`mt-2 text-3xl font-semibold tabular-nums ${k.warna}`}>
              {k.nilai}
              {k.dari !== undefined && <span className="text-base font-normal text-slate-400"> / {k.dari}</span>}
            </p>
            <p className="mt-1 text-xs text-slate-500">{k.catatan}</p>
          </Link>
        ))}
      </div>

      {tanpaPo.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <strong>{tanpaPo.length} bahan</strong> di bawah reorder point belum punya PO:{" "}
            {tanpaPo.slice(0, 4).map((b) => b.nama).join(", ")}
            {tanpaPo.length > 4 && `, dan ${tanpaPo.length - 4} lainnya`}.
          </p>
          <Link href="/agen-restock" className="btn-primary shrink-0">
            <Bot className="size-4" aria-hidden /> Jalankan agen restock
          </Link>
        </div>
      )}

      {/* ---- Grafik pergerakan stok ---- */}
      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Arus barang jadi — {HARI_GRAFIK} hari terakhir</h2>
          <p className="text-xs text-slate-500">
            Diproduksi {angka(total("produkMasuk"))} pak · dikirim {angka(total("produkKeluar"))} pak
          </p>
        </div>
        <GrafikBatang
          judul="Grafik pak diproduksi dan dikirim per hari"
          tanggal={harian.map((h) => h.tanggal)}
          seri={[
            { nama: "Diproduksi (masuk gudang barang jadi)", warna: "#10b981", nilai: harian.map((h) => h.produkMasuk) },
            { nama: "Dikirim ke reseller (keluar)", warna: "#f97316", nilai: harian.map((h) => h.produkKeluar) },
          ]}
          formatNilai={(n) => `${angka(n)} pak`}
        />
      </section>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Nilai bahan baku — {HARI_GRAFIK} hari terakhir</h2>
          <p className="text-xs text-slate-500">
            Diterima {rupiah(total("bahanMasuk"))} · terpakai {rupiah(total("bahanKeluar"))}
          </p>
        </div>
        <GrafikBatang
          judul="Grafik nilai bahan diterima dari PO dan terpakai produksi per hari"
          tanggal={harian.map((h) => h.tanggal)}
          seri={[
            { nama: "Diterima dari supplier (PO)", warna: "#0284c7", nilai: harian.map((h) => h.bahanMasuk) },
            { nama: "Terpakai produksi", warna: "#a855f7", nilai: harian.map((h) => h.bahanKeluar) },
          ]}
          formatNilai={rupiah}
        />
        <p className="mt-2 text-xs text-slate-500">
          Bahan punya satuan berbeda (kg, liter, butir), jadi dijumlahkan dalam rupiah: jumlah × harga satuan saat ini. Rincian per barang
          ada di <Link href="/mutasi-stok" className="text-sky-700 hover:underline">Mutasi stok</Link>.
        </p>
      </section>

      {/* ---- Stok kritis ---- */}
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <section className="card p-5">
          <h2 className="text-base font-semibold">Bahan baku kritis ({bahanKritis.length})</h2>
          <p className="mb-3 mt-1 text-xs text-slate-500">Diurutkan dari yang paling jauh di bawah reorder point.</p>
          {bahanKritis.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Semua bahan di atas reorder point.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabel min-w-0">
                <thead>
                  <tr>
                    <th>Bahan</th>
                    <th className="text-right">Stok / ROP</th>
                    <th className="text-right">Sedang dipesan</th>
                  </tr>
                </thead>
                <tbody>
                  {bahanKritis.slice(0, 8).map((b) => (
                    <tr key={b.id}>
                      <td>
                        <Link href={`/bahan-baku/${b.id}`} className="font-medium hover:underline">
                          {b.nama}
                        </Link>
                        <span className="block text-xs text-slate-500">{b.supplier?.nama ?? "tanpa supplier"}</span>
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        <BadgeStok stok={Number(b.stok)} batas={Number(b.reorder_point)} />{" "}
                        <span className="ml-1">
                          {angka(b.stok)} / {angka(b.reorder_point)} {b.satuan}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {dipesan.has(b.id) ? (
                          `${angka(dipesan.get(b.id))} ${b.satuan}`
                        ) : b.supplier ? (
                          <Link href={`/purchase-order/baru?supplier=${b.supplier.id}`} className="text-xs font-medium text-sky-700 hover:underline">
                            Buat PO
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">–</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bahanKritis.length > 8 && (
                <Link href="/bahan-baku?kritis=1" className="mt-3 inline-block text-sm text-sky-700 hover:underline">
                  Lihat semua {bahanKritis.length} bahan kritis →
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-base font-semibold">Stok barang jadi</h2>
          <p className="mb-3 mt-1 text-xs text-slate-500">Dibandingkan stok minimum dan pesanan reseller yang belum dikirim.</p>
          <div className="overflow-x-auto">
            <table className="tabel min-w-0">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th className="text-right">Stok</th>
                  <th className="text-right">Dipesan</th>
                </tr>
              </thead>
              <tbody>
                {[...produk]
                  .sort((a, b) => a.stok - (dipesanReseller.get(a.id) ?? 0) - (b.stok - (dipesanReseller.get(b.id) ?? 0)))
                  .map((p) => {
                    const butuh = dipesanReseller.get(p.id) ?? 0;
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/produk/${p.id}`} className="font-medium hover:underline">
                            {p.nama}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right tabular-nums">
                          <BadgeStok stok={p.stok} batas={p.stok_minimum} /> <span className="ml-1">{angka(p.stok)}</span>
                        </td>
                        <td className={`whitespace-nowrap text-right tabular-nums ${butuh > p.stok ? "font-medium text-red-700" : ""}`}>
                          {butuh ? `${angka(butuh)} ${p.satuan}` : "–"}
                          {butuh > p.stok && (
                            <Link href={`/produksi/baru?produk=${p.id}`} className="block text-xs font-medium text-sky-700 hover:underline">
                              kurang {angka(butuh - p.stok)} · produksi
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ---- Dokumen berjalan ---- */}
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <section className="card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">PO berjalan ({po.length})</h2>
            <Link href="/purchase-order" className="text-sm text-sky-700 hover:underline">
              Semua PO →
            </Link>
          </div>
          {po.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Tidak ada PO yang sedang berjalan.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {po.slice(0, 6).map((p) => {
                const tiba = p.tanggal_dikirim ? tambahHari(p.tanggal_dikirim, p.supplier.lead_time_hari) : null;
                const telat = tiba && tiba < hari ? selisihHari(tiba, hari) : 0;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/purchase-order/${p.id}`} className="font-medium hover:underline">
                        {p.nomor}
                      </Link>
                      {p.sumber === "agen" && (
                        <span className="ml-2">
                          <Badge warna="biru">agen</Badge>
                        </span>
                      )}
                      <p className="truncate text-xs text-slate-500">
                        {p.supplier.nama}
                        {tiba && ` · perkiraan tiba ${tanggal(tiba)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {telat > 0 && <Badge warna="merah">Terlambat {telat} hari</Badge>}
                      <BadgeStatus info={STATUS_PO[p.status]} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Pesanan berjalan ({pesanan.length})</h2>
            <Link href="/pesanan" className="text-sm text-sky-700 hover:underline">
              Semua pesanan →
            </Link>
          </div>
          {pesanan.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Tidak ada pesanan yang sedang berjalan.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pesanan.slice(0, 6).map((ps) => (
                <li key={ps.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <Link href={`/pesanan/${ps.id}`} className="font-medium hover:underline">
                      {ps.nomor}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {ps.reseller.nama} · {angka(ps.pesanan_item.reduce((s, i) => s + i.qty, 0))} pak · {tanggal(ps.tanggal)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {ps.status === "diproses" && (siapKirim(ps) ? <Badge warna="hijau">Siap kirim</Badge> : <Badge warna="merah">Stok kurang</Badge>)}
                    <BadgeStatus info={STATUS_PESANAN[ps.status]} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-slate-500">
        Label sumbu: rb = ribu, jt = juta. Arahkan kursor ke batang untuk melihat angka tepatnya.
      </p>
    </div>
  );
}
