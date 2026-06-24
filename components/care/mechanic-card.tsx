"use client"

import { Star, Phone, MessageCircle } from "lucide-react"
import { Card } from "./ui"
import type { Mechanic } from "@/lib/types"

export function MechanicCard({
  mechanic,
  onMessage,
}: {
  mechanic: Mechanic
  onMessage?: () => void
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-full bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mechanic.avatar || "/placeholder.svg"}
            alt={mechanic.name}
            className="size-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold leading-tight">{mechanic.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {mechanic.specialty}
          </p>
          <div className="mt-1 flex items-center gap-1 text-xs">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{mechanic.rating}</span>
            <span className="text-muted-foreground">
              · {mechanic.trips.toLocaleString()} trips
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`tel:${mechanic.phone}`}
            aria-label="Call mechanic"
            className="flex size-10 items-center justify-center rounded-full bg-[var(--green)] text-white transition-transform active:scale-90"
          >
            <Phone className="size-4" />
          </a>
          <button
            onClick={onMessage}
            aria-label="Message mechanic"
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90"
          >
            <MessageCircle className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-3 rounded-2xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
        {mechanic.vehicle}
      </p>
    </Card>
  )
}
