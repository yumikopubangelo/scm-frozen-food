import { describe, expect, it } from "vitest";
import { filterCari } from "./cari";
import { kodeBerikutnya } from "./format";

describe("filterCari", () => {
  it("membuat filter ilike untuk beberapa kolom", () => {
    expect(filterCari("ayam", ["kode", "nama"])).toBe("kode.ilike.%ayam%,nama.ilike.%ayam%");
  });
  it("membuang karakter sintaks PostgREST (koma, kurung, %, *)", () => {
    expect(filterCari("a,b(c)*%", ["nama"])).toBe("nama.ilike.%a b c%");
  });
  it("kosong -> null (tanpa filter)", () => {
    expect(filterCari("  ", ["nama"])).toBeNull();
    expect(filterCari(undefined, ["nama"])).toBeNull();
  });
});

describe("kodeBerikutnya", () => {
  it("melanjutkan nomor terbesar", () => {
    expect(kodeBerikutnya(["SUP-01", "SUP-08", "SUP-03"], "SUP-")).toBe("SUP-09");
  });
  it("mengabaikan kode berawalan lain; daftar kosong -> 01", () => {
    expect(kodeBerikutnya(["PJ-05", "X-99"], "BB-")).toBe("BB-01");
  });
});
