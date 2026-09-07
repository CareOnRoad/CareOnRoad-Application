"use client"

import { useState } from "react"
import {
  User,
  MapPin,
  Bell,
  Languages,
  Moon,
  LifeBuoy,
  LogOut,
  ChevronRight,
  Mail,
  Phone,
  Pencil,
  ShieldCheck,
} from "lucide-react"
import { useApp } from "../app-context"
import { AppHeader } from "../app-header"
import { Card, Badge, ActionButton } from "../ui"
import { cn } from "@/lib/utils"

export function ProfileScreen() {
  const { user, vehicles, services, darkMode, toggleDarkMode } = useApp()
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
                  src={user.avatar || "/placeholder.svg"}
                  alt={user.name}
                  className="size-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{user.name}</h2>
                <p className="flex items-center gap-1 text-sm text-white/70">
                  <Phone className="size-3.5" /> {user.phone}
                </p>
              </div>
              <button
                aria-label="Edit profile"
                className="flex size-9 items-center justify-center rounded-full bg-white/10"
              >
                <Pencil className="size-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
              <ShieldCheck className="size-4 text-[var(--mint)]" />
              <span className="text-xs">CareOnRoad Plus member since 2024</span>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{vehicles.length}</p>
            <p className="text-xs text-muted-foreground">Vehicles</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{services.length}</p>
            <p className="text-xs text-muted-foreground">Services done</p>
          </Card>
        </div>

        {/* Personal information */}
        <section>
          <h3 className="mb-3 font-bold">Personal Information</h3>
          <Card className="divide-y divide-border">
            <Row icon={User} label="Full name" value={user.name} />
            <Row icon={Mail} label="Email" value={user.email} />
            <Row icon={Phone} label="Phone" value={user.phone} />
          </Card>
        </section>

        {/* Saved addresses */}
        <section>
          <h3 className="mb-3 font-bold">Saved Addresses</h3>
          <Card className="divide-y divide-border">
            <AddressRow label="Home" value="124 Nguyen Van Cu, District 5" />
            <AddressRow label="Work" value="72 Le Thanh Ton, District 1" />
          </Card>
        </section>

        {/* Settings */}
        <section>
          <h3 className="mb-3 font-bold">Settings</h3>
          <Card className="divide-y divide-border">
            <ToggleRow
              icon={Bell}
              label="Notification Settings"
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
            <NavRow icon={LifeBuoy} label="Help Center" />
          </Card>
        </section>

        <ActionButton fullWidth variant="outline" className="text-destructive">
          <LogOut className="size-4" /> Logout
        </ActionButton>

        <p className="text-center text-xs text-muted-foreground">
          CareOnRoad · Prototype v1.0
        </p>
      </div>
    </div>
  )
}

function RowIcon({ icon: Icon }: { icon: typeof User }) {
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
  icon: typeof User
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

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <RowIcon icon={MapPin} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{value}</p>
      </div>
      <ChevronRight className="size-5 text-muted-foreground" />
    </div>
  )
}

function NavRow({ icon, label }: { icon: typeof User; label: string }) {
  return (
    <button className="flex w-full items-center gap-3 p-4 text-left">
      <RowIcon icon={icon} />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight className="size-5 text-muted-foreground" />
    </button>
  )
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: typeof User
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
