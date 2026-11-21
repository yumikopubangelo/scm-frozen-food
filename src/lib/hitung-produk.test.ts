import { describe, expect, it } from "vitest";
import { bagiBulatBawah, biayaBahanPerPak, kapasitasProduksi, kebutuhanProduksi } from "./hitung-produk";

const bahan = (stok: number, harga = 0) => ({ stok, harga_satuan: harga });

describe("bagiBulatBawah (galat pecahan biner)", () => {
  it("0,3 / 0,1 = 3 dan 0,7 / 0,1 = 7 (Math.floor biasa memberi 2 dan 6)", () => {
    expect(0.3 / 0.1).toBeLessThan(3); // bukti masalahnya: 2.9999999999999996
    expect(Math.floor(0.7 / 0.1)).toBe(6); // 6.999999999999999
    expect(bagiBulatBawah(0.3, 0.1)).toBe(3);
    expect(bagiBulatBawah(0.7, 0.1)).toBe(7);
  });
  it("tetap membulatkan ke bawah untuk sisa yang nyata", () => {
    expect(bagiBulatBawah(0.59, 0.15)).toBe(3);
    expect(bagiBulatBawah(37.5, 0.2)).toBe(187);
  });
});

describe("kapasitasProduksi", () => {
  it("bahan pembatas menentukan kapasitas (contoh Bakso: sapi 14,5/0,25 = 58)", () => {
    expect(
      kapasitasProduksi([
        { qty_per_unit: 0.25, bahan_baku: bahan(14.5) },
        { qty_per_unit: 0.15, bahan_baku: bahan(21.4) },
        { qty_per_unit: 1, bahan_baku: bahan(600) },
      ]),
    ).toBe(58);
  });
  it("satu bahan habis -> 0; BOM kosong -> null", () => {
    expect(kapasitasProduksi([{ qty_per_unit: 0.01, bahan_baku: bahan(0) }])).toBe(0);
    expect(kapasitasProduksi([])).toBeNull();
  });
});

describe("biayaBahanPerPak", () => {
  it("Σ qty × harga (Bakso: 0,25×130.000 + 0,15×12.000 = 34.300)", () => {
    expect(
      biayaBahanPerPak([
        { qty_per_unit: 0.25, bahan_baku: bahan(0, 130000) },
        { qty_per_unit: 0.15, bahan_baku: bahan(0, 12000) },
      ]),
    ).toBeCloseTo(34300);
  });
});

describe("kebutuhanProduksi", () => {
  const bom = [
    { qty_per_unit: 0.005, bahan_baku: { id: 1, nama: "Bawang putih", satuan: "kg", stok: 2.9 } },
    { qty_per_unit: 0.25, bahan_baku: { id: 2, nama: "Tapioka", satuan: "kg", stok: 4 } },
  ];
  it("butuh dibulatkan 2 desimal seperti database: 7 × 0,005 = 0,035 -> 0,04", () => {
    expect(kebutuhanProduksi(bom, 7)[0].butuh).toBe(0.04);
  });
  it("menghitung sisa dan kekurangan", () => {
    const [bawang, tapioka] = kebutuhanProduksi(bom, 20);
    expect(bawang).toMatchObject({ butuh: 0.1, sisa: 2.8, kurang: 0 });
    expect(tapioka).toMatchObject({ butuh: 5, sisa: -1, kurang: 1 });
  });
});
