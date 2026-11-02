"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ADMIN_NAV_SECTIONS,
  type AdminNavBadge,
  type AdminNavItem
} from "@/lib/admin/nav";

/**
 * The admin sidebar navigation.
 *
 * A Client Component because the active tab must follow the current URL: a
 * detail page such as `/admin/users/<id>` still has to highlight the
 * "Người dùng" tab. The server layout stays free of client-side URL state.
 *
 * The tab list itself comes from `@/lib/admin/nav`, the single source of truth
 * for all 13 admin tabs.
 */

export function AdminNav({
  badges
}: {
  /** Optional badge overrides, keyed by nav href. */
  badges?: Record<string, AdminNavBadge>;
}) {
  const pathname = usePathname();

  // The longest matching href wins, so a nested detail page highlights its
  // parent tab rather than a shorter prefix.
  const activeHref = ADMIN_NAV_SECTIONS.flatMap((section) => section.items)
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex flex-col gap-4 px-3 pb-6" aria-label="Điều hành">
      {ADMIN_NAV_SECTIONS.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          <span className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#3d4d63" }}>
            {section.label}
          </span>
          {section.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={activeHref === item.href}
              badge={badges?.[item.href]}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function NavLink({
  item,
  isActive,
  badge
}: {
  item: AdminNavItem;
  isActive: boolean;
  badge?: AdminNavBadge;
}) {
  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors"
      style={isActive ? { backgroundColor: "#162130", color: "#fff" } : { color: "#3d4d63" }}
    >
      <span className="font-medium" style={isActive ? { color: "#fff" } : { color: "#3d4d63" }}>
        {item.label}
      </span>
      {badge ? (
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={
            badge.tone === "danger"
              ? { backgroundColor: "#93000a", color: "#fff" }
              : isActive
                ? { backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }
                : { backgroundColor: "#e5e9ef", color: "#162130" }
          }
        >
          {badge.text}
        </span>
      ) : null}
    </Link>
  );
}
