"use client"

import { Wrench, Calendar, ChevronRight } from "lucide-react"
import { Card, Badge } from "./ui"
import { formatDate, formatVND } from "@/lib/mock-data"
import type { ServiceRecord } from "@/lib/types"

export function MaintenanceCard({
  record,
  onClick,
}: {
  record: ServiceRecord
  onClick?: () => void
}) {
  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Wrench className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-semibold leading-tight">{record.type}</h3>
            <span className="shrink-0 text-sm font-bold text-foreground">
              {formatVND(record.price)}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {record.vehicleName} · {record.mechanic}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge tone="neutral">
              <Calendar className="size-3" />
              {formatDate(record.date)}
            </Badge>
            {record.status === "completed" ? (
              <Badge tone="green">Completed</Badge>
            ) : (
              <Badge tone="amber">Upcoming</Badge>
            )}
          </div>
        </div>
        {onClick && (
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        )}
      </div>
    </Card>
  )
}
