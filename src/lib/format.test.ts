import { describe, expect, it } from "vitest";
import { angka, hariIni, nomorWa, rupiah, selisihHari, tambahHari } from "./format";

describe("tanggal", () => {
  it("hariIni memakai zona WIB: 20 Nov 17.30 UTC = 21 Nov 00.30 WIB", () => {
    expect(hariIni(new Date("2026-11-20T17:30:00Z"))).toBe("2026-11-21");
    expect(hariIni(new Date("2026-11-20T16:59:00Z"))).toBe("2026-11-20");
  });
  it("tambahHari melewati akhir bulan & tahun", () => {
    expect(tambahHari("2026-11-29", 3)).toBe("2026-12-02");
    expect(tambahHari("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("selisihHari: perkiraan tiba vs hari ini (positif = terlambat)", () => {
    expect(selisihHari("2026-11-18", "2026-11-21")).toBe(3);
    expect(selisihHari("2026-11-21", "2026-11-21")).toBe(0);
    expect(selisihHari("2026-11-23", "2026-11-21")).toBe(-2);
  });
});

describe("nomorWa", () => {
  it("0812-... -> 62812...", () => expect(nomorWa("0812-2001-1101")).toBe("6281220011101"));
  it("+62 812 ... tetap 62...", () => expect(nomorWa("+62 812 2001 1101")).toBe("6281220011101"));
  it("812... tanpa 0 -> 62812...", () => expect(nomorWa("81220011101")).toBe("6281220011101"));
  it("kosong / terlalu pendek -> null", () => {
    expect(nomorWa(null)).toBeNull();
    expect(nomorWa("123")).toBeNull();
  });
});

describe("format angka Indonesia", () => {
  it("rupiah memakai titik ribuan", () => expect(rupiah(52000).replace(/\s/g, " ")).toMatch(/Rp\s?52\.000/));
  it("angka memakai koma desimal", () => expect(angka(1234.5)).toBe("1.234,5"));
});
