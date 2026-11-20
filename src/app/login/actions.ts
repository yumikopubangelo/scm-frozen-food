"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StatusLogin = { pesan: string; email: string };

/** Hanya izinkan redirect ke path internal ("/x"), bukan "//situs-lain.com". */
function tujuanAman(next: FormDataEntryValue | null) {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function login(_prev: StatusLogin, formData: FormData): Promise<StatusLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { pesan: "Email dan password wajib diisi.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Pesan sengaja umum: jangan bocorkan apakah emailnya terdaftar atau tidak.
    const pesan =
      error.code === "invalid_credentials"
        ? "Email atau password salah."
        : error.status === 429
          ? "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."
          : "Login gagal. Periksa koneksi lalu coba lagi.";
    return { pesan, email };
  }

  redirect(tujuanAman(formData.get("next")));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
