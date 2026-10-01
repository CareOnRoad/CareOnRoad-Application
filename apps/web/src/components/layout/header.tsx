"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, CloseIcon, MenuIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/dich-vu", label: "Dịch vụ" },
  { href: "/tin-tuc", label: "Tin tức" },
  { href: "/dat-lich", label: "Đặt lịch" },
  { href: "/lien-he", label: "Liên hệ hỗ trợ" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-soft bg-surface/95 shadow-header backdrop-blur">
      <div className="container-page flex h-[94px] items-center justify-between gap-8">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="CareOnRoad trang chủ"
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-deep text-surface">
            <span className="text-lg font-bold">CR</span>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-bold text-ink">CareOnRoad</span>
            <span className="text-xs text-ink-subtle">
              Cứu hộ xe máy 24/7
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Chính">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/dang-nhap"
            className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Đăng nhập
          </Link>
          <Link
            href="/dang-ky"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-brand-deep"
          >
            Đăng ký
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Đóng menu" : "Mở menu"}
          aria-expanded={open}
          className="grid h-10 w-10 place-items-center rounded-full border border-border-soft text-ink lg:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <CloseIcon className="h-5 w-5" />
          ) : (
            <MenuIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      <div
        className={cn(
          "lg:hidden",
          open
            ? "border-t border-border-soft bg-surface"
            : "hidden",
        )}
      >
        <nav
          className="container-page flex flex-col gap-1 py-4"
          aria-label="Di động"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-3 flex gap-2">
            <Link
              href="/dang-nhap"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full border border-border px-4 py-2 text-center text-sm font-medium text-ink"
            >
              Đăng nhập
            </Link>
            <Link
              href="/dang-ky"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full bg-ink px-4 py-2 text-center text-sm font-semibold text-surface"
            >
              Đăng ký
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
