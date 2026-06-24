"use client"

import { Home, Bike, LifeBuoy, CalendarClock, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "./app-context"
import type { TabId } from "@/lib/types"

const items: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "vehicles", label: "Vehicles", icon: Bike },
  { id: "rescue", label: "Rescue", icon: LifeBuoy },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "profile", label: "Profile", icon: User },
]

export function BottomNavigation() {
  const { activeTab, setTab } = useApp()

  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-xl">
      <ul className="flex items-stretch justify-around px-2 pb-5 pt-2">
        {items.map((item) => {
          const active = activeTab === item.id
          const isRescue = item.id === "rescue"
          const Icon = item.icon
          return (
            <li key={item.id} className="flex-1">
              <button
                onClick={() => setTab(item.id)}
                className="flex w-full flex-col items-center gap-1 py-1"
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-2xl transition-all",
                    isRescue && "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30",
                    !isRescue && active && "bg-primary/10 text-primary",
                    !isRescue && !active && "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("size-5", isRescue && "size-5")} />
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
