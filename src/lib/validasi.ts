import { z } from "zod";

/**
 * Status form yang dikembalikan Server Action ke komponen form (useActionState).
 *  - pesan : error umum (mis. dari database)
 *  - galat : error per kolom { nama: "Nama wajib diisi" }
 *  - nilai : isian terakhir, supaya tidak hilang saat ada error
 *  - versi : berubah tiap submit -> input di-remount dengan nilai terakhir
 *            (React 19 mengosongkan form otomatis setelah action selesai)
 *  - sukses: pesan berhasil, untuk form yang tidak redirect (mis. stok opname)
 */
export type StatusForm = {
  sukses?: string;
  pesan?: string;
  galat?: Record<string, string>;
  nilai?: Record<string, string>;
  versi?: number;
};

export const statusAwal: StatusForm = {};

// ---------- Pembentuk aturan kolom ----------

/** Teks wajib, spasi di ujung dibuang. */
export const teksWajib = (label: string, maks = 120) =>
  z
    .string({ error: `${label} wajib diisi` })
    .trim()
    .min(1, { error: `${label} wajib diisi` })
    .max(maks, { error: `${label} maksimal ${maks} karakter` });

/** Teks opsional: string kosong disimpan sebagai NULL. */
export const teksOpsional = (maks = 200) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v),
    z.string().max(maks, { error: `Maksimal ${maks} karakter` }).nullable(),
  );

/**
 * Angka (boleh desimal, koma diterima sebagai pemisah desimal).
 * Konversi dilakukan sendiri di preprocess, BUKAN z.coerce: dengan coerce, zod
 * memberi fungsi error nilai yang sudah dikonversi (NaN), jadi isian kosong
 * dan isian "abc" tidak bisa dibedakan (keduanya NaN).
 */
export const angkaWajib = (label: string, { min = 0, lebihDari = false } = {}) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t === "" ? undefined : Number(t.replace(",", "."));
    },
    z
      .number({ error: (i) => (i.input === undefined ? `${label} wajib diisi` : `${label} harus berupa angka`) })
      .refine((n) => (lebihDari ? n > min : n >= min), {
        error: lebihDari ? `${label} harus lebih dari ${min}` : `${label} minimal ${min}`,
      }),
  );

/** Bilangan bulat. */
export const bulatWajib = (label: string, opsi: { min?: number; lebihDari?: boolean } = {}) =>
  angkaWajib(label, opsi).refine((n) => Number.isInteger(n), { error: `${label} harus bilangan bulat` });

/** id dari <select>: "" -> null. */
export const idOpsional = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.number().int().positive().nullable(),
);

// ---------- Membaca FormData ----------

type HasilBaca<T> = { ok: true; data: T; nilai: Record<string, string> } | { ok: false; status: StatusForm };

/** Validasi FormData dengan skema zod. Kalau gagal, kembalikan StatusForm siap pakai. */
export function bacaForm<T extends z.ZodType>(skema: T, fd: FormData): HasilBaca<z.infer<T>> {
  const nilai: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$")) nilai[k] = v;

  const hasil = skema.safeParse(nilai);
  if (hasil.success) return { ok: true, data: hasil.data, nilai };

  const galat: Record<string, string> = {};
  for (const [kolom, pesan] of Object.entries(z.flattenError(hasil.error).fieldErrors)) {
    if (Array.isArray(pesan) && pesan[0]) galat[kolom] = pesan[0];
  }
  return { ok: false, status: { galat, nilai, versi: Date.now(), pesan: "Periksa kembali isian yang ditandai." } };
}
