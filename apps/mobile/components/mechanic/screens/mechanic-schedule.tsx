"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react"
import { useMechanicApp } from "../mechanic-app-context"
import { AppHeader } from "../../care/app-header"
import { Card, Badge } from "../../care/ui"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const BASE_WEEK_START = "2026-07-13" // Monday

function shiftDate(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function getDayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  })
}

export function MechanicScheduleScreen() {
  const { scheduleSlots, getJob, openJob } = useMechanicApp()
  const [weekOffset, setWeekOffset] = useState(0)

  const weekStart = useMemo(
    () => shiftDate(BASE_WEEK_START, weekOffset * 7),
    [weekOffset],
  )
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i)),
    [weekStart],
  )

  // Unique time slots (sorted)
  const timeSlots = useMemo(() => {
    const set = new Set<string>()
    scheduleSlots.forEach((s) => set.add(s.time))
    return Array.from(set).sort()
  }, [scheduleSlots])

  const slotsByDateTime = useMemo(() => {
    const map = new Map<string, (typeof scheduleSlots)[number]>()
    scheduleSlots.forEach((s) => {
      map.set(`${s.date}__${s.time}`, s)
    })
    return map
  }, [scheduleSlots])

  const weekRange = `${getDayLabel(weekDates[0])} – ${getDayLabel(
    weekDates[6],
  )}`

  return (
    <div>
      <AppHeader
        title="Schedule"
        subtitle={weekRange}
        right={
          <button
            aria-label="Calendar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary transition-opacity active:opacity-60"
          >
            <CalIcon className="size-5" />
          </button>
        }
      />

      {/* Week navigation */}
      <div className="flex items-center justify-between px-5 py-3">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="flex size-9 items-center justify-center rounded-full bg-secondary transition-opacity active:opacity-60"
          aria-label="Previous week"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="text-sm font-semibold">Week {weekOffset === 0 ? "current" : weekOffset > 0 ? `+${weekOffset}` : weekOffset}</p>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="flex size-9 items-center justify-center rounded-full bg-secondary transition-opacity active:opacity-60"
          aria-label="Next week"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="space-y-3 px-5 pb-28">
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="w-16 px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground">
                    Time
                  </th>
                  {weekDates.map((d, i) => (
                    <th
                      key={d}
                      className="px-1 py-2 text-center text-[11px] font-semibold text-muted-foreground"
                    >
                      <div>{WEEKDAY_LABELS[i]}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {getDayLabel(d)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((time) => (
                  <tr key={time} className="border-b border-border last:border-b-0">
                    <td className="px-2 py-2 align-top text-[11px] font-semibold text-muted-foreground">
                      {time}
                    </td>
                    {weekDates.map((date) => {
                      const slot = slotsByDateTime.get(`${date}__${time}`)
                      const status = slot?.status ?? "available"
                      const job = slot?.jobId ? getJob(slot.jobId) : undefined

                      return (
                        <td key={date} className="p-1 align-top">
                          <button
                            disabled={!job}
                            onClick={() => job && openJob(job.id)}
                            className={cn(
                              "flex w-full min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1 text-[10px] font-medium transition-all",
                              !job && status === "off" &&
                                "border-dashed border-border bg-secondary/30 text-muted-foreground",
                              !job && status === "available" &&
                                "border-dashed border-border bg-background text-muted-foreground",
                              !job && status === "working" &&
                                "border-dashed border-border bg-secondary/30 text-muted-foreground",
                              job && status === "working" &&
                                "border-primary bg-primary text-primary-foreground active:scale-95",
                              job && status === "available" &&
                                "border-amber-500/50 bg-amber-500/10 text-amber-700 active:scale-95 dark:text-amber-300",
                              job && "cursor-pointer hover:opacity-90",
                            )}
                          >
                            {job ? (
                              <>
                                <span className="truncate font-bold">
                                  {job.type}
                                </span>
                                <span className="truncate opacity-80">
                                  {job.vehicle.plate}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px]">
                                {status === "off" ? "Off" : "Open"}
                              </span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <LegendDot className="bg-primary" label="Working" />
          <LegendDot
            className="bg-amber-500/40 border border-amber-500/50"
            label="Awaiting"
          />
          <LegendDot
            className="border border-dashed border-border bg-secondary/30"
            label="Available / Off"
          />
        </div>

        {/* Tip */}
        <Card className="bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">
            <Badge tone="blue" className="mr-2">
              Tip
            </Badge>
            Tap any job slot to open its full details.
          </p>
        </Card>
      </div>
    </div>
  )
}

function LegendDot({
  className,
  label,
}: {
  className: string
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-3 rounded-full", className)} />
      {label}
    </span>
  )
}
