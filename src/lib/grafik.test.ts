import { describe, expect, it } from "vitest";
import { angkaRingkas, skalaRapi } from "./grafik";

describe("skalaRapi", () => {
  it("membulatkan ke atas dengan langkah 1-2-2,5-5", () => {
    expect(skalaRapi(237)).toEqual({ atas: 250, garis: [0, 50, 100, 150, 200, 250] });
    expect(skalaRapi(8_036_000).atas).toBe(10_000_000);
    expect(skalaRapi(9).garis).toEqual([0, 2, 4, 6, 8, 10]);
  });
  it("nilai tepat di garis tidak dinaikkan", () => {
    expect(skalaRapi(200).atas).toBe(200);
  });
  it("tahan galat float (0,3 bukan 0,30000000000000004)", () => {
    expect(skalaRapi(0.3).garis).toEqual([0, 0.1, 0.2, 0.3]);
  });
  it("data kosong/nol tetap punya skala", () => {
    expect(skalaRapi(0)).toEqual({ atas: 1, garis: [0, 1] });
    expect(skalaRapi(Number.NaN)).toEqual({ atas: 1, garis: [0, 1] });
  });
});

describe("angkaRingkas", () => {
  it("memakai satuan rb/jt/M gaya Indonesia", () => {
    expect(angkaRingkas(1_250_000)).toBe("1,3 jt");
    expect(angkaRingkas(12_000)).toBe("12 rb");
    expect(angkaRingkas(250)).toBe("250");
    expect(angkaRingkas(2_000_000_000)).toBe("2 M");
  });
});
