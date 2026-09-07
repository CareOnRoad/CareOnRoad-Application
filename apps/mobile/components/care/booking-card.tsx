"use client"

import { CalendarClock, Clock, Bike, Check, X } from "lucide-react"
import { Card, Badge, ActionButton } from "./ui"
import { formatDate } from "@/lib/mock-data"
import type { Appointment } from "@/lib/types"

export function BookingCard({
  appointment,
  onCancel,
}: {
  appointment: Appointment
  onCancel?: () => void
}) {
  const isConfirmed = appointment.status === "confirmed"
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between bg-[var(--navy)] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4" />
          <span className="text-sm font-semibold">{appointment.service}</span>
        </div>
        <Badge
          tone={isConfirmed ? "green" : "amber"}
          className="bg-white/15 text-white"
        >
          {isConfirmed ? "Confirmed" : "Pending"}
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
      <div className="grid grid-cols-2 gap-2 border-t border-border px-4 py-3">
        <ActionButton
          variant="mint"
          className="py-2.5 text-xs"
          aria-label="Confirm appointment"
        >
          <Check className="size-4" />
          Confirm
        </ActionButton>
        <ActionButton
          variant="destructive"
          className="py-2.5 text-xs"
          onClick={onCancel}
          aria-label="Cancel appointment"
        >
          <X className="size-4" />
          Cancel
        </ActionButton>
      </div>
    </Card>
  )
}