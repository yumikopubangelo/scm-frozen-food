import { JudulHalaman, SegeraHadir } from "@/components/judul-halaman";

export default function Page() {
  return (
    <>
      <JudulHalaman judul="Produk & BOM" deskripsi="Produk jadi dan resep bahannya (Bill of Materials)." />
      <SegeraHadir milestone="M3" isi="Daftar produk dan editor BOM per produk." />
    </>
  );
}
