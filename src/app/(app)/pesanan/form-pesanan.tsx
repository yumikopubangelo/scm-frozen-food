"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PesanForm } from "@/components/form";
import { angka, rupiah } from "@/lib/format";
import { statusAwal, type StatusForm } from "@/lib/validasi";

type OpsiReseller = { id: number; nama: string; kota: string | null; tipe: "reseller" | "toko" };
type OpsiProduk = { id: number; nama: string; satuan: string; harga_jual: number; stok: number };
type Baris = { kunci: number; produk_id: string; qty: string; harga: string };

const angkaDari = (s: string) => Number(s.replace(",", "."));

/**
 * Form pesanan baru. Baris produk dinamis disimpan di state React lalu dikirim
 * ke server sebagai satu kolom tersembunyi "items" berisi JSON.
 * Pesanan boleh disimpan walau stok belum cukup (status "diproses" = menunggu);
 * yang tidak boleh adalah MENGIRIM sebelum stok cukup.
 */
export function FormPesanan({
  aksi,
  reseller,
  produk,
  awalReseller,
}: {
  aksi: (prev: StatusForm, fd: FormData) => Promise<StatusForm>;
  reseller: OpsiReseller[];
  produk: OpsiProduk[];
  awalReseller?: number | undefined;
}) {
  const [status, formAction, pending] = useActionState(aksi, statusAwal);
  const [resellerId, setResellerId] = useState(awalReseller ? String(awalReseller) : "");
  const [baris, setBaris] = useState<Baris[]>([{ kunci: 1, produk_id: "", qty: "", harga: "" }]);
  const [catatan, setCatatan] = useState("");

  const peta = useMemo(() => new Map(produk.map((p) => [String(p.id), p])), [produk]);

  const ubah = (kunci: number, data: Partial<Baris>) =>
    setBaris((bs) => bs.map((b) => (b.kunci === kunci ? { ...b, ...data } : b)));

  function pilihProduk(kunci: number, id: string) {
    const p = peta.get(id);
    ubah(kunci, { produk_id: id, harga: p ? String(p.harga_jual).replace(".", ",") : "" });
  }

  const tambahBaris = () =>
    setBaris((bs) => [...bs, { kunci: Math.max(0, ...bs.map((b) => b.kunci)) + 1, produk_id: "", qty: "", harga: "" }]);
  const hapusBaris = (kunci: number) => setBaris((bs) => (bs.length > 1 ? bs.filter((b) => b.kunci !== kunci) : bs));

  const terisi = baris.filter((b) => b.produk_id && b.qty);
  const itemsJson = JSON.stringify(
    terisi.map((b) => ({ produk_id: Number(b.produk_id), qty: angkaDari(b.qty), harga_satuan: angkaDari(b.harga || "0") })),
  );
  const total = terisi.reduce((s, b) => s + (angkaDari(b.qty) || 0) * (angkaDari(b.harga || "0") || 0), 0);
  const adaKurang = terisi.some((b) => angkaDari(b.qty) > Number(peta.get(b.produk_id)?.stok ?? 0));

  return (
    <form
      // onSubmit + startTransition (bukan action=) supaya React 19 tidak mereset
      // form: baris produk di state tidak boleh hilang kalau server menolak.
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
          <label htmlFor="reseller_id" className="text-sm font-medium text-slate-700">
            Reseller / toko <span className="text-red-500">*</span>
          </label>
          <select
            id="reseller_id"
            name="reseller_id"
            value={resellerId}
            onChange={(e) => setResellerId(e.target.value)}
            className={`input ${status.galat?.reseller_id ? "border-red-400" : ""}`}
          >
            <option value="">— pilih reseller —</option>
            {reseller.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nama}
                {r.kota ? ` · ${r.kota}` : ""}
                {r.tipe === "toko" ? " (toko)" : ""}
              </option>
            ))}
          </select>
          {status.galat?.reseller_id && <p className="text-xs text-red-600">{status.galat.reseller_id}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="catatan" className="text-sm font-medium text-slate-700">
            Catatan
          </label>
          <input id="catatan" name="catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} className="input" placeholder="opsional" />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold">Produk yang dipesan</h2>
        <div className="flex flex-col gap-3">
          {baris.map((b, i) => {
            const info = peta.get(b.produk_id);
            const qty = angkaDari(b.qty) || 0;
            const subtotal = qty * (angkaDari(b.harga || "0") || 0);
            const kurang = info ? Math.max(0, qty - Number(info.stok)) : 0;
            return (
              <div key={b.kunci} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_7rem_9rem_7rem_auto] sm:items-start">
                <div>
                  <label className="text-xs text-slate-500" htmlFor={`produk-${b.kunci}`}>
                    Produk {i + 1}
                  </label>
                  <select id={`produk-${b.kunci}`} value={b.produk_id} onChange={(e) => pilihProduk(b.kunci, e.target.value)} className="input">
                    <option value="">— pilih produk —</option>
                    {produk.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama} (stok {angka(p.stok)} {p.satuan})
                      </option>
                    ))}
                  </select>
                  {info && (
                    <p className={`mt-1 text-xs ${kurang > 0 ? "text-amber-700" : "text-slate-500"}`}>
                      Stok gudang {angka(info.stok)} {info.satuan}
                      {qty > 0 && kurang === 0 && ` · setelah dikirim tersisa ${angka(Number(info.stok) - qty)}`}
                      {kurang > 0 && ` · kurang ${angka(kurang)} ${info.satuan}, perlu produksi dulu sebelum dikirim`}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500" htmlFor={`qty-${b.kunci}`}>
                    Jumlah {info ? `(${info.satuan})` : ""}
                  </label>
                  <input id={`qty-${b.kunci}`} value={b.qty} onChange={(e) => ubah(b.kunci, { qty: e.target.value })} inputMode="numeric" className="input" />
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
          {pending ? "Menyimpan…" : "Simpan pesanan"}
        </button>
        <Link href="/pesanan" className="btn-secondary">
          Batal
        </Link>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Pesanan disimpan dengan status &quot;Diproses&quot;; stok belum berubah. Stok produk baru berkurang saat Anda klik
        &quot;Kirim pesanan&quot; di halaman pesanan.
        {adaKurang && " Ada produk yang stoknya belum cukup: catat produksi dulu sebelum mengirim."}
      </p>
    </form>
  );
}
