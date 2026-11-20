import {
  Bot,
  ClipboardList,
  Factory,
  History,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  Truck,
  Wheat,
  type LucideIcon,
} from "lucide-react";

export type ItemMenu = { href: string; label: string; ikon: LucideIcon };
export type GrupMenu = { judul: string | null; item: ItemMenu[] };

/** Daftar menu sidebar. Tambah halaman baru = tambah satu baris di sini. */
export const MENU: GrupMenu[] = [
  { judul: null, item: [{ href: "/", label: "Dashboard", ikon: LayoutDashboard }] },
  {
    judul: "Master data",
    item: [
      { href: "/supplier", label: "Supplier", ikon: Truck },
      { href: "/bahan-baku", label: "Bahan baku", ikon: Wheat },
      { href: "/produk", label: "Produk & BOM", ikon: Package },
      { href: "/reseller", label: "Reseller", ikon: Store },
    ],
  },
  {
    judul: "Transaksi",
    item: [
      { href: "/purchase-order", label: "Purchase order", ikon: ClipboardList },
      { href: "/produksi", label: "Produksi", ikon: Factory },
      { href: "/pesanan", label: "Pesanan & kirim", ikon: ShoppingCart },
    ],
  },
  {
    judul: "Analisis",
    item: [
      { href: "/agen-restock", label: "Agen restock", ikon: Bot },
      { href: "/mutasi-stok", label: "Mutasi stok", ikon: History },
    ],
  },
];
