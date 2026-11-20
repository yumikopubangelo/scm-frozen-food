import { describe, expect, it } from "vitest";
import { z } from "zod";
import { angkaWajib, bacaForm, bulatWajib, idOpsional, teksOpsional, teksWajib } from "./validasi";

const fd = (isi: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(isi)) f.set(k, v);
  return f;
};

describe("angkaWajib", () => {
  const s = z.object({ n: angkaWajib("Jumlah", { min: 0, lebihDari: true }) });

  it("kosong -> 'wajib diisi' (bukan 'harus angka')", () => {
    const h = bacaForm(s, fd({ n: "" }));
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.status.galat?.n).toBe("Jumlah wajib diisi");
  });

  it("teks -> 'harus berupa angka'", () => {
    const h = bacaForm(s, fd({ n: "abc" }));
    if (!h.ok) expect(h.status.galat?.n).toBe("Jumlah harus berupa angka");
    else throw new Error("seharusnya gagal");
  });

  it("koma desimal gaya Indonesia diterima: '0,25' -> 0.25", () => {
    const h = bacaForm(s, fd({ n: "0,25" }));
    expect(h.ok && h.data.n).toBe(0.25);
  });

  it("lebihDari: 0 ditolak", () => {
    const h = bacaForm(s, fd({ n: "0" }));
    if (!h.ok) expect(h.status.galat?.n).toBe("Jumlah harus lebih dari 0");
    else throw new Error("seharusnya gagal");
  });

  it("min: negatif ditolak", () => {
    const h = bacaForm(z.object({ n: angkaWajib("Stok") }), fd({ n: "-5" }));
    if (!h.ok) expect(h.status.galat?.n).toBe("Stok minimal 0");
    else throw new Error("seharusnya gagal");
  });
});

describe("bulatWajib", () => {
  const s = z.object({ b: bulatWajib("Lead time") });
  it("desimal ditolak", () => {
    const h = bacaForm(s, fd({ b: "1,5" }));
    if (!h.ok) expect(h.status.galat?.b).toBe("Lead time harus bilangan bulat");
    else throw new Error("seharusnya gagal");
  });
  it("bulat diterima", () => {
    const h = bacaForm(s, fd({ b: "3" }));
    expect(h.ok && h.data.b).toBe(3);
  });
});

describe("teks & id", () => {
  const s = z.object({ t: teksWajib("Nama"), o: teksOpsional(), id: idOpsional });
  it("teks wajib dipangkas; spasi saja = kosong", () => {
    const h = bacaForm(s, fd({ t: "   ", o: "", id: "" }));
    if (!h.ok) expect(h.status.galat?.t).toBe("Nama wajib diisi");
    else throw new Error("seharusnya gagal");
  });
  it("teks opsional kosong -> null; id kosong -> null; nilai dipangkas", () => {
    const h = bacaForm(s, fd({ t: "  Kios Bu Imas ", o: "  ", id: "" }));
    expect(h.ok && h.data).toEqual({ t: "Kios Bu Imas", o: null, id: null });
  });
  it("isian dikembalikan saat gagal supaya form tidak kosong", () => {
    const h = bacaForm(s, fd({ t: "", o: "catatan", id: "3" }));
    if (!h.ok) expect(h.status.nilai).toMatchObject({ o: "catatan", id: "3" });
    else throw new Error("seharusnya gagal");
  });
});
