import type { Metadata } from "next";
import { Snowflake } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
            <Snowflake className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Galunggung Frozen Food</h1>
          <p className="mt-1 text-sm text-slate-500">Sistem Supply Chain Management · Tasikmalaya</p>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-base font-semibold">Masuk sebagai admin</h2>
          <LoginForm next={typeof next === "string" ? next : "/"} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Akun admin dibuat oleh pemilik usaha. Pendaftaran publik ditutup.
        </p>
      </div>
    </main>
  );
}
