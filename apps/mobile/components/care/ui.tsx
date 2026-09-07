"use client"

import { cn } from "@/lib/utils"
import type { ButtonHTMLAttributes, ReactNode } from "react"

export function Card({
  children,
  className,
  onClick,
  interactive,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  interactive?: boolean
}) {
  const Comp = onClick ? "button" : "div"
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "w-full rounded-3xl border border-border bg-card text-card-foreground shadow-sm",
        (onClick || interactive) &&
          "text-left transition-all active:scale-[0.98] hover:shadow-md",
        className,
      )}
    >
      {children}
    </Comp>
  )
}

type Variant = "primary" | "secondary" | "destructive" | "ghost" | "outline" | "mint"

const variantStyles: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-secondary text-secondary-foreground hover:opacity-80",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
  ghost: "bg-transparent text-foreground hover:bg-secondary",
  outline: "border border-border bg-transparent text-foreground hover:bg-secondary",
  mint: "bg-accent text-accent-foreground hover:opacity-90",
}

export function ActionButton({
  children,
  variant = "primary",
  className,
  fullWidth,
  ...props
}: {
  variant?: Variant
  fullWidth?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
        variantStyles[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode
  className?: string
  tone?: "neutral" | "blue" | "green" | "red" | "amber"
}) {
  const tones: Record<string, string> = {
    neutral: "bg-secondary text-secondary-foreground",
    blue: "bg-primary/10 text-primary",
    green: "bg-[var(--green)]/10 text-[var(--green)] dark:text-[var(--mint)]",
    red: "bg-destructive/10 text-destructive",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      {action && (
        <button
          onClick={onAction}
          className="text-sm font-semibold text-primary transition-opacity active:opacity-60"
        >
          {action}
        </button>
      )}
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20",
        props.className,
      )}
    />
  )
}
