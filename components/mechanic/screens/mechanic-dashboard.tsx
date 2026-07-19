"use client"

import {
  Wrench,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRight,
  Star,
  Bell,
} from "lucide-react"
import { useMechanicApp } from "../mechanic-app-context"
import { Card, Badge, ActionButton, SectionHeader } from "../../care/ui"
import { JobCard } from "../cards/job-card"
import { EarningsCard } from "../cards/earnings-card"

export function MechanicDashboardScreen() {
  const {
    mechanic,
    garage,
    todayJobs,
    upcomingTodayJobs,
    earnings,
    navigate,
    openJob,
    updateJobStatus,
  } = useMechanicApp()

  const pendingCount = todayJobs.filter((j) => j.status === "pending").length
  const inProgressCount = todayJobs.filter(
    (j) => j.status === "in_progress",
  ).length
  const completedCount = todayJobs.filter(
    (j) => j.status === "completed",
  ).length

  const nextJob = upcomingTodayJobs[0]

  const handleStartNext = () => {
    if (!nextJob) return
    if (nextJob.status === "pending") {
      updateJobStatus(nextJob.id, "in_progress")
    }
    openJob(nextJob.id)
  }

  return (
    <div className="space-y-5 px-5 pb-28 pt-4">
      {/* Welcome card */}
      <Card className="overflow-hidden border-0 bg-[var(--navy)] text-white">
        <div className="relative p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Good afternoon,</p>
              <h2 className="text-xl font-bold">{mechanic.name}</h2>
              <p className="mt-1 text-xs text-white/70">{garage.name}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="size-12 overflow-hidden rounded-full ring-2 ring-white/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mechanic.avatar || "/placeholder.svg"}
                  alt={mechanic.name}
                  className="size-full object-cover"
                />
              </div>
              <div className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs">
                <Star className="size-3 fill-[var(--mint)] text-[var(--mint)]" />
                <span>{mechanic.rating}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 backdrop-blur">
            <Bell className="size-4 text-[var(--mint)]" />
            <span className="text-xs">
              {pendingCount + inProgressCount} jobs active today
            </span>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div>
        <SectionHeader title="Today" />
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            icon={Circle}
            label="Pending"
            value={pendingCount}
            tone="amber"
          />
          <StatTile
            icon={Clock}
            label="In progress"
            value={inProgressCount}
            tone="blue"
          />
          <StatTile
            icon={CheckCircle2}
            label="Completed"
            value={completedCount}
            tone="green"
          />
        </div>
      </div>

      {/* Earnings */}
      <EarningsCard
        thisWeek={earnings.thisWeek}
        lastWeek={earnings.lastWeek}
      />

      {/* Quick action */}
      {nextJob && (
        <Card className="overflow-hidden border-0 bg-[var(--green)] text-white">
          <div className="flex items-center gap-3 p-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <Wrench className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/80">Up next</p>
              <p className="truncate font-bold leading-tight">
                {nextJob.type} · {nextJob.vehicle.plate}
              </p>
              <p className="text-xs text-white/80">
                {nextJob.scheduledTime} · {nextJob.customer.name}
              </p>
            </div>
            <ActionButton
              variant="mint"
              className="px-3 py-2"
              onClick={handleStartNext}
            >
              Start <ArrowRight className="size-4" />
            </ActionButton>
          </div>
        </Card>
      )}

      {/* Upcoming today */}
      <div>
        <SectionHeader
          title="Upcoming today"
          action="See all"
          onAction={() => navigate("jobs")}
        />
        {upcomingTodayJobs.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No more jobs scheduled for today. Nice work!
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingTodayJobs.slice(0, 3).map((j) => (
              <JobCard
                key={j.id}
                job={j}
                onClick={() => openJob(j.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wrench
  label: string
  value: number
  tone: "amber" | "blue" | "green"
}) {
  const toneStyles: Record<string, string> = {
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    blue: "bg-primary/10 text-primary",
    green: "bg-[var(--green)]/10 text-[var(--green)] dark:text-[var(--mint)]",
  }
  return (
    <Card className="p-3">
      <div
        className={`flex size-8 items-center justify-center rounded-xl ${toneStyles[tone]}`}
      >
        <Icon className="size-4" />
      </div>
      <p className="mt-2 text-xl font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </Card>
  )
}
