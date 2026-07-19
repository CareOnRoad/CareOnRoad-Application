"use client"

import { AppProvider, useApp } from "./app-context"
import { BottomNavigation } from "./bottom-navigation"
// import { SOSButton } from "./sos-button"
import { HomeScreen } from "./screens/home-screen"
import { VehiclesScreen } from "./screens/vehicles-screen"
import { RescueScreen } from "./screens/rescue-screen"
import { ScheduleScreen } from "./screens/schedule-screen"
import { ProfileScreen } from "./screens/profile-screen"
import { HistoryScreen } from "./screens/history-screen"
import { cn } from "@/lib/utils"

function ScreenRouter() {
  const { screen, navigate } = useApp()
  switch (screen) {
    case "home":
      return <HomeScreen />
    case "vehicles":
      return <VehiclesScreen />
    case "rescue":
    case "tracking":
      return <RescueScreen />
    case "schedule":
      return <ScheduleScreen />
    case "profile":
      return <ProfileScreen />
    case "history":
      return <HistoryScreen onBack={() => navigate("home")} />
    default:
      return <HomeScreen />
  }
}

function Shell() {
  const { darkMode, screen } = useApp()
  // SOS floating button only on primary browsing screens
  const showSos = ["home", "vehicles", "schedule", "profile"].includes(screen)

  return (
    <div
      className={cn(
        "relative mx-auto flex h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden bg-background text-foreground shadow-2xl sm:my-4 sm:h-[900px] sm:rounded-[2.5rem] sm:ring-8 sm:ring-[var(--navy)]",
        darkMode && "dark",
      )}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <ScreenRouter />
      </div>
      {/* {showSos && <SOSButton />} */}
      <BottomNavigation />
    </div>
  )
}

export function CareApp() {
  return (
    <AppProvider>
      <main className="min-h-[100dvh] bg-[var(--navy)] sm:py-0">
        <Shell />
      </main>
    </AppProvider>
  )
}
