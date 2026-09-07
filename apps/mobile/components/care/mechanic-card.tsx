"use client"

import { useState } from "react"
import {
  Star,
  Phone,
  MessageCircle,
  Award,
  ChevronDown,
  Briefcase,
} from "lucide-react"
import { Card } from "./ui"
import { cn } from "@/lib/utils"
import type { Mechanic } from "@/lib/types"

export function MechanicCard({
  mechanic,
  onMessage,
}: {
  mechanic: Mechanic
  onMessage?: () => void
}) {
  const [showCertifications, setShowCertifications] = useState(false)

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

      <button
        type="button"
        onClick={() => setShowCertifications((v) => !v)}
        aria-expanded={showCertifications}
        aria-controls={`certifications-${mechanic.id}`}
        className="mt-3 flex w-full items-center justify-between rounded-2xl border border-border bg-background px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-colors hover:bg-secondary active:scale-[0.99]"
      >
        <span className="flex items-center gap-2">
          <Award className="size-4 text-primary" />
          View certifications & skills
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            showCertifications && "rotate-180",
          )}
        />
      </button>

      {showCertifications && (
        <div
          id={`certifications-${mechanic.id}`}
          className="mt-3 space-y-2 rounded-2xl border border-border bg-secondary/40 p-3"
        >
          {mechanic.experience && (
            <div className="flex items-center gap-2 text-xs text-foreground">
              <Briefcase className="size-3.5 text-primary" />
              <span className="font-semibold">{mechanic.experience}</span>
            </div>
          )}
          <ul className="space-y-1.5">
            {mechanic.certifications.map((cert, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 rounded-xl bg-background px-2.5 py-2 text-xs text-foreground"
              >
                <Award className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                <span className="leading-snug">{cert}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}