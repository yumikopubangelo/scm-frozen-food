import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Pengguna = { id: string; email: string };

/**
 * Pengecekan login di server (lapis kedua setelah proxy.ts).
 * Dipanggil di layout (app). Kalau tidak ada sesi yang valid -> /login.
 * cache() membuat pemanggilan berulang dalam satu request hanya sekali verifikasi.
 */
export const wajibLogin = cache(async (): Promise<Pengguna> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    redirect("/login");
  }
  return { id: claims.sub, email: (claims.email as string | undefined) ?? "" };
});
