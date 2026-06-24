"use client"

import {
  Siren,
  CalendarPlus,
  Bike,
  History,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Wrench,
} from "lucide-react"
import { useApp } from "../app-context"
import { Card, SectionHeader, Badge, ActionButton } from "../ui"
import { MaintenanceCard } from "../maintenance-card"
import { formatDate } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const quickActions = [
  { id: "rescue", label: "Emergency Rescue", icon: Siren, tone: "red" },
  { id: "schedule", label: "Book Maintenance", icon: CalendarPlus, tone: "blue" },
  { id: "vehicles", label: "My Vehicles", icon: Bike, tone: "green" },
  { id: "history", label: "Service History", icon: History, tone: "navy" },
] as const

const toneStyles: Record<string, string> = {
  red: "bg-destructive/10 text-destructive",
  blue: "bg-primary/10 text-primary",
  green: "bg-[var(--green)]/10 text-[var(--green)] dark:text-[var(--mint)]",
  navy: "bg-[var(--navy)]/10 text-[var(--navy)] dark:bg-white/10 dark:text-white",
}

export function HomeScreen() {
  const { navigate, setTab, user, vehicles, services } = useApp()
  const upcoming = vehicles
    .slice()
    .sort(
      (a, b) =>
        new Date(a.nextMaintenance).getTime() -
        new Date(b.nextMaintenance).getTime(),
    )[0]
  const recent = services.filter((s) => s.status === "completed").slice(0, 2)

  return (
    <div className="space-y-5 px-5 pb-28 pt-4">
      {/* Welcome card */}
      <Card className="overflow-hidden border-0 bg-[var(--navy)] text-white">
        <div className="relative p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Good afternoon,</p>
              <h2 className="text-xl font-bold">{user.name}</h2>
            </div>
            <div className="size-12 overflow-hidden rounded-full ring-2 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatar || "/placeholder.svg"}
                alt={user.name}
                className="size-full object-cover"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 backdrop-blur">
            <ShieldCheck className="size-4 text-[var(--mint)]" />
            <span className="text-xs">
              CareOnRoad Plus active · 24/7 coverage
            </span>
          </div>
        </div>
      </Card>

      {/* Quick actions */}
      <div>
        <SectionHeader title="Quick Actions" />
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.id}
                onClick={() =>
                  a.id === "rescue" || a.id === "schedule" || a.id === "vehicles"
                    ? setTab(a.id as "rescue" | "schedule" | "vehicles")
                    : navigate("history")
                }
                className="flex flex-col items-center gap-2"
              >
                <span
                  className={cn(
                    "flex size-14 items-center justify-center rounded-2xl transition-transform active:scale-90",
                    toneStyles[a.tone],
                  )}
                >
                  <Icon className="size-6" />
                </span>
                <span className="text-center text-[11px] font-medium leading-tight text-foreground">
                  {a.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Upcoming maintenance reminder */}
      {upcoming && (
        <div>
          <SectionHeader
            title="Maintenance Reminder"
            action="Book now"
            onAction={() => setTab("schedule")}
          />
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Wrench className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">
                  {upcoming.name} is due soon
                </p>
                <p className="text-xs text-muted-foreground">
                  Scheduled for {formatDate(upcoming.nextMaintenance)} ·{" "}
                  {upcoming.mileage.toLocaleString()} km
                </p>
              </div>
              <Badge tone="amber">Due</Badge>
            </div>
          </Card>
        </div>
      )}

      {/* Recent services */}
      <div>
        <SectionHeader
          title="Recent Services"
          action="See all"
          onAction={() => navigate("history")}
        />
        <div className="space-y-3">
          {recent.map((r) => (
            <MaintenanceCard
              key={r.id}
              record={r}
              onClick={() => navigate("history")}
            />
          ))}
        </div>
      </div>

      {/* Promo banner */}
      <Card className="overflow-hidden border-0 bg-[var(--green)] text-white">
        <div className="flex items-center justify-between gap-3 p-5">
          <div>
            <Badge className="mb-2 bg-white/20 text-white">Limited offer</Badge>
            <h3 className="text-lg font-bold leading-tight text-balance">
              30% off your first oil change
            </h3>
            <p className="mt-1 text-sm text-white/80">
              Use code CARE30 at booking checkout.
            </p>
            <ActionButton
              variant="mint"
              className="mt-3 px-4 py-2"
              onClick={() => setTab("schedule")}
            >
              Book now <ArrowRight className="size-4" />
            </ActionButton>
          </div>
          <Siren className="hidden size-12 shrink-0 text-white/30 sm:block" />
        </div>
      </Card>
    </div>
  )
}
