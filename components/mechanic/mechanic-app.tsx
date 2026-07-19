"use client"

import {
  MechanicAppProvider,
  useMechanicApp,
} from "./mechanic-app-context"
import { MechanicBottomNav } from "./mechanic-bottom-nav"
import { MechanicDashboardScreen } from "./screens/mechanic-dashboard"
import { MechanicJobsScreen } from "./screens/mechanic-jobs-screen"
import { MechanicJobDetailScreen } from "./screens/mechanic-job-detail"
import { MechanicScheduleScreen } from "./screens/mechanic-schedule"
import { MechanicProfileScreen } from "./screens/mechanic-profile"
import { cn } from "@/lib/utils"

interface MechanicAppProps {
  onSwitchRole: () => void
}

function ScreenRouter({ onSwitchRole }: { onSwitchRole: () => void }) {
  const { screen, selectedJobId, backToJobs } = useMechanicApp()

  // If a job is selected and we are in jobs context, show detail
  if (screen === "jobs" && selectedJobId) {
    return <MechanicJobDetailScreen onBack={backToJobs} />
  }

  switch (screen) {
    case "dashboard":
      return <MechanicDashboardScreen />
    case "jobs":
      return <MechanicJobsScreen />
    case "schedule":
      return <MechanicScheduleScreen />
    case "profile":
      return <MechanicProfileScreen onSwitchRole={onSwitchRole} />
    default:
      return <MechanicDashboardScreen />
  }
}

function Shell({ onSwitchRole }: MechanicAppProps) {
  const { darkMode } = useMechanicApp()
  return (
    <div
      className={cn(
        "relative mx-auto flex h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden bg-background text-foreground shadow-2xl sm:my-4 sm:h-[900px] sm:rounded-[2.5rem] sm:ring-8 sm:ring-[var(--navy)]",
        darkMode && "dark",
      )}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <ScreenRouter onSwitchRole={onSwitchRole} />
      </div>
      <MechanicBottomNav />
    </div>
  )
}

export function MechanicApp({ onSwitchRole }: MechanicAppProps) {
  return (
    <MechanicAppProvider>
      <main className="min-h-[100dvh] bg-[var(--navy)] sm:py-0">
        <Shell onSwitchRole={onSwitchRole} />
      </main>
    </MechanicAppProvider>
  )
}