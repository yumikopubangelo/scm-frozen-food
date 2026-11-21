import Link from "next/link";
import { CheckCircle2, Search } from "lucide-react";

/** Kotak cari (form GET biasa: tetap jalan tanpa JavaScript, kata kunci tersimpan di URL ?q=). */
export function Pencarian({ q, placeholder, children }: { q?: string; placeholder: string; children?: React.ReactNode }) {
  return (
    <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center" role="search">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input name="q" defaultValue={q} placeholder={placeholder} className="input pl-9" aria-label={placeholder} />
      </div>
      {children}
      <button type="submit" className="btn-secondary">
        Cari
      </button>
    </form>
  );
}

const PESAN_OK: Record<string, string> = {
  ditambah: "Data berhasil ditambahkan.",
  diubah: "Perubahan berhasil disimpan.",
  dihapus: "Data berhasil dihapus.",
  "po-dikirim": "PO dikirim ke supplier. Isinya kini terkunci.",
  "po-diterima": "Barang diterima. Stok bahan baku sudah bertambah.",
  "po-dibatalkan": "PO dibatalkan.",
  "pesanan-dikirim": "Pesanan dikirim. Stok produk di gudang barang jadi sudah berkurang.",
  "pesanan-diterima": "Pesanan dikonfirmasi sudah diterima reseller.",
  "pesanan-dibatalkan": "Pesanan dibatalkan. Stok tidak berubah.",
  "produksi-dicatat": "Produksi dicatat. Stok bahan berkurang sesuai resep dan stok produk bertambah.",
};

/** Banner hijau setelah simpan/hapus (dibaca dari ?ok=...). */
export function BannerOk({ ok }: { ok?: string | string[] }) {
  const pesan = typeof ok === "string" ? PESAN_OK[ok] : undefined;
  if (!pesan) return null;
  return (
    <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      <CheckCircle2 className="size-4" aria-hidden />
      {pesan}
    </p>
  );
}

const WARNA_BADGE = {
  hijau: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  kuning: "bg-amber-50 text-amber-800 ring-amber-600/20",
  merah: "bg-red-50 text-red-700 ring-red-600/20",
  biru: "bg-sky-50 text-sky-700 ring-sky-600/20",
  abu: "bg-slate-100 text-slate-600 ring-slate-500/20",
} as const;

export function Badge({ warna, children }: { warna: keyof typeof WARNA_BADGE; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${WARNA_BADGE[warna]}`}>
      {children}
    </span>
  );
}

/** Badge status dokumen (PO / pesanan). */
export function BadgeStatus({ info }: { info: { label: string; warna: keyof typeof WARNA_BADGE; arti?: string } }) {
  return (
    <span title={info.arti}>
      <Badge warna={info.warna}>{info.label}</Badge>
    </span>
  );
}

/** Status stok dibanding batas (reorder point / stok minimum). */
export function BadgeStok({ stok, batas }: { stok: number; batas: number }) {
  if (stok <= 0) return <Badge warna="merah">Habis</Badge>;
  if (stok < batas) return <Badge warna="kuning">Kritis</Badge>;
  return <Badge warna="hijau">Aman</Badge>;
}

/** Pembungkus tabel: bisa digeser ke samping di layar sempit. */
export function Tabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="tabel">{children}</table>
    </div>
  );
}

export function TabelKosong({ kolom, children }: { kolom: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={kolom} className="py-10 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}

/** Link tombol "Tambah ..." di kanan judul halaman. */
export function TombolTambah({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="btn-primary">
      {children}
    </Link>
  );
}

/** Navigasi kembali kecil di atas halaman form. */
export function Kembali({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-800">
      ← {children}
    </Link>
  );
}
