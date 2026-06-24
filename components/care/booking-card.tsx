"use client"

import { CalendarClock, Clock, Bike } from "lucide-react"
import { Card, Badge } from "./ui"
import { formatDate } from "@/lib/mock-data"
import type { Appointment } from "@/lib/types"

export function BookingCard({ appointment }: { appointment: Appointment }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between bg-[var(--navy)] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4" />
          <span className="text-sm font-semibold">{appointment.service}</span>
        </div>
        <Badge
          tone={appointment.status === "confirmed" ? "green" : "amber"}
          className="bg-white/15 text-white"
        >
          {appointment.status === "confirmed" ? "Confirmed" : "Pending"}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Bike className="size-3.5" /> Vehicle
          </span>
          <span className="text-sm font-semibold leading-tight">
            {appointment.vehicleName}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" /> Date
          </span>
          <span className="text-sm font-semibold">
            {formatDate(appointment.date)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> Time
          </span>
          <span className="text-sm font-semibold">{appointment.time}</span>
        </div>
      </div>
    </Card>
  )
}
