"use client"

import { Gauge, ChevronRight } from "lucide-react"
import { Card, Badge } from "./ui"
import { formatDate } from "@/lib/mock-data"
import type { Vehicle } from "@/lib/types"

export function VehicleCard({
  vehicle,
  onClick,
}: {
  vehicle: Vehicle
  onClick?: () => void
}) {
  return (
    <Card onClick={onClick} className="overflow-hidden">
      <div className="flex gap-3 p-3">
        <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vehicle.image || "/placeholder.svg"}
            alt={vehicle.name}
            className="size-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-bold leading-tight">{vehicle.name}</h3>
              <p className="text-xs text-muted-foreground">{vehicle.plate}</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="blue">
              <Gauge className="size-3" />
              {vehicle.mileage.toLocaleString()} km
            </Badge>
            <Badge tone="neutral">{vehicle.year}</Badge>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Next service: {formatDate(vehicle.nextMaintenance)}
          </p>
        </div>
      </div>
    </Card>
  )
}
