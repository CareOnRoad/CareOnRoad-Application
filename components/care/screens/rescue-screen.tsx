"use client"

import { useEffect, useState } from "react"
import {
  Cog,
  CircleDot,
  BatteryWarning,
  Fuel,
  TriangleAlert,
  MapPin,
  Navigation,
  Clock,
  Siren,
  Loader2,
  Check,
  PhoneCall,
  RotateCcw,
  Save,
} from "lucide-react"
import { useApp } from "../app-context"
import { AppHeader } from "../app-header"
import { Card, Badge, ActionButton, Field, TextInput } from "../ui"
import { MechanicCard } from "../mechanic-card"
import { AiChatbox } from "../ai-chatbox"
import { issueCategories, mockMechanics } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const iconMap = {
  Cog,
  CircleDot,
  BatteryWarning,
  Fuel,
  TriangleAlert,
} as const

type Phase = "select" | "searching" | "tracking"

const timeline = [
  "Request Sent",
  "Mechanic Assigned",
  "Mechanic On The Way",
  "Mechanic Arrived",
  "Service Completed",
]

export function RescueScreen() {
  const { vehicles, addEmergencyCall } = useApp()
  const [phase, setPhase] = useState<Phase>("select")
  const [issue, setIssue] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [eta, setEta] = useState(12)
  const [completed, setCompleted] = useState(false)
  const [damageDesc, setDamageDesc] = useState("")
  const [repairs, setRepairs] = useState("")
  const [price, setPrice] = useState("")
  const [saved, setSaved] = useState(false)
  const mechanic = mockMechanics[0]
  const issueLabel = issueCategories.find((i) => i.id === issue)?.label

  // simulate searching -> tracking
  useEffect(() => {
    if (phase !== "searching") return
    const t = setTimeout(() => {
      setPhase("tracking")
      setStep(1)
      setEta(12)
    }, 2400)
    return () => clearTimeout(t)
  }, [phase])

  // ETA countdown during tracking
  useEffect(() => {
    if (phase !== "tracking" || step >= 3) return
    const t = setInterval(() => setEta((e) => (e > 1 ? e - 1 : 1)), 1500)
    return () => clearInterval(t)
  }, [phase, step])

  const advance = () => {
    setStep((s) => {
      const next = Math.min(s + 1, timeline.length - 1)
      if (next >= 3) setEta(0)
      if (next === timeline.length - 1) setCompleted(true)
      return next
    })
  }

  const reset = () => {
    setPhase("select")
    setIssue(null)
    setStep(1)
    setEta(12)
    setCompleted(false)
    setDamageDesc("")
    setRepairs("")
    setPrice("")
    setSaved(false)
  }

  const vehicleName = vehicles[0]?.name ?? "Vehicle"

  const handleSave = () => {
    if (!issue) return
    const now = new Date()
    addEmergencyCall({
      vehicleName,
      issue: issueLabel ?? "Emergency",
      damageDescription:
        damageDesc.trim() ||
        "Chi tiết hư hại chưa được ghi nhận. Vui lòng bổ sung sau.",
      repairs:
        repairs.trim() ||
        "Thợ đã hỗ trợ khắc phục sự cố tại chỗ và đảm bảo xe vận hành tạm ổn.",
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      mechanicName: mechanic.name,
      price: Number(price) > 0 ? Number(price) : 250000,
      status: "completed",
    })
    setSaved(true)
  }

  if (phase === "searching") {
    return (
      <div>
        <AppHeader title="Emergency Rescue" variant="navy" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="relative flex size-28 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/30" />
            <span className="absolute inset-3 animate-pulse rounded-full bg-destructive/20" />
            <span className="relative flex size-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              <Loader2 className="size-9 animate-spin" />
            </span>
          </div>
          <div>
            <h2 className="text-lg font-bold">Finding nearby mechanics…</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Matching you with the closest available rider for{" "}
              <span className="font-semibold">{issueLabel}</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (phase === "tracking") {
    return (
      <div>
        <AppHeader
          title="Mechanic Tracking"
          subtitle={issueLabel}
          onBack={reset}
        />
        <div className="space-y-4 px-5 pb-28 pt-4">
          {/* Map placeholder */}
          <Card className="relative h-44 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/city-street-map-with-route-line-navigation.jpg"
              alt="Live map showing mechanic location"
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-[var(--navy)]/10" />
            <div className="absolute left-3 top-3">
              <Badge className="bg-card/90 text-foreground shadow">
                <Navigation className="size-3 text-primary" /> Live tracking
              </Badge>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-2xl bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <span className="text-sm font-semibold">
                  {step >= 3 ? "Arrived" : `ETA ${eta} min`}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">2.4 km away</span>
            </div>
          </Card>

          <MechanicCard mechanic={mechanic} />

          {/* Status timeline */}
          <Card className="p-4">
            <h3 className="mb-3 font-bold">Service Status</h3>
            <ol className="space-y-0">
              {timeline.map((label, i) => {
                const done = i < step
                const active = i === step
                const last = i === timeline.length - 1
                return (
                  <li key={label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full border-2 text-xs transition-colors",
                          done &&
                            "border-[var(--green)] bg-[var(--green)] text-white",
                          active &&
                            "border-primary bg-primary text-primary-foreground",
                          !done && !active &&
                            "border-border bg-card text-muted-foreground",
                        )}
                      >
                        {done ? <Check className="size-3.5" /> : i + 1}
                      </span>
                      {!last && (
                        <span
                          className={cn(
                            "my-0.5 w-0.5 flex-1",
                            done ? "bg-[var(--green)]" : "bg-border",
                          )}
                          style={{ minHeight: 28 }}
                        />
                      )}
                    </div>
                    <div className="pb-4">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          active && "text-primary",
                          !done && !active && "text-muted-foreground",
                        )}
                      >
                        {label}
                      </p>
                      {active && (
                        <p className="text-xs text-muted-foreground">
                          In progress…
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>

            {step < timeline.length - 1 ? (
              <ActionButton fullWidth onClick={advance} className="mt-1">
                Simulate next step
              </ActionButton>
            ) : (
              <div className="mt-1 space-y-3">
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--green)]/10 py-3 text-sm font-semibold text-[var(--green)] dark:text-[var(--mint)]">
                  <Check className="size-4" /> Service completed successfully
                </div>

                {saved ? (
                  <div className="rounded-2xl border border-[var(--green)]/30 bg-[var(--green)]/5 p-4 text-center">
                    <p className="text-sm font-semibold text-[var(--green)] dark:text-[var(--mint)]">
                      Saved to Emergency History
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bạn có thể xem lại trong tab Schedule → Emergency History.
                    </p>
                  </div>
                ) : (
                  <Card className="space-y-3 p-4">
                    <p className="text-sm font-semibold">Service summary</p>
                    <Field label="Mô tả hư hại">
                      <textarea
                        rows={3}
                        value={damageDesc}
                        onChange={(e) => setDamageDesc(e.target.value)}
                        placeholder="Ví dụ: Lốp trước bị đâm đinh, xẹp hoàn toàn..."
                        className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </Field>
                    <Field label="Nội dung đã sửa chữa">
                      <textarea
                        rows={3}
                        value={repairs}
                        onChange={(e) => setRepairs(e.target.value)}
                        placeholder="Ví dụ: Thay lốp mới, cân bằng bánh trước..."
                        className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </Field>
                    <Field label="Chi phí (VND)">
                      <TextInput
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="250000"
                      />
                    </Field>
                    <ActionButton fullWidth onClick={handleSave}>
                      <Save className="size-4" /> Save to Emergency History
                    </ActionButton>
                  </Card>
                )}

                <ActionButton fullWidth variant="outline" onClick={reset}>
                  <RotateCcw className="size-4" /> New request
                </ActionButton>
              </div>
            )}
          </Card>

          <ActionButton fullWidth variant="secondary">
            <PhoneCall className="size-4" /> Call emergency hotline
          </ActionButton>

          <AiChatbox />
        </div>
      </div>
    )
  }

  // select phase
  return (
    <div>
      <AppHeader title="Emergency Rescue" variant="navy" />
      <div className="space-y-5 px-5 pb-28 pt-4">
        {/* SOS hero */}
        <Card className="overflow-hidden border-0 bg-destructive text-destructive-foreground">
          <div className="flex items-center gap-4 p-5">
            <div className="relative flex size-16 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
              <span className="relative flex size-14 items-center justify-center rounded-full bg-white/15">
                <Siren className="size-7" />
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold">Need help right now?</h2>
              <p className="text-sm text-white/85">
                Pick an issue below and we'll dispatch the nearest mechanic.
              </p>
            </div>
          </div>
        </Card>

        {/* Issue categories */}
        <div>
          <h3 className="mb-3 font-bold">What's the problem?</h3>
          <div className="grid grid-cols-2 gap-3">
            {issueCategories.map((cat) => {
              const Icon = iconMap[cat.icon as keyof typeof iconMap]
              const selected = issue === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setIssue(cat.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.97]",
                    selected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold leading-tight">
                    {cat.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Location card */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </span>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Your location</p>
              <p className="text-sm font-semibold">
                124 Nguyen Van Cu, District 5, HCMC
              </p>
            </div>
            <button className="text-sm font-semibold text-primary">Change</button>
          </div>
        </Card>

        {/* ETA estimate card */}
        <Card className="flex items-center justify-between bg-[var(--navy)] p-4 text-white">
          <div className="flex items-center gap-3">
            <Clock className="size-5 text-[var(--mint)]" />
            <div>
              <p className="text-xs text-white/70">Estimated arrival</p>
              <p className="font-bold">8–14 minutes</p>
            </div>
          </div>
          <Badge className="bg-white/15 text-white">
            {mockMechanics.length} nearby
          </Badge>
        </Card>

        <ActionButton
          fullWidth
          variant="destructive"
          disabled={!issue}
          onClick={() => setPhase("searching")}
          className="py-4 text-base"
        >
          <Siren className="size-5" /> Request Assistance
        </ActionButton>

        <AiChatbox />
      </div>
    </div>
  )
}
