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
  CalendarClock,
  XCircle,
  Wrench as WrenchIcon,
  FileText,
} from "lucide-react"
import { useApp } from "../app-context"
import { AppHeader } from "../app-header"
import { Card, ActionButton, Field } from "../ui"
import { BookingCard } from "../booking-card"
import { CancelAppointmentModal } from "../cancel-appointment-modal"
import { serviceTypes, timeSlots, formatVND } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { Appointment } from "@/lib/types"

const serviceIcons = {
  oil: Droplet,
  brake: Disc,
  tire: CircleDot,
  general: Wrench,
} as const

function BookingForm({ onBooked }: { onBooked: (appt: Appointment) => void }) {
  const { vehicles, addAppointment } = useApp()
  const [submitting, setSubmitting] = useState(false)
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
      onBooked(appt)
    }, 600)
  }

  return (
    <div className="space-y-4 px-5 pb-4 pt-2">
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
        <span className="mb-1.5 block text-sm font-semibold">Select service</span>
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
    </div>
  )
}

function CanceledBookingCard({
  canceled,
}: {
  canceled: import("@/lib/types").CanceledAppointment
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between bg-destructive px-4 py-3 text-destructive-foreground">
        <div className="flex items-center gap-2">
          <XCircle className="size-4" />
          <span className="text-sm font-semibold">{canceled.service}</span>
        </div>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">
          Canceled
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <WrenchIcon className="size-3.5" /> Vehicle
          </span>
          <span className="text-sm font-semibold leading-tight">
            {canceled.vehicleName}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" /> Date
          </span>
          <span className="text-sm font-semibold">
            {canceled.date} · {canceled.time}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="size-3.5" /> Reason
          </span>
          <span className="line-clamp-2 text-xs font-medium text-foreground">
            {canceled.reason}
          </span>
        </div>
      </div>
    </Card>
  )
}

function EmergencyHistoryCard({
  call,
}: {
  call: import("@/lib/types").EmergencyCall
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <Wrench className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-semibold leading-tight">
              {call.issue}
            </h3>
            <span className="shrink-0 text-sm font-bold text-foreground">
              {formatVND(call.price)}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {call.vehicleName} · {call.mechanicName}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
              <CalendarClock className="size-3" />
              {call.date} · {call.time}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--green)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--green)] dark:text-[var(--mint)]">
              <Check className="size-3" />
              Completed
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

function BookingConfirmation({
  appointment,
  onAnother,
}: {
  appointment: Appointment
  onAnother: () => void
}) {
  return (
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
            Your appointment has been booked. We'll send a reminder before your
            visit.
          </p>
        </div>
      </div>
      <BookingCard appointment={appointment} />
      <ActionButton fullWidth variant="outline" onClick={onAnother}>
        Book another service
      </ActionButton>
    </div>
  )
}

type HistoryTab = "maintenance" | "emergency"
type MaintenanceFilter = "upcoming" | "canceled" | "completed"

