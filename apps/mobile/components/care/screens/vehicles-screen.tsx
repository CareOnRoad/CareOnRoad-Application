"use client"

import { useState } from "react"
import {
  Plus,
  Pencil,
  Gauge,
  Calendar,
  CalendarClock,
  Palette,
  Check,
  Bike,
} from "lucide-react"
import { useApp } from "../app-context"
import { AppHeader } from "../app-header"
import { VehicleCard } from "../vehicle-card"
import { Card, Badge, ActionButton, Field, TextInput } from "../ui"
import { formatDate } from "@/lib/mock-data"
import type { Vehicle } from "@/lib/types"

type Mode =
  | { view: "list" }
  | { view: "detail"; vehicle: Vehicle }
  | { view: "form"; vehicle?: Vehicle }

export function VehiclesScreen() {
  const { vehicles, addVehicle, updateVehicle } = useApp()
  const [mode, setMode] = useState<Mode>({ view: "list" })

  if (mode.view === "form") {
    return (
      <VehicleForm
        vehicle={mode.vehicle}
        onCancel={() =>
          setMode(
            mode.vehicle
              ? { view: "detail", vehicle: mode.vehicle }
              : { view: "list" },
          )
        }
        onSave={(data) => {
          if (mode.vehicle) {
            const updated = { ...mode.vehicle, ...data }
            updateVehicle(updated)
            setMode({ view: "detail", vehicle: updated })
          } else {
            addVehicle(data)
            setMode({ view: "list" })
          }
        }}
      />
    )
  }

  if (mode.view === "detail") {
    const v = mode.vehicle
    return (
      <div>
        <AppHeader
          title={v.name}
          subtitle={v.plate}
          onBack={() => setMode({ view: "list" })}
        />
        <div className="space-y-4 px-5 pb-28 pt-4">
          <Card className="overflow-hidden">
            <div className="aspect-[16/10] w-full overflow-hidden bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.image || "/placeholder.svg"}
                alt={v.name}
                className="size-full object-cover"
              />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <h2 className="text-lg font-bold">{v.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {v.brand} · {v.year}
                </p>
              </div>
              <Badge tone="blue">{v.plate}</Badge>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatTile icon={Gauge} label="Mileage" value={`${v.mileage.toLocaleString()} km`} />
            <StatTile icon={Palette} label="Color" value={v.color} />
            <StatTile
              icon={Calendar}
              label="Last service"
              value={formatDate(v.lastMaintenance)}
            />
            <StatTile
              icon={CalendarClock}
              label="Next service"
              value={formatDate(v.nextMaintenance)}
            />
          </div>

          <ActionButton
            fullWidth
            variant="outline"
            onClick={() => setMode({ view: "form", vehicle: v })}
          >
            <Pencil className="size-4" /> Edit Vehicle
          </ActionButton>
        </div>
      </div>
    )
  }

  return (
    <div>
      <AppHeader title="My Vehicles" subtitle={`${vehicles.length} registered`} />
      <div className="space-y-3 px-5 pb-28 pt-4">
        <ActionButton
          fullWidth
          onClick={() => setMode({ view: "form" })}
          className="border border-dashed border-primary/40 bg-primary/5 py-4 text-primary"
        >
          <Plus className="size-5" /> Add Vehicle
        </ActionButton>

        {vehicles.length === 0 ? (
          <EmptyState />
        ) : (
          vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onClick={() => setMode({ view: "detail", vehicle: v })}
            />
          ))
        )}
      </div>
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge
  label: string
  value: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 font-bold">{value}</p>
    </Card>
  )
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Bike className="size-7" />
      </div>
      <p className="font-semibold">No vehicles yet</p>
      <p className="text-sm text-muted-foreground">
        Add your motorcycle to start tracking maintenance.
      </p>
    </Card>
  )
}

function VehicleForm({
  vehicle,
  onSave,
  onCancel,
}: {
  vehicle?: Vehicle
  onSave: (data: Omit<Vehicle, "id" | "image">) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: vehicle?.name ?? "",
    brand: vehicle?.brand ?? "",
    plate: vehicle?.plate ?? "",
    mileage: vehicle?.mileage?.toString() ?? "",
    color: vehicle?.color ?? "",
    year: vehicle?.year?.toString() ?? "",
    lastMaintenance: vehicle?.lastMaintenance ?? "",
    nextMaintenance: vehicle?.nextMaintenance ?? "",
  })

  const valid = form.name.trim() && form.plate.trim() && form.mileage.trim()

  return (
    <div>
      <AppHeader
        title={vehicle ? "Edit Vehicle" : "Add Vehicle"}
        onBack={onCancel}
      />
      <form
        className="space-y-4 px-5 pb-28 pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          onSave({
            name: form.name.trim(),
            brand: form.brand.trim() || "Motorcycle",
            plate: form.plate.trim(),
            mileage: Number(form.mileage) || 0,
            color: form.color.trim() || "—",
            year: Number(form.year) || new Date().getFullYear(),
            lastMaintenance:
              form.lastMaintenance || new Date().toISOString().slice(0, 10),
            nextMaintenance:
              form.nextMaintenance ||
              new Date(Date.now() + 1000 * 60 * 60 * 24 * 120)
                .toISOString()
                .slice(0, 10),
          })
        }}
      >
        <Field label="Model name">
          <TextInput
            placeholder="e.g. Honda Vision"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand">
            <TextInput
              placeholder="Honda"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </Field>
          <Field label="Year">
            <TextInput
              type="number"
              placeholder="2024"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Plate number">
          <TextInput
            placeholder="59-H1 234.56"
            value={form.plate}
            onChange={(e) => setForm({ ...form, plate: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mileage (km)">
            <TextInput
              type="number"
              placeholder="12000"
              value={form.mileage}
              onChange={(e) => setForm({ ...form, mileage: e.target.value })}
            />
          </Field>
          <Field label="Color">
            <TextInput
              placeholder="Pearl White"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Last maintenance">
            <TextInput
              type="date"
              value={form.lastMaintenance}
              onChange={(e) =>
                setForm({ ...form, lastMaintenance: e.target.value })
              }
            />
          </Field>
          <Field label="Next maintenance">
            <TextInput
              type="date"
              value={form.nextMaintenance}
              onChange={(e) =>
                setForm({ ...form, nextMaintenance: e.target.value })
              }
            />
          </Field>
        </div>
        <ActionButton fullWidth type="submit" disabled={!valid}>
          <Check className="size-4" /> {vehicle ? "Save changes" : "Add vehicle"}
        </ActionButton>
      </form>
    </div>
  )
}
