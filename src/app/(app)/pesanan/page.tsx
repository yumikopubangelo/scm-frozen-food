import { JudulHalaman, SegeraHadir } from "@/components/judul-halaman";

export default function Page() {
  return (
    <>
      <JudulHalaman judul="Pesanan & kirim" deskripsi="Pesanan reseller: diproses, dikirim, diterima." />
      <SegeraHadir milestone="M6" isi="Buat pesanan, kirim (stok produk berkurang), dan konfirmasi diterima." />
    </>
  );
}
