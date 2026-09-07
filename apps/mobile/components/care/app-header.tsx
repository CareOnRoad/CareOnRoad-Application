"use client"

import { ArrowLeft, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export function AppHeader({
  title,
  subtitle,
  onBack,
  right,
  variant = "default",
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
  variant?: "default" | "navy"
}) {
  const isNavy = variant === "navy"
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 px-5 pb-4 pt-5",
        isNavy
          ? "bg-[var(--navy)] text-white"
          : "border-b border-border bg-card/80 text-foreground backdrop-blur-xl",
      )}
    >
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Go back"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95",
            isNavy ? "bg-white/10 hover:bg-white/20" : "bg-secondary hover:opacity-80",
          )}
        >
          <ArrowLeft className="size-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
        {subtitle && (
          <p
            className={cn(
              "truncate text-sm",
              isNavy ? "text-white/70" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {right ?? (
        <button
          aria-label="Notifications"
          className={cn(
            "relative flex size-9 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95",
            isNavy ? "bg-white/10 hover:bg-white/20" : "bg-secondary hover:opacity-80",
          )}
        >
          <Bell className="size-5" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive" />
        </button>
      )}
    </header>
  )
}
