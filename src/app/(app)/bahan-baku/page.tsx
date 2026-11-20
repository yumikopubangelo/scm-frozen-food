import { JudulHalaman, SegeraHadir } from "@/components/judul-halaman";

export default function Page() {
  return (
    <>
      <JudulHalaman judul="Bahan baku" deskripsi="Stok gudang bahan baku dan reorder point." />
      <SegeraHadir milestone="M3" isi="Daftar bahan, stok, reorder point, dan supplier utamanya." />
    </>
  );
}
