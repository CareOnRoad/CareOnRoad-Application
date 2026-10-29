"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, CloseIcon, MenuIcon } from "@/components/ui/icons";
import { JOIN_BETA_LABEL, PLAY_STORE_BETA_URL } from "@/lib/play-store";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/dich-vu", label: "Dịch vụ" },
  { href: "/tin-tuc", label: "Tin tức" },
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
          <Image
            src="/images/logos/cor-logo.png"
            alt="CareOnRoad"
            width={48}
            height={48}
            className="h-12 w-12 rounded-xl object-contain"
          />
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
          <a
            href={PLAY_STORE_BETA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-surface shadow-pop transition-transform hover:-translate-y-0.5"
          >
            {JOIN_BETA_LABEL}
            <ArrowRightIcon className="h-4 w-4" />
          </a>
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
          <div className="mt-3">
            <a
              href={PLAY_STORE_BETA_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-center text-sm font-semibold text-surface shadow-pop"
            >
              {JOIN_BETA_LABEL}
              <ArrowRightIcon className="h-4 w-4" />
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}