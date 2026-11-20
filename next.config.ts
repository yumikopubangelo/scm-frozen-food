import type { NextConfig } from "next";

// cacheComponents & partialPrefetching (bawaan create-next-app 16) sengaja DIMATIKAN.
// Alasan: semua halaman aplikasi ini membaca cookie login + data Supabase per request,
// jadi tidak ada yang bisa di-prerender. Dengan cacheComponents menyala, setiap
// pembacaan cookie wajib dibungkus <Suspense> (kalau tidak = build error).
// Tanpa flag ini, halaman yang memanggil cookies() otomatis dirender dinamis.
// Lihat PROSES.md (M0) untuk catatan keputusan.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
