"use client"

import { useState } from "react"
import { Plus, X, Check, ClipboardList } from "lucide-react"
import { ActionButton, Field, TextInput } from "../../care/ui"
import { cn } from "@/lib/utils"
import type {
  MechanicJob,
  MechanicJobStatus,
  JobUpdatePayload,
} from "@/lib/mechanic-types"

const statusOptions: { id: MechanicJobStatus; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In progress" },
  { id: "awaiting_parts", label: "Awaiting parts" },
  { id: "completed", label: "Completed" },
]

export function JobUpdateForm({
  job,
  onSave,
  onComplete,
}: {
  job: MechanicJob
  onSave: (status: MechanicJobStatus, notes: string) => void
  onComplete: (payload: JobUpdatePayload) => void
}) {
  const [status, setStatus] = useState<MechanicJobStatus>(job.status)
  const [notes, setNotes] = useState(job.notes ?? "")
  const [price, setPrice] = useState(job.price.toString())
  const [parts, setParts] = useState<string[]>(job.partsReplaced ?? [])
  const [newPart, setNewPart] = useState("")

  const addPart = () => {
    const trimmed = newPart.trim()
    if (!trimmed) return
    setParts((prev) => [...prev, trimmed])
    setNewPart("")
  }

  const removePart = (idx: number) => {
    setParts((prev) => prev.filter((_, i) => i !== idx))
  }

  const canSave =
    status === "completed"
      ? Number(price) > 0
      : status !== job.status || notes !== (job.notes ?? "")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (status === "completed") {
      onComplete({
        price: Number(price) || 0,
        notes: notes.trim() || undefined,
        partsReplaced: parts.length > 0 ? parts : undefined,
      })
    } else {
      onSave(status, notes.trim())
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <p className="mb-2 text-sm font-semibold">Update status</p>
        <div className="grid grid-cols-2 gap-2">
          {statusOptions.map((opt) => (
            <button
              type="button"
              key={opt.id}
              onClick={() => setStatus(opt.id)}
              className={cn(
                "rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.98]",
                status === opt.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="Repair notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Describe what you did, parts you noticed, advice for customer..."
          className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </Field>

      {status === "completed" && (
        <>
          <Field label="Final price (VND)">
            <TextInput
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="180000"
            />
          </Field>

          <div>
            <p className="mb-1.5 block text-sm font-semibold text-foreground">
              Parts replaced
            </p>
            <div className="flex gap-2">
              <input
                value={newPart}
                onChange={(e) => setNewPart(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addPart()
                  }
                }}
                placeholder="e.g. Brake pads"
                className="flex-1 rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={addPart}
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-opacity active:opacity-60"
                aria-label="Add part"
              >
                <Plus className="size-5" />
              </button>
            </div>
            {parts.length > 0 && (
              <ul className="mt-3 space-y-2">
                {parts.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-sm"
                  >
                    <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{p}</span>
                    <button
                      type="button"
                      onClick={() => removePart(i)}
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background"
                      aria-label={`Remove ${p}`}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <ActionButton
        fullWidth
        type="submit"
        disabled={!canSave}
        variant={status === "completed" ? "mint" : "primary"}
      >
        <Check className="size-4" />
        {status === "completed" ? "Mark as completed" : "Save changes"}
      </ActionButton>
    </form>
  )
}
