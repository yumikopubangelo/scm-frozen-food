import { JudulHalaman, SegeraHadir } from "@/components/judul-halaman";

export default function Page() {
  return (
    <>
      <JudulHalaman judul="Reseller" deskripsi="Reseller dan toko tujuan distribusi." />
      <SegeraHadir milestone="M3" isi="Daftar, tambah, ubah, dan hapus reseller." />
    </>
  );
}
