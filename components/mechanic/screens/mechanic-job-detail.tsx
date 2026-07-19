"use client"

import {
  Bike,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Gauge,
  CheckCircle2,
  Circle,
  AlertCircle,
  Wrench,
} from "lucide-react"
import { useMechanicApp } from "../mechanic-app-context"
import { AppHeader } from "../../care/app-header"
import { Card, Badge } from "../../care/ui"
import { CustomerCard } from "../cards/customer-card"
import { JobUpdateForm } from "../forms/job-update-form"
import { formatDate, formatVND } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { MechanicJobStatus } from "@/lib/mechanic-types"

const timeline: { id: MechanicJobStatus; label: string }[] = [
  { id: "pending", label: "Assigned" },
  { id: "in_progress", label: "In progress" },
  { id: "awaiting_parts", label: "Awaiting parts" },
  { id: "completed", label: "Completed" },
]

const statusTone: Record<MechanicJobStatus, "amber" | "blue" | "red" | "green"> = {
  pending: "amber",
  in_progress: "blue",
  awaiting_parts: "red",
  completed: "green",
}

export function MechanicJobDetailScreen({
  onBack,
}: {
  onBack: () => void
}) {
  const { getJob, selectedJobId, updateJobStatus, completeJob } =
    useMechanicApp()

  const job = selectedJobId ? getJob(selectedJobId) : undefined

  if (!job) {
    return (
      <div>
        <AppHeader title="Job not found" onBack={onBack} />
      </div>
    )
  }

  const currentStep = timeline.findIndex((s) => s.id === job.status)

  return (
    <div>
      <AppHeader
        title={job.type}
        subtitle={`${job.vehicle.plate} · ${job.scheduledTime}`}
        onBack={onBack}
      />
      <div className="space-y-4 px-5 pb-28 pt-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <Badge tone={statusTone[job.status]}>
            {job.status.replace("_", " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Created {formatDate(job.scheduledDate)}
          </span>
        </div>

        {/* Vehicle card */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bike className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold leading-tight">
                {job.vehicle.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {job.vehicle.brand} · {job.vehicle.plate}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gauge className="size-3.5" />
              <span>{job.vehicle.mileage.toLocaleString()} km</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              <span>Today · {job.scheduledTime}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              <span>{job.durationMin} min</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              {formatVND(job.price)}
            </div>
          </div>
        </Card>

        {/* Symptom */}
        <section>
          <h3 className="mb-2 font-bold">Customer's request</h3>
          <Card className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p className="text-sm">{job.symptom}</p>
            </div>
          </Card>
        </section>

        {/* Customer */}
        <section>
          <h3 className="mb-2 font-bold">Customer</h3>
          <CustomerCard customer={job.customer} />
        </section>

        {/* Timeline */}
        <section>
          <h3 className="mb-2 font-bold">Job progress</h3>
          <Card className="p-4">
            <ol className="space-y-3">
              {timeline.map((step, i) => {
                const reached = i <= currentStep
                const isCurrent = i === currentStep
                return (
                  <li key={step.id} className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full",
                        reached
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground",
                        isCurrent && "ring-4 ring-primary/20",
                      )}
                    >
                      {reached ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <Circle className="size-4" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm",
                        reached ? "font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                    {isCurrent && (
                      <Badge tone="blue" className="ml-auto">
                        Current
                      </Badge>
                    )}
                  </li>
                )
              })}
            </ol>
          </Card>
        </section>

        {/* Before / after */}
        <section>
          <h3 className="mb-2 font-bold">Before / After</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="overflow-hidden p-0">
              <div className="aspect-square bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/placeholder.svg"
                  alt="Before"
                  className="size-full object-cover"
                />
              </div>
              <div className="p-2 text-center text-xs font-semibold text-muted-foreground">
                Before
              </div>
            </Card>
            <Card className="overflow-hidden p-0">
              <div className="aspect-square bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/placeholder.svg"
                  alt="After"
                  className="size-full object-cover"
                />
              </div>
              <div className="p-2 text-center text-xs font-semibold text-muted-foreground">
                After
              </div>
            </Card>
          </div>
        </section>

        {/* Update form */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Wrench className="size-4 text-primary" />
            <h3 className="font-bold">Update job</h3>
          </div>
          <Card className="p-4">
            <JobUpdateForm
              job={job}
              onSave={(status, notes) =>
                updateJobStatus(job.id, status, notes)
              }
              onComplete={(payload) => completeJob(job.id, payload)}
            />
          </Card>
        </section>

        {/* Location shortcut */}
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent("Customer location")}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <MapPin className="size-3.5" />
          Open pickup location in Maps
        </a>
      </div>
    </div>
  )
}
