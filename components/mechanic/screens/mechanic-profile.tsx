"use client"

import { useState } from "react"
import {
  Star,
  Phone,
  Mail,
  MapPin,
  Award,
  TrendingUp,
  Bell,
  Languages,
  Moon,
  LifeBuoy,
  LogOut,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react"
import { useMechanicApp } from "../mechanic-app-context"
import { AppHeader } from "../../care/app-header"
import { Card, Badge, ActionButton } from "../../care/ui"
import { formatVND } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

interface MechanicProfileScreenProps {
  onSwitchRole: () => void
}

export function MechanicProfileScreen({
  onSwitchRole,
}: MechanicProfileScreenProps) {
  const { mechanic, garage, earnings, darkMode, toggleDarkMode } =
    useMechanicApp()
  const [notifications, setNotifications] = useState(true)
  const [language, setLanguage] = useState<"EN" | "VI">("EN")

  return (
    <div>
      <AppHeader title="Profile" />
      <div className="space-y-5 px-5 pb-28 pt-4">
        {/* Profile card */}
        <Card className="overflow-hidden border-0 bg-[var(--navy)] text-white">
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="size-16 overflow-hidden rounded-full ring-2 ring-white/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mechanic.avatar || "/placeholder.svg"}
                  alt={mechanic.name}
                  className="size-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{mechanic.name}</h2>
                <p className="text-xs text-white/70">{mechanic.specialty}</p>
                <div className="mt-1 flex items-center gap-1 text-xs text-white/80">
                  <Star className="size-3.5 fill-[var(--mint)] text-[var(--mint)]" />
                  <span className="font-semibold">{mechanic.rating}</span>
                  <span className="text-white/60">
                    · {mechanic.totalJobs} jobs
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
              <ShieldCheck className="size-4 text-[var(--mint)]" />
              <span className="text-xs">
                {garage.name} · {mechanic.experienceYears} years experience
              </span>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label="Total jobs"
            value={mechanic.totalJobs.toString()}
            tone="blue"
          />
          <StatTile
            label="Rating"
            value={mechanic.rating.toString()}
            tone="green"
          />
          <StatTile
            label="This month"
            value={formatVND(earnings.thisMonth)}
            tone="amber"
            small
          />
        </div>

        {/* Trend */}
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--green)]/10 text-[var(--green)] dark:text-[var(--mint)]">
              <TrendingUp className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">This week vs last</p>
              <p className="font-bold">
                +{formatVND(earnings.thisWeek - earnings.lastWeek)}
              </p>
            </div>
            <Badge tone="green">
              +
              {(
                ((earnings.thisWeek - earnings.lastWeek) /
                  Math.max(earnings.lastWeek, 1)) *
                100
              ).toFixed(1)}
              %
            </Badge>
          </div>
        </Card>

        {/* Garage */}
        <section>
          <h3 className="mb-3 font-bold">Garage</h3>
          <Card className="divide-y divide-border">
            <Row icon={MapPin} label="Address" value={garage.address} />
            <Row icon={Phone} label="Garage phone" value={garage.phone} />
            <Row icon={Mail} label="Contact email" value="quan@quansgarage.vn" />
          </Card>
        </section>

        {/* Certifications */}
        <section>
          <h3 className="mb-3 font-bold">Certifications</h3>
          <div className="space-y-2">
            {mechanic.certifications.map((c) => (
              <Card key={c} className="flex items-center gap-3 p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Award className="size-4" />
                </div>
                <p className="text-sm font-medium">{c}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Settings */}
        <section>
          <h3 className="mb-3 font-bold">Settings</h3>
          <Card className="divide-y divide-border">
            <ToggleRow
              icon={Bell}
              label="Job notifications"
              checked={notifications}
              onChange={() => setNotifications((v) => !v)}
            />
            <button
              onClick={() => setLanguage((l) => (l === "EN" ? "VI" : "EN"))}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <RowIcon icon={Languages} />
              <span className="flex-1 text-sm font-medium">Language</span>
              <Badge tone="blue">
                {language === "EN" ? "English" : "Tiếng Việt"}
              </Badge>
            </button>
            <ToggleRow
              icon={Moon}
              label="Dark Mode"
              checked={darkMode}
              onChange={toggleDarkMode}
            />
            <button className="flex w-full items-center gap-3 p-4 text-left">
              <RowIcon icon={LifeBuoy} />
              <span className="flex-1 text-sm font-medium">Help Center</span>
            </button>
          </Card>
        </section>

        <ActionButton
          fullWidth
          variant="outline"
          onClick={onSwitchRole}
        >
          <RefreshCcw className="size-4" /> Switch to Rider view
        </ActionButton>

        <ActionButton
          fullWidth
          variant="outline"
          className="text-destructive"
        >
          <LogOut className="size-4" /> Logout
        </ActionButton>

        <p className="text-center text-xs text-muted-foreground">
          CareOnRoad Mechanic · Prototype v1.0
        </p>
      </div>
    </div>
  )
}

function RowIcon({ icon: Icon }: { icon: typeof Star }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
      <Icon className="size-4" />
    </span>
  )
}

function Row({
  icon,
  label,
  value,
}: {
  icon: typeof Star
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <RowIcon icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: typeof Star
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <RowIcon icon={icon} />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  )
}

function StatTile({
  label,
  value,
  tone,
  small,
}: {
  label: string
  value: string
  tone: "blue" | "green" | "amber"
  small?: boolean
}) {
  const toneStyles: Record<string, string> = {
    blue: "bg-primary/10 text-primary",
    green: "bg-[var(--green)]/10 text-[var(--green)] dark:text-[var(--mint)]",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  }
  return (
    <Card className="p-3 text-center">
      <div
        className={`mx-auto flex size-8 items-center justify-center rounded-xl ${toneStyles[tone]}`}
      >
        <Star className="size-4" />
      </div>
      <p
        className={cn(
          "mt-2 font-bold",
          small ? "text-sm leading-tight" : "text-xl",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </Card>
  )
}
