"use client"

import { useEffect, useState } from "react"
import { Bike, Wrench, ArrowRight, RefreshCcw } from "lucide-react"
import { Card, Badge } from "./care/ui"
import { CareApp } from "./care/care-app"
import { MechanicApp } from "./mechanic/mechanic-app"
import { cn } from "@/lib/utils"

type Role = "rider" | "mechanic"

const STORAGE_KEY = "careonroad.role"

export function RolePicker() {
  const [role, setRole] = useState<Role | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Role | null
      if (saved === "rider" || saved === "mechanic") setRole(saved)
    } catch {
      // ignore (e.g. SSR / privacy mode)
    }
    setHydrated(true)
  }, [])

  const choose = (r: Role) => {
    setRole(r)
    try {
      localStorage.setItem(STORAGE_KEY, r)
    } catch {
      // ignore
    }
  }

  const switchBack = () => {
    setRole(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  if (!hydrated) {
    // Avoid hydration mismatch: render an empty shell that matches the app size.
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[var(--navy)]" />
    )
  }

  if (role === "rider") {
    return (
      <div className="relative">
        <RoleSwitchHint onSwitch={switchBack} />
        <CareApp />
      </div>
    )
  }

  if (role === "mechanic") {
    return (
      <div className="relative">
        <RoleSwitchHint onSwitch={switchBack} />
        <MechanicApp onSwitchRole={switchBack} />
      </div>
    )
  }

  return <Landing onChoose={choose} />
}

function Landing({ onChoose }: { onChoose: (r: Role) => void }) {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center bg-[var(--navy)] px-5 py-8 text-white">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <Badge className="mb-4 bg-white/10 text-white">CareOnRoad Demo</Badge>
          <h1 className="text-balance text-3xl font-bold leading-tight">
            Choose how you want to use the app
          </h1>
          <p className="mt-2 text-sm text-white/70">
            You can switch any time from your profile.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <RoleCard
            tone="blue"
            icon={<Bike className="size-7" />}
            title="I'm a Rider"
            subtitle="Emergency rescue, book maintenance, manage vehicles"
            onClick={() => onChoose("rider")}
          />
          <RoleCard
            tone="green"
            icon={<Wrench className="size-7" />}
            title="I'm a Mechanic"
            subtitle="Manage jobs, schedule, customers and earnings"
            onClick={() => onChoose("mechanic")}
          />
        </div>

        <p className="mt-8 text-center text-xs text-white/50">
          CareOnRoad · Prototype v1.0
        </p>
      </div>
    </main>
  )
}

function RoleCard({
  tone,
  icon,
  title,
  subtitle,
  onClick,
}: {
  tone: "blue" | "green"
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
}) {
  const toneStyles: Record<string, string> = {
    blue: "bg-primary/15 text-primary ring-primary/30",
    green: "bg-[var(--green)]/15 text-[var(--mint)] ring-[var(--mint)]/30",
  }
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-left text-white transition-all hover:bg-white/10 active:scale-[0.98]"
    >
      <div
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-2xl ring-1",
          toneStyles[tone],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold">{title}</p>
        <p className="text-sm text-white/70">{subtitle}</p>
      </div>
      <ArrowRight className="size-5 shrink-0 text-white/60 transition-transform group-hover:translate-x-1" />
    </button>
  )
}

function RoleSwitchHint({ onSwitch }: { onSwitch: () => void }) {
  return (
    <button
      onClick={onSwitch}
      className="fixed right-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xl transition-opacity hover:bg-white/20 active:opacity-60"
    >
      <RefreshCcw className="size-3.5" /> Switch role
    </button>
  )
}