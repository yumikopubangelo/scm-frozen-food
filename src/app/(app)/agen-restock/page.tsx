import { JudulHalaman, SegeraHadir } from "@/components/judul-halaman";

export default function Page() {
  return (
    <>
      <JudulHalaman judul="Agen restock" deskripsi="Usulan pembelian otomatis dari reorder point dan pesanan masuk." />
      <SegeraHadir milestone="M8" isi="Agen menghitung kebutuhan bahan lalu membuat DRAFT PO yang menunggu persetujuan admin." />
    </>
  );
}
