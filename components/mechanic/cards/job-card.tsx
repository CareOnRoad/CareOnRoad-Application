"use client"

import { Phone, Bike, Wrench, ChevronRight, Clock } from "lucide-react"
import { Card, Badge } from "../../care/ui"
import { formatVND } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { MechanicJob } from "@/lib/mechanic-types"

const statusTone: Record<
  MechanicJob["status"],
  "amber" | "blue" | "red" | "green"
> = {
  pending: "amber",
  in_progress: "blue",
  awaiting_parts: "red",
  completed: "green",
}

const statusLabel: Record<MechanicJob["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  awaiting_parts: "Awaiting parts",
  completed: "Completed",
}

export function JobCard({
  job,
  onClick,
}: {
  job: MechanicJob
  onClick: () => void
}) {
  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground">
          <Wrench className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">
                {job.type}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {job.customer.name} · {job.vehicle.plate}
              </p>
            </div>
            <Badge tone={statusTone[job.status]}>{statusLabel[job.status]}</Badge>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3.5" />
              <span>
                {job.scheduledTime} · {job.durationMin} min
              </span>
            </div>
            <span className="font-bold text-foreground">
              {formatVND(job.price)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <a
              href={`tel:${job.customer.phone}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground transition-opacity active:opacity-60",
              )}
            >
              <Phone className="size-3.5" />
              {job.customer.phone}
            </a>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Bike className="size-3.5" />
              {job.vehicle.name}
            </span>
            <ChevronRight className="ml-auto size-5 text-muted-foreground" />
          </div>
        </div>
      </div>
    </Card>
  )
}
