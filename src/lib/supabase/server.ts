import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Klien Supabase untuk Server Component, Server Action, dan Route Handler.
 * Sesi login dibaca dari cookie request; query berjalan sebagai role
 * "authenticated" sehingga GRANT + RLS di database berlaku.
 *
 * Buat baru di setiap request (jangan disimpan di variabel global),
 * karena tiap request punya cookie pengguna sendiri.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Dipanggil dari Server Component: cookie tidak boleh ditulis di sana.
            // Aman diabaikan karena proxy.ts sudah memperbarui sesi di setiap request.
          }
        },
      },
    },
  );
}
