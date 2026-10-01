"use client";

import { useActionState } from "react";
import { MailIcon, ShieldIcon } from "@/components/ui/icons";

import { adminLoginAction, type AdminLoginState } from "./actions";

const INITIAL_STATE: AdminLoginState = { error: null };

/**
 * /admin/login — sign-in form for administrators.
 *
 * Deliberately separate from the marketing `/dang-nhap` page so that adding
 * real authentication does not change the rider/mechanic experience.
 */
export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLoginAction, INITIAL_STATE);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-soft px-4 py-16">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-2 text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
            CareOnRoad
          </span>
          <h1 className="text-2xl font-bold text-ink">Đăng nhập quản trị</h1>
          <p className="text-sm text-ink-muted">
            Khu vực dành riêng cho quản trị viên và trưởng ca.
          </p>
        </div>

        <form
          action={formAction}
          className="mt-8 flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-6 shadow-card"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Email</span>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-ink">
              <MailIcon className="h-4 w-4 text-ink-subtle" />
              <input
                required
                name="email"
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Mật khẩu</span>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-ink">
              <ShieldIcon className="h-4 w-4 text-ink-subtle" />
              <input
                required
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
              />
            </div>
          </label>

          {state.error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}
