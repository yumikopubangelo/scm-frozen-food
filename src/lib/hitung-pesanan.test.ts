import { describe, expect, it } from "vitest";
import { cekKirim, stokCukup, totalPesanan } from "./hitung-pesanan";

const item = (nama: string, qty: number, stok: number, produk_id = 1) => ({ produk_id, nama, satuan: "pak", qty, stok });

describe("cekKirim (skenario kirim -> stok turun)", () => {
  it("kirim 5 pak dari stok 20 -> stok menjadi 15", () => {
    const { baris, bisaKirim } = cekKirim([item("Bakso Sapi", 5, 20)]);
    expect(bisaKirim).toBe(true);
    expect(baris[0]?.sisa).toBe(15);
    expect(baris[0]?.kurang).toBe(0);
  });

  it("stok pas sama dengan pesanan tetap bisa dikirim, stok menjadi 0", () => {
    const { baris, bisaKirim } = cekKirim([item("Cireng", 12, 12)]);
    expect(bisaKirim).toBe(true);
    expect(baris[0]?.sisa).toBe(0);
  });

  it("satu produk kurang -> seluruh pesanan tidak bisa dikirim", () => {
    const { baris, bisaKirim } = cekKirim([item("Bakso Sapi", 5, 20, 1), item("Siomay", 30, 8, 2)]);
    expect(bisaKirim).toBe(false);
    expect(baris[1]?.kurang).toBe(22);
    expect(baris[1]?.sisa).toBe(0);
    expect(baris[0]?.sisa).toBe(15);
  });

  it("pesanan tanpa item tidak bisa dikirim", () => {
    expect(cekKirim([]).bisaKirim).toBe(false);
  });
});

describe("totalPesanan", () => {
  it("Σ qty × harga: 5 × Rp 25.000 + 2 × Rp 18.000 = Rp 161.000", () => {
    expect(
      totalPesanan([
        { qty: 5, harga_satuan: 25000 },
        { qty: 2, harga_satuan: 18000 },
      ]),
    ).toBe(161000);
  });
});

describe("stokCukup (label Siap kirim di daftar)", () => {
  it("siap kirim hanya kalau semua produk cukup", () => {
    expect(stokCukup([{ qty: 5, produk: { stok: 5 } }])).toBe(true);
    expect(stokCukup([{ qty: 5, produk: { stok: 5 } }, { qty: 3, produk: { stok: 2 } }])).toBe(false);
  });
});
