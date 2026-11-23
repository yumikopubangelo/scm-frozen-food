"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, Snowflake, X } from "lucide-react";
import { logout } from "@/app/login/actions";
import { MENU } from "./navigasi";

/**
 * Kerangka halaman setelah login:
 *  - layar lebar (lg, >= 1024px): sidebar tetap di kiri
 *  - layar kecil: header atas + tombol menu yang membuka sidebar sebagai laci
 */
export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [terbuka, setTerbuka] = useState(false);

  // Laci menu ditutup saat link diklik (onClick di <Link>), bukan lewat useEffect
  // yang memantau pathname: setState di dalam effect memicu render dua kali
  // dan ditandai lint react-hooks/set-state-in-effect.
  // Cocok persis atau sub-halaman ("/produk/5"). Jangan startsWith(href) saja:
  // "/produksi" juga diawali "/produk", sehingga dua menu tersorot sekaligus.
  const aktif = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-sky-600 text-white">
          <Snowflake className="size-4" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Galunggung</p>
          <p className="text-xs text-slate-500">Frozen Food SCM</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {MENU.map((grup, i) => (
          <div key={i} className="mt-4 first:mt-0">
            {grup.judul && (
              <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                {grup.judul}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {grup.item.map(({ href, label, ikon: Ikon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={aktif(href) ? "page" : undefined}
                    onClick={() => setTerbuka(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors ${
                      aktif(href)
                        ? "bg-sky-50 font-medium text-sky-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Ikon className="size-4 shrink-0" aria-hidden />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 p-3">
        <p className="truncate px-2 pb-2 text-xs text-slate-500" title={email}>
          {email}
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="size-4" aria-hidden />
            Keluar
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-full flex-1">
      {/* Sidebar tetap (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Laci menu (mobile) */}
      {terbuka && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Tutup menu"
            onClick={() => setTerbuka(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button
              onClick={() => setTerbuka(false)}
              className="absolute right-3 top-5 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Tutup menu"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header (mobile) */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setTerbuka(true)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Buka menu"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold">Galunggung Frozen Food</span>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
