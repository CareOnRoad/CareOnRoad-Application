import { createHash } from "node:crypto";
// Operational investigation thresholds, not automatic cancellation/payment policy.
export const ASSIGNMENT_STALE_MINUTES = { accepted: 30, en_route: 60, on_site: 45, diagnosis: 45, quoted: 60, awaiting_payment: 60, in_progress: 180 } as const;
export const APPOINTMENT_GRACE_MINUTES = 15;
export const REMINDER_FAILURE_THRESHOLD = 3;
export const WORKER_STALE_MINUTES = 15;
export const COMMITMENT_STALE_MINUTES = 60;
export const stuckCategories = ["dispatch_overdue", "dispatch_attention", "assignment_stalled", "state_divergence", "outbox_dead_letter", "reminder_failures", "quote_pending", "payment_pending", "worker_missing_progress"] as const;
export type StuckCategory = typeof stuckCategories[number];
export function findingId(category: string, target: string) {
  const hex = createHash("md5").update(`${category}:${target}`).digest("hex");
  const id = `${hex.slice(0,12)}3${hex.slice(13,16)}8${hex.slice(17)}`;
  return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`;
}
