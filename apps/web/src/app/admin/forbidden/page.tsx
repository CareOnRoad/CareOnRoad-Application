import type { Metadata } from "next";
import Link from "next/link";

import { AdminSignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: "CareOnRoad — Không đủ quyền"
};

/**
 * /admin/forbidden — shown when the signed-in account is not an active admin.
 *
 * Lives outside the `(protected)` group on purpose: the guard redirects here,
 * so the guard cannot wrap this page.
 */
export default function AdminForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-soft px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border-soft bg-surface p-8 text-center shadow-card">
        <h1 className="text-xl font-bold text-ink">Không đủ quyền truy cập</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Tài khoản hiện tại không có quyền quản trị hoặc đang không hoạt động. Nếu bạn
          cho rằng đây là nhầm lẫn, vui lòng liên hệ quản trị viên hệ thống.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <AdminSignOutButton />
          <Link
            href="/"
            className="text-sm text-ink-muted underline-offset-4 hover:underline"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
