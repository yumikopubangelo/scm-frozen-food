"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PesanForm } from "@/components/form";
import { angka, rupiah } from "@/lib/format";
import { statusAwal, type StatusForm } from "@/lib/validasi";

type OpsiSupplier = { id: number; nama: string; lead_time_hari: number };
type OpsiBahan = {
  id: number;
  nama: string;
  satuan: string;
  harga_satuan: number;
  stok: number;
  reorder_point: number;
  supplier_id: number | null;
};
type Baris = { kunci: number; bahan_id: string; qty: string; harga: string };

const angkaDari = (s: string) => Number(s.replace(",", "."));

/**
 * Form PO baru. Baris bahan dinamis (tambah/hapus) disimpan di state React,
 * lalu dikirim ke server sebagai satu kolom tersembunyi "items" berisi JSON.
 */
export function FormPo({
  aksi,
  supplier,
  bahan,
  awalSupplier,
}: {
  aksi: (prev: StatusForm, fd: FormData) => Promise<StatusForm>;
  supplier: OpsiSupplier[];
  bahan: OpsiBahan[];
  awalSupplier?: number;
}) {
  const [status, formAction, pending] = useActionState(aksi, statusAwal);
  const [supplierId, setSupplierId] = useState(awalSupplier ? String(awalSupplier) : "");
  const [baris, setBaris] = useState<Baris[]>([{ kunci: 1, bahan_id: "", qty: "", harga: "" }]);
  const [catatan, setCatatan] = useState("");

  const peta = useMemo(() => new Map(bahan.map((b) => [String(b.id), b])), [bahan]);
  // Bahan dari supplier terpilih ditampilkan paling atas
  const milikSupplier = bahan.filter((b) => String(b.supplier_id) === supplierId);
  const lainnya = bahan.filter((b) => String(b.supplier_id) !== supplierId);

  const ubah = (kunci: number, data: Partial<Baris>) =>
    setBaris((bs) => bs.map((b) => (b.kunci === kunci ? { ...b, ...data } : b)));

  function pilihBahan(kunci: number, id: string) {
    const b = peta.get(id);
    ubah(kunci, { bahan_id: id, harga: b ? String(b.harga_satuan).replace(".", ",") : "" });
  }

  const tambahBaris = () => setBaris((bs) => [...bs, { kunci: Math.max(0, ...bs.map((b) => b.kunci)) + 1, bahan_id: "", qty: "", harga: "" }]);
  const hapusBaris = (kunci: number) => setBaris((bs) => (bs.length > 1 ? bs.filter((b) => b.kunci !== kunci) : bs));

  // Baris yang sudah lengkap dikirim; baris kosong diabaikan
  const terisi = baris.filter((b) => b.bahan_id && b.qty);
  const itemsJson = JSON.stringify(
    terisi.map((b) => ({ bahan_id: Number(b.bahan_id), qty: angkaDari(b.qty), harga_satuan: angkaDari(b.harga || "0") })),
  );
  const total = terisi.reduce((s, b) => s + (angkaDari(b.qty) || 0) * (angkaDari(b.harga || "0") || 0), 0);
  const leadTime = supplier.find((s) => String(s.id) === supplierId)?.lead_time_hari;

  return (
    <form
      // onSubmit + startTransition (bukan action={...}) supaya React 19 TIDAK
      // mereset form otomatis: baris bahan disimpan di state dan tidak boleh
      // hilang kalau server menolak (mis. supplier belum dipilih).
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <input type="hidden" name="items" value={itemsJson} />

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="supplier_id" className="text-sm font-medium text-slate-700">
            Supplier <span className="text-red-500">*</span>
          </label>
          <select
            id="supplier_id"
            name="supplier_id"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className={`input ${status.galat?.supplier_id ? "border-red-400" : ""}`}
          >
            <option value="">— pilih supplier —</option>
            {supplier.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </select>
          {status.galat?.supplier_id ? (
            <p className="text-xs text-red-600">{status.galat.supplier_id}</p>
          ) : (
            leadTime !== undefined && <p className="text-xs text-slate-500">Lead time {leadTime} hari sejak PO dikirim.</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="catatan" className="text-sm font-medium text-slate-700">
            Catatan
          </label>
          <input id="catatan" name="catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} className="input" placeholder="opsional" />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold">Bahan yang dipesan</h2>
        <div className="flex flex-col gap-3">
          {baris.map((b, i) => {
            const info = peta.get(b.bahan_id);
            const subtotal = (angkaDari(b.qty) || 0) * (angkaDari(b.harga || "0") || 0);
            return (
              <div key={b.kunci} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_7rem_9rem_7rem_auto] sm:items-start">
                <div>
                  <label className="text-xs text-slate-500" htmlFor={`bahan-${b.kunci}`}>
                    Bahan {i + 1}
                  </label>
                  <select id={`bahan-${b.kunci}`} value={b.bahan_id} onChange={(e) => pilihBahan(b.kunci, e.target.value)} className="input">
                    <option value="">— pilih bahan —</option>
                    {milikSupplier.length > 0 && (
                      <optgroup label="Dipasok supplier ini">
                        {milikSupplier.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nama} ({x.satuan})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label={milikSupplier.length ? "Bahan lain" : "Semua bahan"}>
                      {lainnya.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nama} ({x.satuan})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  {info && (
                    <p className={`mt-1 text-xs ${info.stok < info.reorder_point ? "text-amber-700" : "text-slate-500"}`}>
                      Stok {angka(info.stok)} {info.satuan} · reorder point {angka(info.reorder_point)}
                      {info.stok < info.reorder_point && " · di bawah reorder point"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500" htmlFor={`qty-${b.kunci}`}>
                    Jumlah {info ? `(${info.satuan})` : ""}
                  </label>
                  <input id={`qty-${b.kunci}`} value={b.qty} onChange={(e) => ubah(b.kunci, { qty: e.target.value })} inputMode="decimal" className="input" />
                </div>
                <div>
                  <label className="text-xs text-slate-500" htmlFor={`harga-${b.kunci}`}>
                    Harga / satuan (Rp)
                  </label>
                  <input id={`harga-${b.kunci}`} value={b.harga} onChange={(e) => ubah(b.kunci, { harga: e.target.value })} inputMode="decimal" className="input" />
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Subtotal</span>
                  <p className="py-2 text-sm tabular-nums">{rupiah(subtotal)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => hapusBaris(b.kunci)}
                  disabled={baris.length === 1}
                  className="self-center rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:mt-5"
                  aria-label={`Hapus baris ${i + 1}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={tambahBaris} className="btn-secondary">
            <Plus className="size-4" aria-hidden /> Tambah baris
          </button>
          <p className="text-sm">
            Total: <strong className="tabular-nums">{rupiah(total)}</strong>
          </p>
        </div>
        {status.galat?.items && <p className="mt-2 text-sm text-red-600">{status.galat.items}</p>}
      </section>

      <PesanForm status={status} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Menyimpan…" : "Simpan sebagai draft"}
        </button>
        <Link href="/purchase-order" className="btn-secondary">
          Batal
        </Link>
      </div>
      <p className="-mt-2 text-xs text-slate-500">PO disimpan sebagai draft dulu. Periksa isinya, lalu klik &quot;Kirim ke supplier&quot; di halaman PO.</p>
    </form>
  );
}
