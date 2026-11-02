import type { CSSProperties, ReactNode } from "react";

import { AdminSignOutButton } from "@/app/admin/forbidden/sign-out-button";
import { AdminNav } from "@/components/admin/admin-nav";
import type { AdminNavBadge } from "@/lib/admin/nav";

/**
 * Admin dashboard layout chrome — theo figma Section `256:15205`.
 *
 * Mỗi frame dashboard có 3 khối:
 *  - Aside (256×...): sidebar logo + nav với badges
 *  - Header (1184×64): topbar breadcrumb + user chip + zone selector
 *  - Main (1136-1184): nội dung riêng từng trang
 *
 * Component này render aside + header và slot nội dung vào Main.
 *
 * The navigation itself lives in `@/lib/admin/nav` — a single source of
 * truth for the 13 tabs. A page never defines its own menu, so a tab cannot
 * disappear from the sidebar just because someone forgot to update a list.
 */

interface AdminLayoutProps {
  children: ReactNode;
  /** Optional badge overrides, keyed by nav href. */
  badges?: Record<string, AdminNavBadge>;
  crumb?: string[];
  userName?: string;
}

const ink: CSSProperties = { color: "#162130" };
const inkSubtle: CSSProperties = { color: "#3d4d63" };
const accentGreen: CSSProperties = { color: "#00a23a" };

/** Up to two initials from the signed-in display name, e.g. "Nguyễn Minh An" → "NA". */
function initialsOf(userName: string) {
  const words = userName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

export function AdminLayout({
  children,
  badges,
  crumb = [],
  userName = "Quản trị viên"
}: AdminLayoutProps) {
  return (
    <div
      className="flex min-h-screen w-full"
      style={{ backgroundColor: "#f3f5f8", fontFamily: "'Work Sans', sans-serif" }}
    >
      {/* ===== Aside (Sidebar) ===== */}
      <aside
        className="flex w-[256px] shrink-0 flex-col overflow-y-auto"
        style={{
          backgroundColor: "#f3f5f8",
          borderRight: "1px solid #e5e9ef",
        }}
      >
        <div className="flex flex-col gap-1 px-5 pb-6 pt-7">
          <div className="flex items-center gap-2">
            <span
              className="grid h-9 w-9 place-items-center rounded-lg text-base font-bold"
              style={{ backgroundColor: "#162130", color: "#fff" }}
            >
              CR
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold" style={ink}>
                CareOnRoad
              </span>
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "#fc555f" }}
              >
                Trung tâm Điều hành
              </span>
            </div>
          </div>
        </div>

        <AdminNav badges={badges} />

        {/* No network-capacity card: `/api/v1` exposes no online-mechanic
            aggregate, so any "42/50 on duty" figure here would be invented. */}
      </aside>

      {/* ===== Header + Main ===== */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Topbar */}
        <header
          className="flex h-16 items-center justify-between gap-4 px-8"
          style={{
            backgroundColor: "#fff",
            borderBottom: "1px solid #e5e9ef"
          }}
        >
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold" style={ink}>
              {crumb[crumb.length - 1] ?? "Tổng quan Điều hành"}
            </span>
            <span className="text-xs" style={accentGreen}>
              {crumb.length > 1
                ? crumb.join(" / ")
                : "Trực tiếp — Dữ liệu từ API vận hành"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right leading-tight">
              <span className="text-sm font-semibold" style={ink}>
                {userName}
              </span>
              <span className="text-[11px]" style={inkSubtle}>
                Quản trị viên
              </span>
            </div>
            <span
              className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold"
              style={{ backgroundColor: "#00a23a", color: "#fff" }}
              aria-hidden
            >
              {initialsOf(userName)}
            </span>
            <AdminSignOutButton />
          </div>
        </header>

        {/* Main content slot */}
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
