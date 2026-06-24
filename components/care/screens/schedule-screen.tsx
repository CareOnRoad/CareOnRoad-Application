"use client"

import { useState } from "react"
import {
  Droplet,
  Disc,
  CircleDot,
  Wrench,
  Check,
  CalendarCheck,
  ChevronDown,
} from "lucide-react"
import { useApp } from "../app-context"
import { AppHeader } from "../app-header"
import { Card, ActionButton, Field } from "../ui"
import { BookingCard } from "../booking-card"
import { serviceTypes, timeSlots, formatVND } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { Appointment } from "@/lib/types"

const serviceIcons = {
  oil: Droplet,
  brake: Disc,
  tire: CircleDot,
  general: Wrench,
} as const

export function ScheduleScreen() {
  const { vehicles, appointments, addAppointment } = useApp()
  const [submitting, setSubmitting] = useState(false)
  const [booked, setBooked] = useState<Appointment | null>(null)

  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "")
  const [service, setService] = useState<string | null>(null)
  const [date, setDate] = useState("")
  const [time, setTime] = useState<string | null>(null)

  const selectedService = serviceTypes.find((s) => s.id === service)
  const valid = vehicleId && service && date && time

  const submit = () => {
    if (!valid) return
    setSubmitting(true)
    setTimeout(() => {
      const vehicle = vehicles.find((v) => v.id === vehicleId)
      const appt = addAppointment({
        vehicleId,
        vehicleName: vehicle?.name ?? "Vehicle",
        service: selectedService?.label ?? "Service",
        date,
        time: time!,
        status: "confirmed",
      })
      setSubmitting(false)
      setBooked(appt)
    }, 1400)
  }

  const resetForm = () => {
    setBooked(null)
    setService(null)
    setDate("")
    setTime(null)
  }

  if (booked) {
    return (
      <div>
        <AppHeader title="Booking Confirmed" />
        <div className="space-y-5 px-5 pb-28 pt-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative flex size-20 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--green)]/20" />
              <span className="relative flex size-16 items-center justify-center rounded-full bg-[var(--green)] text-white">
                <Check className="size-8" />
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold">You're all set!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your appointment has been booked. We'll send a reminder before
                your visit.
              </p>
            </div>
          </div>
          <BookingCard appointment={booked} />
          <ActionButton fullWidth variant="outline" onClick={resetForm}>
            Book another service
          </ActionButton>
        </div>
      </div>
    )
  }

  return (
    <div>
      <AppHeader title="Book Maintenance" subtitle="Schedule a service visit" />
      <div className="space-y-5 px-5 pb-28 pt-4">
        {/* Select vehicle */}
        <Field label="Select vehicle">
          <div className="relative">
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full appearance-none rounded-2xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.plate}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </Field>

        {/* Select service */}
        <div>
          <span className="mb-1.5 block text-sm font-semibold">
            Select service
          </span>
          <div className="grid grid-cols-2 gap-3">
            {serviceTypes.map((s) => {
              const Icon = serviceIcons[s.id as keyof typeof serviceIcons]
              const selected = service === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setService(s.id)}
                  className={cn(
                    "flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all active:scale-[0.97]",
                    selected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold leading-tight">
                    {s.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatVND(s.price)} · {s.duration}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Select date */}
        <Field label="Select date">
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>

        {/* Select time */}
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Select time</span>
          <div className="grid grid-cols-4 gap-2">
            {timeSlots.map((t) => {
              const selected = time === t
              return (
                <button
                  key={t}
                  onClick={() => setTime(t)}
                  className={cn(
                    "rounded-xl border py-2.5 text-sm font-semibold transition-all active:scale-95",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        <ActionButton
          fullWidth
          onClick={submit}
          disabled={!valid || submitting}
          className="py-4 text-base"
        >
          {submitting ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              Booking…
            </>
          ) : (
            <>
              <CalendarCheck className="size-5" /> Book Appointment
            </>
          )}
        </ActionButton>

        {appointments.length > 0 && (
          <div>
            <h3 className="mb-3 font-bold">Upcoming appointments</h3>
            <div className="space-y-3">
              {appointments.map((a) => (
                <BookingCard key={a.id} appointment={a} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
