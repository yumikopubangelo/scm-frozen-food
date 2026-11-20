import { JudulHalaman, SegeraHadir } from "@/components/judul-halaman";

export default function Page() {
  return (
    <>
      <JudulHalaman judul="Produksi" deskripsi="Batch produksi: bahan berkurang sesuai BOM, produk bertambah." />
      <SegeraHadir milestone="M5" isi="Catat batch produksi dan riwayatnya." />
    </>
  );
}
