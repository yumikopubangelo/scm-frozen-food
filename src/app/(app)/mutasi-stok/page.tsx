import { JudulHalaman, SegeraHadir } from "@/components/judul-halaman";

export default function Page() {
  return (
    <>
      <JudulHalaman judul="Mutasi stok" deskripsi="Buku besar semua pergerakan stok bahan dan produk." />
      <SegeraHadir milestone="M7" isi="Riwayat pergerakan stok dengan filter barang dan tanggal." />
    </>
  );
}
