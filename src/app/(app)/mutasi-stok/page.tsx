import Link from "next/link";
import type { Metadata } from "next";
import { GrafikStok } from "@/components/grafik";
import { JudulHalaman } from "@/components/judul-halaman";
import { Paginasi } from "@/components/paginasi";
import { Badge, Tabel, TabelKosong } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { paramTeks } from "@/lib/cari";
import { angka, hariIni, tambahHari } from "@/lib/format";
import { cekGalatMuat, kembaliKeHalaman1 } from "@/lib/galat-db";

export const metadata: Metadata = { title: "Mutasi stok" };

const PER_HALAMAN = 50;
const BATAS_GRAFIK = 1000; // batas baris PostgREST per permintaan

const SUMBER = {
  saldo_awal: { label: "Saldo awal", warna: "abu", href: null },
  po: { label: "Terima PO", warna: "biru", href: "/purchase-order" },
  produksi: { label: "Produksi", warna: "hijau", href: "/produksi" },
  pesanan: { label: "Kirim pesanan", warna: "kuning", href: "/pesanan" },
  penyesuaian: { label: "Stok opname", warna: "merah", href: null },
} as const;
type Sumber = keyof typeof SUMBER;

type Baris = {
  id: number;
  waktu: string;
  qty: number;
  stok_setelah: number;
  sumber: Sumber;
  ref_id: number | null;
  keterangan: string | null;
  bahan_baku: { id: number; nama: string; satuan: string } | null;
  produk: { id: number; nama: string; satuan: string } | null;
};

