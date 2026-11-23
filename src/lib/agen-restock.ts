// Agen restock — inti perhitungan (fungsi murni, tanpa database, diuji unit).
//
// Siklus agen:  AMATI (data stok, pesanan, PO, ramalan)  ->  PUTUSKAN (rumus di bawah)
//               ->  BERTINDAK (buat DRAFT PO per supplier)  ->  manusia menyetujui.
// Agen TIDAK pernah mengirim PO ke supplier sendiri; admin yang menekan
// "Setujui & kirim ke supplier" di halaman PO.
//
// Rumus per bahan b (penjelasan lengkap: docs/agen-restock.md):
//   kurang_p        = max(0, Σ pesanan diproses produk p − stok p)              [pak]
//   butuhPesanan_b  = Σ_p kurang_p × bom(p, b)                                  [satuan bahan]
//   butuhRamalan_b  = Σ_p permintaanHarian_p × leadTime(supplier b) × bom(p, b)
//   kebutuhan_b     = max(butuhPesanan_b, butuhRamalan_b)
//   proyeksi_b      = stok_b + dalamPo_b − kebutuhan_b
//   pesan bila proyeksi_b < reorderPoint_b:
//   qty_b           = bulatkanKeAtas(kebutuhan_b + reorderPoint_b − stok_b − dalamPo_b, kelipatan satuan)
import { bulat2 } from "./hitung-produk";

export type SupplierAgen = { id: number; nama: string; lead_time_hari: number };
export type BahanAgen = {
  id: number;
  nama: string;
  satuan: string;
  stok: number;
  reorder_point: number;
  harga_satuan: number;
  supplier: SupplierAgen | null;
};
export type ProdukAgen = { id: number; nama: string; satuan: string; stok: number };
export type BomAgen = { produk_id: number; bahan_id: number; qty_per_unit: number };
/** Item pesanan reseller berstatus "diproses" (belum keluar gudang). */
export type ItemPesananTerbuka = { produk_id: number; qty: number };
/** Item PO berstatus "draft" atau "dikirim" (barang belum masuk gudang). */
export type ItemPoTerbuka = { bahan_id: number; qty: number };
/** Permintaan harian per produk: rata-rata bergerak atau ramalan S4 (M8b). */
export type RamalanAgen = { produk_id: number; rata_harian: number; sumber: string };

export type MasukanAgen = {
  bahan: BahanAgen[];
  produk: ProdukAgen[];
  bom: BomAgen[];
  pesananTerbuka: ItemPesananTerbuka[];
  poTerbuka: ItemPoTerbuka[];
  ramalan: RamalanAgen[];
};

export type KekuranganProduk = { produk_id: number; nama: string; satuan: string; dipesan: number; stok: number; kurang: number };

export type StatusBaris = "pesan" | "aman" | "tanpa_supplier";

export type BarisRencana = {
  bahan_id: number;
  nama: string;
  satuan: string;
  supplier: SupplierAgen | null;
  stok: number;
  reorder_point: number;
  dalam_po: number;
  butuh_pesanan: number;
  butuh_ramalan: number;
  kebutuhan: number;
  proyeksi: number;
  qty_pesan: number;
  harga_satuan: number;
  biaya: number;
  status: StatusBaris;
  alasan: string[];
};

export type GrupSupplier = { supplier: SupplierAgen; items: BarisRencana[]; total: number };

export type RencanaAgen = {
  baris: BarisRencana[];
  grup: GrupSupplier[];
  kekuranganProduk: KekuranganProduk[];
  sumberRamalan: string[];
  totalBiaya: number;
};

const TOL = 1e-9;

/**
 * Kelipatan pembelian per satuan: kemasan dibeli per bal (lembar per 100, pcs per 50),
 * bahan curah per 1 satuan utuh (kg, liter, butir). Sama dengan aturan ROP di seed.sql.
 */
export function kelipatanSatuan(satuan: string): number {
  if (satuan === "lembar") return 100;
  if (satuan === "pcs") return 50;
  return 1;
}

/** Bulatkan ke atas ke kelipatan, tahan galat float (3,0000000001 tetap 3). */
export function bulatkanKeAtas(x: number, kelipatan: number): number {
  if (x <= TOL) return 0;
  return Math.ceil(x / kelipatan - TOL) * kelipatan;
}

const fmt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });

