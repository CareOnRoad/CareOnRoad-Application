"use client"

import { TrendingUp, TrendingDown } from "lucide-react"
import { Card } from "../../care/ui"
import { formatVND } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export function EarningsCard({
  thisWeek,
  lastWeek,
  label = "This week",
}: {
  thisWeek: number
  lastWeek: number
  label?: string
}) {
  const delta = lastWeek > 0 ? (thisWeek - lastWeek) / lastWeek : 0
  const isUp = delta >= 0

  return (
    <Card className="overflow-hidden border-0 bg-[var(--navy)] text-white">
      <div className="p-5">
        <p className="text-sm text-white/70">{label}</p>
        <p className="mt-1 text-2xl font-bold">{formatVND(thisWeek)}</p>
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            isUp ? "bg-[var(--mint)]/20 text-[var(--mint)]" : "bg-white/10 text-white/80",
          )}
        >
          {isUp ? (
            <TrendingUp className="size-3.5" />
          ) : (
            <TrendingDown className="size-3.5" />
          )}
          <span>
            {isUp ? "+" : ""}
            {(delta * 100).toFixed(1)}% vs last week
          </span>
        </div>
      </div>
    </Card>
  )
}
