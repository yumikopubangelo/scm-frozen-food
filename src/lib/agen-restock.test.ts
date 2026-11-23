import { describe, expect, it } from "vitest";
import { bulatkanKeAtas, hitungRencana, kelipatanSatuan, type MasukanAgen } from "./agen-restock";

const supTelur = { id: 1, nama: "Peternakan Telur", lead_time_hari: 1 };
const supTepung = { id: 2, nama: "Toko Tepung", lead_time_hari: 2 };

/** Contoh kecil: Lumpia butuh 0,1 kg telur + 0,2 kg tepung per pak. */
function masukan(ubah: Partial<MasukanAgen> = {}): MasukanAgen {
  return {
    bahan: [
      { id: 10, nama: "Telur ayam", satuan: "kg", stok: 0, reorder_point: 5, harga_satuan: 28000, supplier: supTelur },
      { id: 11, nama: "Tepung terigu", satuan: "kg", stok: 50, reorder_point: 10, harga_satuan: 12000, supplier: supTepung },
    ],
    produk: [{ id: 1, nama: "Lumpia", satuan: "pak", stok: 0 }],
    bom: [
      { produk_id: 1, bahan_id: 10, qty_per_unit: 0.1 },
      { produk_id: 1, bahan_id: 11, qty_per_unit: 0.2 },
    ],
    pesananTerbuka: [],
    poTerbuka: [],
    ramalan: [],
    ...ubah,
  };
}

const cari = (r: ReturnType<typeof hitungRencana>, id: number) => r.baris.find((b) => b.bahan_id === id)!;

describe("hitungRencana", () => {
  it("stok di bawah ROP tanpa kebutuhan lain -> isi sampai ROP", () => {
    const r = hitungRencana(masukan());
    const telur = cari(r, 10);
    expect(telur.status).toBe("pesan");
    expect(telur.qty_pesan).toBe(5); // 0 + 5 - 0 - 0
    expect(telur.biaya).toBe(140000);
    expect(cari(r, 11).status).toBe("aman");
    expect(r.grup).toHaveLength(1);
    expect(r.grup[0].supplier.id).toBe(1);
  });

  it("pesanan reseller yang kekurangan stok menambah kebutuhan bahan lewat BOM", () => {
    const r = hitungRencana(masukan({ pesananTerbuka: [{ produk_id: 1, qty: 12 }, { produk_id: 1, qty: 8 }] }));
    expect(r.kekuranganProduk).toEqual([{ produk_id: 1, nama: "Lumpia", satuan: "pak", dipesan: 20, stok: 0, kurang: 20 }]);
    const telur = cari(r, 10);
    expect(telur.butuh_pesanan).toBe(2); // 20 pak x 0,1 kg
    expect(telur.qty_pesan).toBe(7); // 2 + 5 - 0
    expect(telur.alasan.join(" ")).toContain("Lumpia kurang 20 pak");
  });

  it("stok produk yang cukup tidak memicu kebutuhan bahan", () => {
    const r = hitungRencana(masukan({ produk: [{ id: 1, nama: "Lumpia", satuan: "pak", stok: 30 }], pesananTerbuka: [{ produk_id: 1, qty: 20 }] }));
    expect(r.kekuranganProduk).toEqual([]);
    expect(cari(r, 10).butuh_pesanan).toBe(0);
  });

  it("PO yang sedang berjalan dikurangkan (agen tidak memesan dobel)", () => {
    const r = hitungRencana(masukan({ poTerbuka: [{ bahan_id: 10, qty: 5 }] }));
    const telur = cari(r, 10);
    expect(telur.proyeksi).toBe(5);
    expect(telur.status).toBe("aman"); // 0 + 5 >= 5
    expect(r.grup).toHaveLength(0);
  });

  it("ramalan dipakai kalau lebih besar dari kebutuhan pesanan (max, bukan jumlah)", () => {
    // 30 pak/hari x lead 1 hari x 0,1 kg = 3 kg ; pesanan kurang 10 pak x 0,1 = 1 kg
    const r = hitungRencana(
      masukan({ ramalan: [{ produk_id: 1, rata_harian: 30, sumber: "rata-rata" }], pesananTerbuka: [{ produk_id: 1, qty: 10 }] }),
    );
    const telur = cari(r, 10);
    expect(telur.butuh_ramalan).toBe(3);
    expect(telur.kebutuhan).toBe(3);
    expect(telur.qty_pesan).toBe(8); // 3 + 5 - 0
    // tepung: lead 2 -> 30 x 2 x 0,2 = 12 kg; proyeksi 50 - 12 = 38 >= 10 -> aman
    expect(cari(r, 11).butuh_ramalan).toBe(12);
    expect(cari(r, 11).status).toBe("aman");
    expect(r.sumberRamalan).toEqual(["rata-rata"]);
  });

  it("bahan tanpa supplier ditandai, tidak masuk grup PO", () => {
    const m = masukan();
    m.bahan[0].supplier = null;
    const r = hitungRencana(m);
    expect(cari(r, 10).status).toBe("tanpa_supplier");
    expect(cari(r, 10).qty_pesan).toBe(0);
    expect(r.grup).toHaveLength(0);
  });

  it("dua bahan dari supplier yang sama jadi SATU grup (satu draft PO)", () => {
    const m = masukan();
    m.bahan[1] = { ...m.bahan[1], stok: 2, supplier: supTelur };
    const r = hitungRencana(m);
    expect(r.grup).toHaveLength(1);
    expect(r.grup[0].items.map((i) => i.bahan_id).sort()).toEqual([10, 11]);
    expect(r.grup[0].total).toBe(140000 + 8 * 12000);
    expect(r.totalBiaya).toBe(r.grup[0].total);
    expect(r.baris[0].status).toBe("pesan"); // yang dipesan tampil di atas
  });

  it("tepat di ROP dianggap aman (pesan hanya bila proyeksi < ROP)", () => {
    const m = masukan();
    m.bahan[0].stok = 5;
    expect(cari(hitungRencana(m), 10).status).toBe("aman");
  });
});

describe("pembulatan qty pesan", () => {
  it("kelipatan per satuan", () => {
    expect(kelipatanSatuan("lembar")).toBe(100);
    expect(kelipatanSatuan("pcs")).toBe(50);
    expect(kelipatanSatuan("kg")).toBe(1);
  });
  it("bulat ke atas, tahan galat float", () => {
    expect(bulatkanKeAtas(4.55, 1)).toBe(5);
    expect(bulatkanKeAtas(0.1 + 0.2 + 2.7, 1)).toBe(3); // 3,0000000000000004 bukan 4
    expect(bulatkanKeAtas(120, 100)).toBe(200);
    expect(bulatkanKeAtas(0, 1)).toBe(0);
    expect(bulatkanKeAtas(-2, 1)).toBe(0);
  });
});

describe("sidikRencana", () => {
  it("sama untuk rencana yang sama, berubah kalau qty berubah", async () => {
    const { sidikRencana } = await import("./agen-restock");
    const a = sidikRencana(hitungRencana(masukan()));
    expect(a).toBe("1:10=5");
    expect(sidikRencana(hitungRencana(masukan()))).toBe(a);
    expect(sidikRencana(hitungRencana(masukan({ pesananTerbuka: [{ produk_id: 1, qty: 10 }] })))).not.toBe(a);
  });
});
