"use client";

import { useTransition } from "react";

import { adminSignOutAction } from "@/app/admin/sign-out-action";

export function AdminSignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void adminSignOutAction())}
      className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Đang đăng xuất…" : "Đăng xuất"}
    </button>
  );
}
