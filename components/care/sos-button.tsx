"use client"

import { Siren } from "lucide-react"
import { useApp } from "./app-context"

export function SOSButton() {
  const { navigate } = useApp()
  return (
    <button
      onClick={() => navigate("rescue")}
      aria-label="Emergency SOS"
      className="absolute bottom-24 right-5 z-30 flex size-16 flex-col items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-xl shadow-destructive/40 transition-transform active:scale-90"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />
      <Siren className="relative size-6" />
      <span className="relative text-[10px] font-bold tracking-wide">SOS</span>
    </button>
  )
}
