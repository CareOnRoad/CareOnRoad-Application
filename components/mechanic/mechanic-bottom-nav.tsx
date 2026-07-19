"use client"

import { LayoutDashboard, Wrench, CalendarClock, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMechanicApp, type MechanicScreenId } from "./mechanic-app-context"

const items: {
  id: MechanicScreenId
  label: string
  icon: typeof LayoutDashboard
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "jobs", label: "Jobs", icon: Wrench },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "profile", label: "Profile", icon: User },
]

export function MechanicBottomNav() {
  const { screen, navigate } = useMechanicApp()

  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-xl">
      <ul className="flex items-stretch justify-around px-2 pb-5 pt-2">
        {items.map((item) => {
          const active = screen === item.id
          const Icon = item.icon
          return (
            <li key={item.id} className="flex-1">
              <button
                onClick={() => navigate(item.id)}
                className="flex w-full flex-col items-center gap-1 py-1"
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-2xl transition-all",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}