const polaTgl = /^\d{4}-\d{2}-\d{2}$/;
/** Awal hari WIB sebagai timestamptz, mis. "2026-11-23T00:00:00+07:00". */
const awalHariWib = (tgl: string) => `${tgl}T00:00:00+07:00`;
const jamWib = (w: string) =>
  new Date(w).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function MutasiStokPage({ searchParams }: PageProps<"/mutasi-stok">) {
  const sp = await searchParams;
  const hari = hariIni();

  // ---- Baca & bersihkan filter dari URL ----
  const barang = paramTeks(sp.barang); // "b-3" = bahan id 3, "p-2" = produk id 2
  const cocok = /^([bp])-(\d+)$/.exec(barang);
  const jenis = cocok?.[1] as "b" | "p" | undefined;
  const barangId = cocok ? Number(cocok[2]) : null;
  const sumberParam = paramTeks(sp.sumber);
  const sumber = sumberParam in SUMBER ? (sumberParam as Sumber) : "";
  let dari = polaTgl.test(paramTeks(sp.dari)) ? paramTeks(sp.dari) : tambahHari(hari, -29);
  let sampai = polaTgl.test(paramTeks(sp.sampai)) ? paramTeks(sp.sampai) : hari;
  if (dari > sampai) [dari, sampai] = [sampai, dari];
  const halaman = Math.max(1, Number.parseInt(paramTeks(sp.hal), 10) || 1);

  const supabase = await createClient();

  // Filter yang sama dipakai untuk tabel & grafik
  // (Tipe query builder Supabase terlalu dalam untuk generic biasa -> dipersempit ke 3 metode yang dipakai.)
  type Saring = { eq(k: string, v: unknown): Saring; gte(k: string, v: string): Saring; lt(k: string, v: string): Saring };
  const terapkan = <Q,>(q: Q): Q => {
    let r = (q as unknown as Saring).gte("waktu", awalHariWib(dari)).lt("waktu", awalHariWib(tambahHari(sampai, 1)));
    if (jenis === "b") r = r.eq("bahan_id", barangId);
    if (jenis === "p") r = r.eq("produk_id", barangId);
    if (sumber) r = r.eq("sumber", sumber);
    return r as unknown as Q;
  };

  const awal = (halaman - 1) * PER_HALAMAN;
  const [tabelQ, bahanQ, produkQ] = await Promise.all([
    terapkan(
      supabase
        .from("mutasi_stok")
        .select("id, waktu, qty, stok_setelah, sumber, ref_id, keterangan, bahan_baku(id, nama, satuan), produk(id, nama, satuan)", { count: "exact" }),
    )
      .order("waktu", { ascending: false })
      .order("id", { ascending: false })
      .range(awal, awal + PER_HALAMAN - 1),
    supabase.from("bahan_baku").select("id, nama, satuan, reorder_point").order("nama"),
    supabase.from("produk").select("id, nama, satuan, stok_minimum").order("nama"),
  ]);
  const params = { barang, sumber, dari: sp.dari ? dari : "", sampai: sp.sampai ? sampai : "" };
  kembaliKeHalaman1(tabelQ.error, "/mutasi-stok", params);
  cekGalatMuat(tabelQ.error, bahanQ.error, produkQ.error);

  const baris = (tabelQ.data ?? []) as unknown as Baris[];
  const total = tabelQ.count ?? 0;
  const daftarBahan = bahanQ.data ?? [];
  const daftarProduk = produkQ.data ?? [];

  // ---- Grafik riwayat stok (hanya kalau satu barang dipilih) ----
  const terpilih =
    jenis === "b"
      ? daftarBahan.find((b) => b.id === barangId)
      : jenis === "p"
        ? daftarProduk.find((p) => p.id === barangId)
        : undefined;
  let titik: { waktu: string; stok: number }[] = [];
  let ringkas: { masuk: number; keluar: number } | null = null;
  if (terpilih && jenis) {
    const kolom = jenis === "b" ? "bahan_id" : "produk_id";
    const [grafikQ, sebelumQ] = await Promise.all([
      // Ambil yang TERBARU dulu lalu dibalik, supaya kalau >1.000 baris yang terpotong bagian lama.
      terapkan(supabase.from("mutasi_stok").select("waktu, qty, stok_setelah"))
        .order("waktu", { ascending: false })
        .order("id", { ascending: false })
        .limit(BATAS_GRAFIK),
      // Stok tepat sebelum rentang: titik awal garis
      supabase
        .from("mutasi_stok")
        .select("stok_setelah")
        .eq(kolom, barangId)
        .lt("waktu", awalHariWib(dari))
        .order("waktu", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    cekGalatMuat(grafikQ.error, sebelumQ.error);
    const data = ((grafikQ.data ?? []) as { waktu: string; qty: number; stok_setelah: number }[]).reverse();
    if (!sumber) {
      // Titik awal + titik akhir (hari ini / akhir rentang) supaya garis mengisi seluruh rentang
      const stokAwal = sebelumQ.data ? Number(sebelumQ.data.stok_setelah) : null;
      titik = [
        ...(stokAwal !== null ? [{ waktu: awalHariWib(dari), stok: stokAwal }] : []),
        ...data.map((d) => ({ waktu: d.waktu, stok: Number(d.stok_setelah) })),
      ];
      const ujung = sampai >= hari ? new Date().toISOString() : awalHariWib(tambahHari(sampai, 1));
      if (titik.length) titik.push({ waktu: ujung, stok: titik[titik.length - 1].stok });
    }
    ringkas = {
      masuk: data.filter((d) => Number(d.qty) > 0).reduce((s, d) => s + Number(d.qty), 0),
      keluar: data.filter((d) => Number(d.qty) < 0).reduce((s, d) => s - Number(d.qty), 0),
    };
  }

  const satuanTerpilih = terpilih?.satuan ?? "";

  return (
    <>
      <JudulHalaman
        judul="Mutasi stok"
        deskripsi="Buku besar semua pergerakan stok bahan baku dan barang jadi. Setiap baris ditulis otomatis oleh fungsi database saat PO diterima, produksi dicatat, pesanan dikirim, atau stok opname."
      />

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Barang</span>
          <select name="barang" defaultValue={barang} className="input">
            <option value="">Semua barang</option>
            <optgroup label="Bahan baku">
              {daftarBahan.map((b) => (
                <option key={b.id} value={`b-${b.id}`}>
                  {b.nama}
                </option>
              ))}
            </optgroup>
            <optgroup label="Produk (barang jadi)">
              {daftarProduk.map((p) => (
                <option key={p.id} value={`p-${p.id}`}>
                  {p.nama}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Jenis</span>
          <select name="sumber" defaultValue={sumber} className="input">
            <option value="">Semua jenis</option>
            {Object.entries(SUMBER).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Dari</span>
          <input type="date" name="dari" defaultValue={dari} max={hari} className="input" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Sampai</span>
          <input type="date" name="sampai" defaultValue={sampai} max={hari} className="input" />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            Terapkan
          </button>
          <Link href="/mutasi-stok" className="btn-secondary">
            Reset
          </Link>
        </div>
      </form>

      {terpilih && ringkas && (
        <section className="card mb-4 p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">
              Riwayat stok{" "}
              <Link href={jenis === "b" ? `/bahan-baku/${barangId}` : `/produk/${barangId}`} className="text-sky-700 hover:underline">
                {terpilih.nama}
              </Link>
            </h2>
            <p className="text-xs text-slate-500">
              Masuk <strong className="text-emerald-700">{angka(ringkas.masuk)}</strong> · keluar{" "}
              <strong className="text-red-700">{angka(ringkas.keluar)}</strong> {satuanTerpilih} dalam rentang ini
            </p>
          </div>
          {titik.length > 1 ? (
            <GrafikStok
              judul={`Grafik stok ${terpilih.nama}`}
              titik={titik}
              satuan={satuanTerpilih}
              batas={"reorder_point" in terpilih ? Number(terpilih.reorder_point) : Number(terpilih.stok_minimum)}
              labelBatas={"reorder_point" in terpilih ? "Reorder point" : "Stok minimum"}
            />
          ) : (
            <p className="py-4 text-center text-sm text-slate-500">
              {sumber ? "Grafik stok hanya tampil untuk semua jenis mutasi (filter jenis dikosongkan)." : "Belum ada mutasi untuk digambar dalam rentang ini."}
            </p>
          )}
          {total > BATAS_GRAFIK && <p className="mt-2 text-xs text-amber-700">Rentang berisi lebih dari {angka(BATAS_GRAFIK)} mutasi; grafik hanya menampilkan yang terbaru. Persempit tanggalnya.</p>}
        </section>
      )}

      <Tabel>
        <thead>
          <tr>
            <th>Waktu (WIB)</th>
            <th>Barang</th>
            <th>Jenis</th>
            <th className="text-right">Perubahan</th>
            <th className="text-right">Stok setelah</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {baris.length === 0 && <TabelKosong kolom={6}>Tidak ada mutasi stok dengan filter ini.</TabelKosong>}
          {baris.map((m) => {
            const b = m.bahan_baku ?? m.produk;
            const info = SUMBER[m.sumber];
            const satuan = b?.satuan ?? "";
            return (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-xs text-slate-600">{jamWib(m.waktu)}</td>
                <td>
                  <Link href={`/mutasi-stok?${new URLSearchParams({ ...params, barang: m.bahan_baku ? `b-${b?.id}` : `p-${b?.id}` })}`} className="font-medium hover:underline">
                    {b?.nama}
                  </Link>
                  <span className="block text-xs text-slate-500">{m.bahan_baku ? "Bahan baku" : "Barang jadi"}</span>
                </td>
                <td>
                  <Badge warna={info.warna}>{info.label}</Badge>
                </td>
                <td className={`whitespace-nowrap text-right font-medium tabular-nums ${Number(m.qty) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {Number(m.qty) > 0 ? "+" : ""}
                  {angka(m.qty)} <span className="text-xs font-normal text-slate-500">{satuan}</span>
                </td>
                <td className="whitespace-nowrap text-right tabular-nums">{angka(m.stok_setelah)}</td>
                <td className="text-sm text-slate-600">
                  {info.href && m.ref_id ? (
                    <Link href={`${info.href}/${m.ref_id}`} className="text-sky-700 hover:underline">
                      {m.keterangan}
                    </Link>
                  ) : (
                    m.keterangan
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Tabel>
      <Paginasi halaman={halaman} total={total} perHalaman={PER_HALAMAN} basePath="/mutasi-stok" params={params} />
    </>
  );
}
