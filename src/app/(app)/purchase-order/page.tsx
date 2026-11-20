import { JudulHalaman, SegeraHadir } from "@/components/judul-halaman";

export default function Page() {
  return (
    <>
      <JudulHalaman judul="Purchase order" deskripsi="Pembelian bahan ke supplier: draft, dikirim, diterima." />
      <SegeraHadir milestone="M4" isi="Buat PO, kirim ke supplier, dan terima barang (stok bahan bertambah)." />
    </>
  );
}
