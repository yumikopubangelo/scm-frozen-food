// Label & warna status dokumen. Dipakai PO (M4) dan pesanan (M6).

export type StatusPo = "draft" | "dikirim" | "diterima" | "dibatalkan";
export type StatusPesanan = "diproses" | "dikirim" | "diterima" | "dibatalkan";
export type WarnaStatus = "abu" | "biru" | "kuning" | "hijau" | "merah";

export const STATUS_PO: Record<StatusPo, { label: string; warna: WarnaStatus; arti: string }> = {
  draft: { label: "Draft", warna: "abu", arti: "Belum dikirim ke supplier; isi masih bisa diubah." },
  dikirim: { label: "Dikirim", warna: "biru", arti: "Sudah dipesan ke supplier, menunggu barang datang." },
  diterima: { label: "Diterima", warna: "hijau", arti: "Barang sudah masuk gudang bahan baku; stok bertambah." },
  dibatalkan: { label: "Dibatalkan", warna: "merah", arti: "PO dibatalkan; tidak memengaruhi stok." },
};

export const STATUS_PESANAN: Record<StatusPesanan, { label: string; warna: WarnaStatus; arti: string }> = {
  diproses: { label: "Diproses", warna: "kuning", arti: "Pesanan masuk, barang belum keluar gudang." },
  dikirim: { label: "Dikirim", warna: "biru", arti: "Barang sudah keluar gudang; stok produk berkurang." },
  diterima: { label: "Diterima", warna: "hijau", arti: "Barang sudah diterima reseller." },
  dibatalkan: { label: "Dibatalkan", warna: "merah", arti: "Pesanan dibatalkan sebelum dikirim." },
};
