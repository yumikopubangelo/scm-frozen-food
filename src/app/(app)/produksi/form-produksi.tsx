"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { PesanForm } from "@/components/form";
import { angka } from "@/lib/format";
import { kapasitasProduksi, kebutuhanProduksi } from "@/lib/hitung-produk";
import { statusAwal, type StatusForm } from "@/lib/validasi";

export type ProdukDenganBom = {
  id: number;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
  bom: {
    qty_per_unit: number;
    bahan_baku: { id: number; nama: string; satuan: string; stok: number; harga_satuan: number };
  }[];
};

/**
 * Form catat produksi dengan PRATINJAU kebutuhan bahan: begitu produk & jumlah
 * diisi, tabel menunjukkan berapa setiap bahan akan terpakai dan sisanya.
 * Tombol simpan nonaktif kalau ada bahan yang kurang (database juga menolak).
 */
export function FormProduksi({
  aksi,
  produk,
  awalProduk,
  hari,
}: {
  aksi: (prev: StatusForm, fd: FormData) => Promise<StatusForm>;
  produk: ProdukDenganBom[];
  awalProduk?: number;
  hari: string;
}) {
  const [status, formAction, pending] = useActionState(aksi, statusAwal);
  const [produkId, setProdukId] = useState(awalProduk ? String(awalProduk) : "");
  const [qty, setQty] = useState("");
  const [tanggal, setTanggal] = useState(hari);
  const [catatan, setCatatan] = useState("");

  const p = produk.find((x) => String(x.id) === produkId);
  const n = Number.parseInt(qty, 10);
  const qtyValid = Number.isInteger(n) && n > 0 && String(n) === qty.trim();
  const kapasitas = p ? kapasitasProduksi(p.bom) : null;
  const rincian = p && qtyValid ? kebutuhanProduksi(p.bom, n) : [];
  const adaKurang = rincian.some((r) => r.kurang > 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="produk_id" className="text-sm font-medium text-slate-700">
            Produk <span className="text-red-500">*</span>
          </label>
          <select id="produk_id" name="produk_id" value={produkId} onChange={(e) => setProdukId(e.target.value)} className="input">
            <option value="">— pilih produk —</option>
            {produk.map((x) => {
              const kap = kapasitasProduksi(x.bom);
              return (
                <option key={x.id} value={x.id} disabled={x.bom.length === 0}>
                  {x.nama} — stok {angka(x.stok)} {x.satuan}
                  {x.bom.length === 0 ? " (BOM kosong)" : ` · bisa diproduksi ${angka(kap ?? 0)}`}
                </option>
              );
            })}
          </select>
          {status.galat?.produk_id && <p className="text-xs text-red-600">{status.galat.produk_id}</p>}
          {p && (
            <p className={`text-xs ${kapasitas === 0 ? "text-red-600" : "text-slate-500"}`}>
              Stok sekarang {angka(p.stok)} {p.satuan} (minimum {p.stok_minimum}). Dari stok bahan saat ini, maksimal{" "}
              <strong>{angka(kapasitas ?? 0)}</strong> {p.satuan} bisa diproduksi.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qty" className="text-sm font-medium text-slate-700">
            Jumlah produksi ({p?.satuan ?? "pak"}) <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input id="qty" name="qty" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="input" />
            {p && !!kapasitas && (
              <button type="button" onClick={() => setQty(String(kapasitas))} className="btn-secondary whitespace-nowrap px-3">
                Maks ({kapasitas})
              </button>
            )}
          </div>
          {status.galat?.qty && <p className="text-xs text-red-600">{status.galat.qty}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tanggal" className="text-sm font-medium text-slate-700">
            Tanggal produksi
          </label>
          <input id="tanggal" name="tanggal" type="date" max={hari} value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="input" />
          {status.galat?.tanggal ? (
            <p className="text-xs text-red-600">{status.galat.tanggal}</p>
          ) : (
            <p className="text-xs text-slate-500">Boleh tanggal lampau kalau baru dicatat sekarang.</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="catatan" className="text-sm font-medium text-slate-700">
            Catatan
          </label>
          <input id="catatan" name="catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} className="input" placeholder="mis. batch pagi, shift Bu Euis" />
        </div>
      </section>

      {p && (
        <section className="card p-5">
          <h2 className="text-base font-semibold">Pratinjau pemakaian bahan</h2>
          <p className="mb-3 mt-1 text-sm text-slate-500">
            {qtyValid
              ? `Untuk ${angka(n)} ${p.satuan}: setiap bahan berkurang sebesar jumlah per ${p.satuan} × ${angka(n)}.`
              : "Isi jumlah produksi untuk melihat bahan yang akan terpakai."}
          </p>
          {rincian.length > 0 && (
            <div className="overflow-x-auto">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Bahan</th>
                    <th className="text-right">Dipakai</th>
                    <th className="text-right">Stok sekarang</th>
                    <th className="text-right">Sisa setelah produksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rincian.map((r) => (
                    <tr key={r.bahan_id} className={r.kurang > 0 ? "bg-red-50" : ""}>
                      <td className="font-medium">{r.nama}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {angka(r.butuh)} {r.satuan}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums text-slate-600">{angka(r.stok)}</td>
                      <td className={`whitespace-nowrap text-right tabular-nums ${r.kurang > 0 ? "font-medium text-red-700" : ""}`}>
                        {r.kurang > 0 ? `kurang ${angka(r.kurang)} ${r.satuan}` : `${angka(r.sisa)} ${r.satuan}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {adaKurang && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Bahan tidak cukup. Kurangi jumlah (maksimal {angka(kapasitas ?? 0)}) atau buat{" "}
              <Link href="/purchase-order/baru" className="font-medium underline">
                purchase order
              </Link>{" "}
              untuk bahan yang kurang.
            </p>
          )}
          {qtyValid && !adaKurang && (
            <p className="mt-3 text-sm text-slate-600">
              Stok {p.nama} akan menjadi <strong>{angka(p.stok + n)}</strong> {p.satuan}.
            </p>
          )}
        </section>
      )}

      <PesanForm status={status} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending || adaKurang} className="btn-primary">
          {pending ? "Menyimpan…" : "Catat produksi"}
        </button>
        <Link href="/produksi" className="btn-secondary">
          Batal
        </Link>
      </div>
    </form>
  );
}
