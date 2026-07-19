"use client"

import { useEffect, useRef, useState } from "react"
import { X, AlertTriangle, ChevronDown } from "lucide-react"
import { ActionButton, Field } from "./ui"
import { cn } from "@/lib/utils"

export const CANCEL_REASONS = [
  "Tôi có việc đột xuất",
  "Tôi không còn nhu cầu",
  "Tôi muốn thay đổi lịch hẹn",
] as const

export type CancelReason = (typeof CANCEL_REASONS)[number] | "other"

export function CancelAppointmentModal({
  open,
  appointmentLabel,
  onClose,
  onConfirm,
}: {
  open: boolean
  appointmentLabel?: string
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState<string>("")
  const [customReason, setCustomReason] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setReason("")
      setCustomReason("")
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const handleConfirm = () => {
    if (reason === "other") {
      if (!customReason.trim()) {
        setError("Vui lòng nhập lý do hủy của bạn.")
        return
      }
      onConfirm(customReason.trim())
      return
    }
    if (!reason) {
      setError("Vui lòng chọn một lý do hủy.")
      return
    }
    onConfirm(reason)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 py-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80 active:scale-95"
        >
          <X className="size-4" />
        </button>

        <div className="space-y-5 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0 flex-1 pr-8">
              <h2
                id="cancel-modal-title"
                className="text-base font-bold leading-tight"
              >
                Cancel this appointment?
              </h2>
              {appointmentLabel && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {appointmentLabel}
                </p>
              )}
            </div>
          </div>

          <Field label="Lý do hủy">
            <div className="relative">
              <select
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  setError(null)
                }}
                className={cn(
                  "w-full appearance-none rounded-2xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
                  error && "border-destructive focus:border-destructive",
                )}
              >
                <option value="" disabled>
                  -- Chọn lý do --
                </option>
                {CANCEL_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="other">Khác (tự điền)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </Field>

          {reason === "other" && (
            <Field label="Nhập lý do của bạn">
              <textarea
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value)
                  setError(null)
                }}
                rows={3}
                placeholder="Ví dụ: Tôi cần đổi sang thợ khác..."
                className={cn(
                  "w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20",
                  error && "border-destructive focus:border-destructive",
                )}
              />
            </Field>
          )}

          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <ActionButton
              variant="outline"
              fullWidth
              onClick={onClose}
              className="py-3 text-sm"
            >
              Keep appointment
            </ActionButton>
            <ActionButton
              variant="destructive"
              fullWidth
              onClick={handleConfirm}
              className="py-3 text-sm"
            >
              Confirm cancel
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  )
}