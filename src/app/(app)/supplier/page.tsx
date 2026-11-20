import { JudulHalaman, SegeraHadir } from "@/components/judul-halaman";

export default function Page() {
  return (
    <>
      <JudulHalaman judul="Supplier" deskripsi="Pemasok bahan baku beserta lead time pengiriman." />
      <SegeraHadir milestone="M3" isi="Daftar, tambah, ubah, dan hapus supplier." />
    </>
  );
}