export function ScheduleScreen() {
  const {
    appointments,
    canceledAppointments,
    emergencyCalls,
    services,
    cancelAppointment,
  } = useApp()
  const [tab, setTab] = useState<HistoryTab>("maintenance")
  const [maintenanceFilter, setMaintenanceFilter] =
    useState<MaintenanceFilter>("upcoming")
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [justBooked, setJustBooked] = useState<Appointment | null>(null)

  if (justBooked) {
    return (
      <div>
        <AppHeader title="Booking Confirmed" />
        <BookingConfirmation
          appointment={justBooked}
          onAnother={() => {
            setJustBooked(null)
            setShowBookingForm(false)
          }}
        />
      </div>
    )
  }

  const completedCount = services.length
  const totalMaintenance = appointments.length + canceledAppointments.length
  const totalEmergency = emergencyCalls.length

  return (
    <div>
      <AppHeader
        title="Booking & History"
        subtitle="Schedule and review your services"
      />

      {/* Top-level tab switcher */}
      <div className="px-5 pb-3 pt-1">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-secondary/40 p-1">
          <button
            onClick={() => setTab("maintenance")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.97]",
              tab === "maintenance"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            <CalendarClock className="size-4" />
            Maintenance
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                tab === "maintenance"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {totalMaintenance}
            </span>
          </button>
          <button
            onClick={() => setTab("emergency")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.97]",
              tab === "emergency"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            <Wrench className="size-4" />
            Emergency
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                tab === "emergency"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {totalEmergency}
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-5 px-5 pb-28 pt-2">
        {showBookingForm && tab === "maintenance" ? (
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-3">
              <h3 className="font-bold">New booking</h3>
              <button
                onClick={() => setShowBookingForm(false)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <BookingForm
              onBooked={(appt) => {
                setShowBookingForm(false)
                setJustBooked(appt)
              }}
            />
          </Card>
        ) : tab === "maintenance" ? (
          <ActionButton
            fullWidth
            onClick={() => setShowBookingForm(true)}
            className="py-3"
          >
            <CalendarCheck className="size-4" /> Book new maintenance
          </ActionButton>
        ) : null}

        {tab === "maintenance" && (
          <>
            {/* Sub-filter: Upcoming / Canceled / Completed */}
            <div className="flex gap-2 rounded-2xl bg-secondary/40 p-1">
              {(
                [
                  { id: "upcoming", label: "Upcoming", count: appointments.length },
                  {
                    id: "canceled",
                    label: "Canceled",
                    count: canceledAppointments.length,
                  },
                  {
                    id: "completed",
                    label: "Completed",
                    count: completedCount,
                  },
                ] as { id: MaintenanceFilter; label: string; count: number }[]
              ).map((f) => {
                const active = maintenanceFilter === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => setMaintenanceFilter(f.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all",
                      active
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    {f.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] font-bold",
                        active ? "bg-primary/10 text-primary" : "bg-muted",
                      )}
                    >
                      {f.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {maintenanceFilter === "upcoming" && (
              <>
                {appointments.length === 0 ? (
                  <EmptyHint
                    icon={CalendarClock}
                    title="No upcoming appointments"
                    description="Book a maintenance visit and it will appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    {appointments.map((a) => (
                      <BookingCard
                        key={a.id}
                        appointment={a}
                        onCancel={() => setCancelling(a)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {maintenanceFilter === "canceled" && (
              <>
                {canceledAppointments.length === 0 ? (
                  <EmptyHint
                    icon={XCircle}
                    title="No canceled bookings"
                    description="Canceled appointments with their reason will appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    {canceledAppointments.map((c) => (
                      <CanceledBookingCard key={c.id} canceled={c} />
                    ))}
                  </div>
                )}
              </>
            )}

            {maintenanceFilter === "completed" && (
              <>
                {services.length === 0 ? (
                  <EmptyHint
                    icon={Check}
                    title="No completed services"
                    description="Completed maintenance visits will appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    {services.map((s) => (
                      <Card key={s.id} className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Wrench className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="truncate font-semibold leading-tight">
                                {s.type}
                              </h3>
                              <span className="shrink-0 text-sm font-bold text-foreground">
                                {formatVND(s.price)}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {s.vehicleName} · {s.mechanic}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {s.date}
                            </p>
                          </div>
                        </div>
                        {s.notes && (
                          <p className="mt-2 line-clamp-2 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
                            {s.notes}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "emergency" && (
          <>
            {emergencyCalls.length === 0 ? (
              <EmptyHint
                icon={Wrench}
                title="No emergency calls yet"
                description="Completed emergency rescue requests will appear here with damage and repair details."
              />
            ) : (
              <div className="space-y-3">
                {emergencyCalls.map((call) => (
                  <EmergencyHistoryCard key={call.id} call={call} />
                ))}
              </div>
            )}

            <Card className="border-dashed bg-secondary/30 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Need emergency help? Go to the{" "}
                <span className="font-semibold text-foreground">Rescue</span>{" "}
                tab to request a mechanic.
              </p>
            </Card>
          </>
        )}
      </div>

      <CancelAppointmentModal
        open={!!cancelling}
        appointmentLabel={
          cancelling
            ? `${cancelling.service} · ${cancelling.vehicleName} · ${cancelling.time}`
            : undefined
        }
        onClose={() => setCancelling(null)}
        onConfirm={(reason) => {
          if (cancelling) cancelAppointment(cancelling.id, reason)
          setCancelling(null)
        }}
      />
    </div>
  )
}

function EmptyHint({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CalendarClock
  title: string
  description: string
}) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="size-7" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Card>
  )
}