export function hitungRencana(m: MasukanAgen): RencanaAgen {
  // ---- 1. Kekurangan barang jadi dari pesanan yang belum dikirim ----
  const dipesan = new Map<number, number>();
  for (const i of m.pesananTerbuka) dipesan.set(i.produk_id, (dipesan.get(i.produk_id) ?? 0) + Number(i.qty));
  const kekuranganProduk: KekuranganProduk[] = m.produk
    .map((p) => {
      const d = dipesan.get(p.id) ?? 0;
      return { produk_id: p.id, nama: p.nama, satuan: p.satuan, dipesan: d, stok: Number(p.stok), kurang: Math.max(0, d - Number(p.stok)) };
    })
    .filter((k) => k.kurang > 0);
  const kurangPer = new Map(kekuranganProduk.map((k) => [k.produk_id, k.kurang]));

  // ---- 2. Bahan yang sudah dipesan (PO draft/dikirim) ----
  const dalamPo = new Map<number, number>();
  for (const i of m.poTerbuka) dalamPo.set(i.bahan_id, (dalamPo.get(i.bahan_id) ?? 0) + Number(i.qty));

  const rataPer = new Map(m.ramalan.map((r) => [r.produk_id, Number(r.rata_harian)]));
  const namaProduk = new Map(m.produk.map((p) => [p.id, p.nama]));

  // ---- 3. Per bahan: kebutuhan, proyeksi, keputusan ----
  const baris: BarisRencana[] = m.bahan.map((b) => {
    const stok = Number(b.stok);
    const rop = Number(b.reorder_point);
    const po = dalamPo.get(b.id) ?? 0;
    const lead = b.supplier?.lead_time_hari ?? 0;
    const resep = m.bom.filter((r) => r.bahan_id === b.id);

    let butuhPesanan = 0;
    const pemicu: string[] = [];
    let butuhRamalan = 0;
    for (const r of resep) {
      const kurang = kurangPer.get(r.produk_id) ?? 0;
      if (kurang > 0) {
        butuhPesanan += kurang * Number(r.qty_per_unit);
        pemicu.push(`${namaProduk.get(r.produk_id)} kurang ${fmt(kurang)} pak`);
      }
      butuhRamalan += (rataPer.get(r.produk_id) ?? 0) * lead * Number(r.qty_per_unit);
    }
    butuhPesanan = bulat2(butuhPesanan);
    butuhRamalan = bulat2(butuhRamalan);
    const kebutuhan = Math.max(butuhPesanan, butuhRamalan);
    const proyeksi = bulat2(stok + po - kebutuhan);
    const harga = Number(b.harga_satuan);

    const alasan: string[] = [];
    if (stok < rop) alasan.push(`Stok ${fmt(stok)} ${b.satuan} di bawah reorder point ${fmt(rop)} ${b.satuan}.`);
    if (butuhPesanan > 0) alasan.push(`Pesanan reseller yang belum terkirim butuh ${fmt(butuhPesanan)} ${b.satuan} (${pemicu.join(", ")}).`);
    if (butuhRamalan > 0)
      alasan.push(`Perkiraan pemakaian selama lead time ${lead} hari: ${fmt(butuhRamalan)} ${b.satuan}.`);
    if (po > 0) alasan.push(`Sudah dipesan ${fmt(po)} ${b.satuan} di PO berjalan.`);

    let status: StatusBaris = "aman";
    let qty = 0;
    if (proyeksi < rop - TOL) {
      if (!b.supplier) {
        status = "tanpa_supplier";
        alasan.push("Belum punya supplier utama, jadi tidak bisa dibuatkan PO. Atur di halaman bahan baku.");
      } else {
        status = "pesan";
        qty = bulatkanKeAtas(kebutuhan + rop - stok - po, kelipatanSatuan(b.satuan));
        alasan.push(
          `Proyeksi ${fmt(proyeksi)} < ROP ${fmt(rop)} → pesan ${fmt(kebutuhan)} + ${fmt(rop)} − ${fmt(stok)} − ${fmt(po)}` +
            `${kelipatanSatuan(b.satuan) > 1 ? `, dibulatkan per ${kelipatanSatuan(b.satuan)} ${b.satuan}` : ", dibulatkan ke atas"} = ${fmt(qty)} ${b.satuan}.`,
        );
      }
    }

    return {
      bahan_id: b.id,
      nama: b.nama,
      satuan: b.satuan,
      supplier: b.supplier,
      stok,
      reorder_point: rop,
      dalam_po: po,
      butuh_pesanan: butuhPesanan,
      butuh_ramalan: butuhRamalan,
      kebutuhan,
      proyeksi,
      qty_pesan: qty,
      harga_satuan: harga,
      biaya: Math.round(qty * harga),
      status,
      alasan,
    };
  });

  // ---- 4. Kelompokkan per supplier: satu draft PO per supplier ----
  const grupMap = new Map<number, GrupSupplier>();
  for (const r of baris) {
    if (r.status !== "pesan" || !r.supplier) continue;
    const g = grupMap.get(r.supplier.id) ?? { supplier: r.supplier, items: [], total: 0 };
    g.items.push(r);
    g.total += r.biaya;
    grupMap.set(r.supplier.id, g);
  }
  const grup = [...grupMap.values()].sort((a, b) => a.supplier.nama.localeCompare(b.supplier.nama, "id"));

  // Urutan tampilan: yang perlu dipesan dulu, lalu yang bermasalah, lalu yang aman
  const urut: Record<StatusBaris, number> = { pesan: 0, tanpa_supplier: 1, aman: 2 };
  baris.sort((a, b) => urut[a.status] - urut[b.status] || a.nama.localeCompare(b.nama, "id"));

  return {
    baris,
    grup,
    kekuranganProduk,
    sumberRamalan: [...new Set(m.ramalan.map((r) => r.sumber))],
    totalBiaya: grup.reduce((s, g) => s + g.total, 0),
  };
}

/**
 * Sidik rencana: daftar "supplier:bahan=qty" yang diurutkan. Pratinjau yang dilihat
 * admin mengirim sidiknya; saat tombol ditekan server menghitung ulang dan menolak
 * kalau sidiknya berbeda (data berubah). Jadi yang disimpan = persis yang dilihat.
 */
export function sidikRencana(r: Pick<RencanaAgen, "grup">): string {
  return r.grup
    .flatMap((g) => g.items.map((i) => `${g.supplier.id}:${i.bahan_id}=${i.qty_pesan}`))
    .sort()
    .join(";");
}
