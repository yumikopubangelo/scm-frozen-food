# Login & Kerangka Halaman — penjelasan untuk pemilik proyek

> Berkas yang dibahas: `src/proxy.ts`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/server.ts`, `src/lib/auth.ts`, `src/app/login/*`, `src/app/(app)/layout.tsx`, `src/components/app-shell.tsx`, `src/components/navigasi.ts`.

## 1. Tiga lapis pengaman login

Seperti gedung kantor: ada satpam di gerbang, resepsionis di lobi, dan kunci di setiap lemari arsip. Kalau satu lapis kebobolan, lapis berikutnya masih menahan.

| Lapis | Berkas | Yang diperiksa | Kalau gagal |
|---|---|---|---|
| 1. **Proxy** (satpam gerbang) | `src/proxy.ts` → `lib/supabase/proxy.ts` | setiap request: ada sesi valid? | dialihkan ke `/login?next=<halaman asal>` |
| 2. **Layout server** (resepsionis) | `app/(app)/layout.tsx` → `lib/auth.ts` (`wajibLogin`) | sebelum halaman mana pun di `(app)` dirender | dialihkan ke `/login` |
| 3. **Database** (kunci lemari) | `0003_hak_akses.sql` (GRANT + RLS) | setiap query | role `anon` ditolak (`permission denied`) |

**Kenapa perlu lapis 2 kalau sudah ada proxy?** Dokumentasi Next.js 16 menyebut proxy hanya untuk pengecekan "optimistis", karena proxy bisa dilewati pada kasus tertentu (misalnya prefetch atau salah konfigurasi `matcher`). Pemeriksaan sungguhan harus dekat dengan data.

**Kenapa `getClaims()` dan bukan `getSession()`?** `getSession()` hanya *membaca* cookie, dan cookie bisa dipalsukan oleh pengguna. `getClaims()` *memverifikasi tanda tangan* token (JWT) yang dibuat server Supabase, jadi token palsu ditolak. Komentar resmi di library Supabase sendiri memperingatkan bahwa hasil `getSession()` "must not be trusted" di server.

## 2. Alur login

```
Browser                Next.js (server)                          Supabase Auth
  │  isi email+password   │                                           │
  │──── submit form ─────▶│ login() di actions.ts ("use server")      │
  │                       │──── signInWithPassword ─────────────────▶ │
  │                       │◀─── token akses + refresh token ───────── │
  │◀── cookie sesi + redirect ke ?next (atau "/") ──│                  │
  │  buka halaman lain    │                                           │
  │──── request + cookie ▶│ proxy: getClaims() → valid? lanjut         │
  │                       │ layout: wajibLogin() → render halaman      │
```

- Form login memakai **Server Action** + `useActionState` (pola resmi Next.js untuk form dengan pesan error). Password tidak pernah disimpan di kode atau log.
- Pesan error sengaja umum ("Email atau password salah"), supaya orang tidak bisa menebak email mana yang terdaftar.
- Parameter `next` hanya menerima path internal (`/purchase-order`), bukan `//situs-lain.com`. Kalau tidak dibatasi, link login bisa disalahgunakan untuk mengarahkan korban ke situs palsu (*open redirect*).
- **Pendaftaran publik dimatikan** di dashboard Supabase (`disable_signup: true`, sudah dicek lewat endpoint `/auth/v1/settings`). Ini wajib, karena aturan RLS memberi akses penuh ke semua pengguna yang login. Kalau pendaftaran terbuka, siapa pun bisa mendaftar lalu menjadi admin.

## 3. Kerangka halaman

- `app/(app)/` adalah **route group**: folder berkurung tidak muncul di URL. Semua halaman di dalamnya memakai `layout.tsx` yang sama (cek login + sidebar), sedangkan `/login` berada di luar group sehingga tampil tanpa sidebar.
- `components/navigasi.ts` berisi **satu-satunya daftar menu**. Menambah halaman baru cukup menambah satu baris di sana.
- `components/app-shell.tsx`: di layar ≥ 1024 px (Tailwind `lg`) sidebar tetap di kiri. Di layar lebih kecil muncul header dengan tombol menu (☰) yang membuka sidebar sebagai laci.
- Kelas tampilan bersama di `globals.css`: `.card`, `.input`, `.btn-primary`, `.btn-secondary`, `.btn-danger`. Pakai kelas ini supaya semua halaman seragam.
- Halaman yang belum dibangun menampilkan `SegeraHadir`, sehingga tidak ada menu yang berujung 404.

## 4. Jebakan yang ditemui

1. **Tailwind v4 `@apply`.** Di v3, kelas buatan sendiri di `@layer components` bisa di-`@apply` oleh kelas lain. Di v4, kelas dasar (`btn`) harus didaftarkan dengan `@utility` dulu.
2. **Lint React baru: `set-state-in-effect`.** Menutup laci menu dengan `useEffect(() => setTerbuka(false), [pathname])` ditolak lint, karena setState di dalam effect membuat render dua kali. Solusinya, laci ditutup langsung di `onClick` link.
3. **Tipe basi dari dev server.** Setelah `page.tsx` dipindah ke `(app)/`, `next build` gagal karena `.next/dev/types` masih menunjuk lokasi lama. Solusinya, hentikan dev server lalu hapus folder `.next` sebelum build.
4. **TypeScript tidak menyempitkan tipe** setelah `if (galat) throw`, yang menggabungkan error dari 4 query. Solusinya, pakai `data ?? []`.

## 5. "Kalau aku mau mengubah X, sentuh berkas mana?"

| Mau mengubah | Berkas |
|---|---|
| menambah halaman yang bisa dibuka tanpa login | `HALAMAN_PUBLIK` di `src/lib/supabase/proxy.ts` |
| menambah/mengurutkan menu | `src/components/navigasi.ts` |
| tampilan halaman login | `src/app/login/page.tsx`, `login-form.tsx` |
| pesan error login | `src/app/login/actions.ts` |
| warna tombol/kartu | `src/app/globals.css` |
| menambah akun admin | Supabase Dashboard → Authentication → Users → Add user (centang Auto Confirm) |
