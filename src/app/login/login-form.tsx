"use client";

import { useActionState } from "react";
import { login, type StatusLogin } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<StatusLogin, FormData>(login, {
    pesan: "",
    email: "",
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          className="input"
          placeholder="admin@contoh.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>

      {state.pesan && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.pesan}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Memproses…" : "Masuk"}
      </button>
    </form>
  );
}
