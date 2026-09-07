"use client"

import { useState } from "react"
import { Inbox } from "lucide-react"
import { useMechanicApp } from "../mechanic-app-context"
import { AppHeader } from "../../care/app-header"
import { Card, Badge } from "../../care/ui"
import { JobCard } from "../cards/job-card"
import { cn } from "@/lib/utils"
import type { MechanicJobStatus } from "@/lib/mechanic-types"

type Filter = "all" | MechanicJobStatus

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In progress" },
  { id: "awaiting_parts", label: "Awaiting parts" },
  { id: "completed", label: "Completed" },
]

export function MechanicJobsScreen() {
  const { jobs, openJob } = useMechanicApp()
  const [filter, setFilter] = useState<Filter>("all")

  const filtered = jobs
    .filter((j) => (filter === "all" ? true : j.status === filter))
    .sort((a, b) => {
      // Sort: not completed first, then by scheduled time descending (newest first)
      if (a.status === "completed" && b.status !== "completed") return 1
      if (a.status !== "completed" && b.status === "completed") return -1
      return `${b.scheduledDate} ${b.scheduledTime}`.localeCompare(
        `${a.scheduledDate} ${a.scheduledTime}`,
      )
    })

  const counts: Record<Filter, number> = {
    all: jobs.length,
    pending: jobs.filter((j) => j.status === "pending").length,
    in_progress: jobs.filter((j) => j.status === "in_progress").length,
    awaiting_parts: jobs.filter((j) => j.status === "awaiting_parts").length,
    completed: jobs.filter((j) => j.status === "completed").length,
  }

  return (
    <div>
      <AppHeader
        title="Jobs"
        subtitle={`${counts.pending + counts.in_progress} active`}
      />

      {/* Filter tabs */}
      <div className="sticky top-[72px] z-10 border-b border-border bg-background/95 px-5 py-3 backdrop-blur-xl">
        <div className="flex gap-2 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              {f.label}
              <Badge
                tone="neutral"
                className={cn(
                  "px-1.5 py-0",
                  filter === f.id
                    ? "bg-white/20 text-white"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {counts[f.id]}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-5 pb-28 pt-4">
        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Inbox className="size-7" />
            </div>
            <p className="font-semibold">No jobs in this list</p>
            <p className="text-sm text-muted-foreground">
              Try another filter to see more jobs.
            </p>
          </Card>
        ) : (
          filtered.map((j) => (
            <JobCard key={j.id} job={j} onClick={() => openJob(j.id)} />
          ))
        )}
      </div>
    </div>
  )
}
