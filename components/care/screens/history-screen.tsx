"use client"

import { useState } from "react"
import {
  Wrench,
  Calendar,
  User,
  Bike,
  Receipt,
  FileText,
  History,
} from "lucide-react"
import { useApp } from "../app-context"
import { AppHeader } from "../app-header"
import { Card, Badge, ActionButton } from "../ui"
import { MaintenanceCard } from "../maintenance-card"
import { formatDate, formatVND } from "@/lib/mock-data"
import type { ServiceRecord } from "@/lib/types"

export function HistoryScreen({ onBack }: { onBack: () => void }) {
  const { services } = useApp()
  const [selected, setSelected] = useState<ServiceRecord | null>(null)

  const total = services.reduce((sum, s) => sum + s.price, 0)

  if (selected) {
    return (
      <div>
        <AppHeader
          title="Service Detail"
          subtitle={selected.type}
          onBack={() => setSelected(null)}
        />
        <div className="space-y-4 px-5 pb-28 pt-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Wrench className="size-6" />
              </span>
              <div className="flex-1">
                <h2 className="text-lg font-bold leading-tight">
                  {selected.type}
                </h2>
                <Badge tone="green" className="mt-1">
                  Completed
                </Badge>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <DetailRow icon={Bike} label="Vehicle" value={selected.vehicleName} />
              <DetailRow
                icon={Calendar}
                label="Date"
                value={formatDate(selected.date)}
              />
              <DetailRow icon={User} label="Mechanic" value={selected.mechanic} />
              <DetailRow
                icon={Receipt}
                label="Total paid"
                value={formatVND(selected.price)}
              />
            </div>
          </Card>

          {selected.notes && (
            <Card className="p-5">
              <h3 className="mb-2 flex items-center gap-2 font-bold">
                <FileText className="size-4 text-primary" /> Service notes
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {selected.notes}
              </p>
            </Card>
          )}

          <ActionButton fullWidth variant="outline">
            <Receipt className="size-4" /> Download invoice
          </ActionButton>
        </div>
      </div>
    )
  }

  return (
    <div>
      <AppHeader title="Service History" onBack={onBack} />
      <div className="space-y-4 px-5 pb-28 pt-4">
        <Card className="flex items-center justify-between bg-[var(--navy)] p-4 text-white">
          <div>
            <p className="text-xs text-white/70">Total spent on maintenance</p>
            <p className="text-xl font-bold">{formatVND(total)}</p>
          </div>
          <Badge className="bg-white/15 text-white">
            {services.length} services
          </Badge>
        </Card>

        {services.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <History className="size-7" />
            </div>
            <p className="font-semibold">No service history</p>
            <p className="text-sm text-muted-foreground">
              Your completed services will appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {services.map((s) => (
              <MaintenanceCard
                key={s.id}
                record={s}
                onClick={() => setSelected(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wrench
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" /> {label}
      </span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  )
}
