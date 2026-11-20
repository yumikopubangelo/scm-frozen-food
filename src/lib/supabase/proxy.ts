import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Halaman yang boleh dibuka tanpa login. */
const HALAMAN_PUBLIK = ["/login"];

/**
 * Dipanggil oleh src/proxy.ts di setiap request (sebelum halaman dirender):
 *  1. Memperbarui token sesi Supabase yang hampir kedaluwarsa dan menulis
 *     cookie barunya ke response.
 *  2. Pengecekan "optimistis": belum login -> ke /login; sudah login tapi
 *     membuka /login -> ke dashboard.
 *
 * Ini BUKAN satu-satunya pengaman. Layout (app) memeriksa ulang di server
 * (lib/auth.ts), dan database menolak role anon (GRANT + RLS).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Tulis ke request (untuk halaman yang dirender sesudah ini)
          // DAN ke response (supaya browser menyimpan token baru).
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // PENTING: jangan sisipkan kode lain di antara createServerClient dan getClaims().
  // getClaims() memverifikasi tanda tangan JWT (bukan sekadar membaca cookie)
  // dan memicu refresh token bila perlu.
  const { data } = await supabase.auth.getClaims();
  const sudahLogin = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;
  const publik = HALAMAN_PUBLIK.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!sudahLogin && !publik) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return salinCookie(response, NextResponse.redirect(url));
  }

  if (sudahLogin && publik) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return salinCookie(response, NextResponse.redirect(url));
  }

  return response;
}

/** Redirect juga harus membawa cookie sesi yang baru diperbarui. */
function salinCookie(dari: NextResponse, ke: NextResponse) {
  for (const c of dari.cookies.getAll()) ke.cookies.set(c);
  return ke;
}
