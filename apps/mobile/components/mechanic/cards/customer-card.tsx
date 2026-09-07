"use client"

import { Phone, MapPin } from "lucide-react"
import { Card, Badge } from "../../care/ui"
import type { MechanicCustomer } from "@/lib/mechanic-types"

export function CustomerCard({ customer }: { customer: MechanicCustomer }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-bold text-foreground">
          {customer.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{customer.name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="size-3.5" /> {customer.phone}
          </p>
        </div>
        <a
          href={`tel:${customer.phone}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-opacity active:opacity-60"
          aria-label={`Call ${customer.name}`}
        >
          <Phone className="size-4" />
        </a>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="size-3.5" />
        <span>Returning customer</span>
        <Badge tone="green" className="ml-auto">
          Verified
        </Badge>
      </div>
    </Card>
  )
}
