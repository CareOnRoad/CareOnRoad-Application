import { z } from "zod";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { listQuerySchema, toPage } from "@/lib/list-pagination";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { loadActiveAdminActor } from "./admin.authorization";
import { boundedWindow } from "./admin-delivery.service";
import { stuckCategories, ASSIGNMENT_STALE_MINUTES, APPOINTMENT_GRACE_MINUTES, REMINDER_FAILURE_THRESHOLD, WORKER_STALE_MINUTES, COMMITMENT_STALE_MINUTES } from "./admin-operational-policy";
import { AdminRouteError } from "./admin-route-helpers";
const dates = { from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional() };
const summaries = z.object(dates).strict();
const findings = listQuerySchema.omit({ date_from: true, date_to: true }).extend({ ...dates, category: z.enum(stuckCategories).optional() });
export type DashboardView = "summary" | "dispatch" | "assignments" | "mechanics" | "service-requests" | "workers" | "stuck-workflows";
export class AdminDashboardService {
  constructor(private readonly unitOfWork: UnitOfWork, private readonly options: { now?: () => Date } = {}) {}
  async read(identity: VerifiedSupabaseIdentity, view: DashboardView, input: unknown = {}) {
    const parsed = (view === "stuck-workflows" ? findings : summaries).safeParse(input);
    if (!parsed.success) throw new AdminRouteError("INVALID_INPUT", "Dashboard query is invalid.", 400);
    const now = this.options.now?.() ?? new Date(), body = parsed.data;
    const dates = boundedWindow(body, now), window = { from: new Date(dates.date_from), to: new Date(dates.date_to), now };
    return this.unitOfWork.execute(async repositories => {
      await loadActiveAdminActor(identity, repositories.users);
      if (view === "stuck-workflows") {
        const page = body as z.infer<typeof findings>;
        const rows = await repositories.adminQueries.stuckWorkflows({ ...page, ...window });
        return { from: window.from.toISOString(), to: window.to.toISOString(), thresholds: { assignment_minutes: ASSIGNMENT_STALE_MINUTES, appointment_grace_minutes: APPOINTMENT_GRACE_MINUTES, reminder_failure_count: REMINDER_FAILURE_THRESHOLD, worker_minutes: WORKER_STALE_MINUTES, commitment_minutes: COMMITMENT_STALE_MINUTES },
          ...toPage(rows, page.limit, row => ({ id: row.id, target_id: row.targetId, request_id: row.requestId, assignment_id: row.assignmentId, category: row.category,
            age_seconds: Math.max(0, Math.floor((now.getTime() - row.createdAt.getTime()) / 1000)), failure_count: row.failureCount, active_lease: row.activeLease,
            next_action_codes: row.assignmentId ? ["investigate", "add_assignment_note"] : row.category === "reminder_failures" ? ["view_reminder", ...(!row.activeLease ? ["disable_reminder"] : [])] : row.requestId ? ["add_request_note", "view_dispatch"] : row.category === "outbox_dead_letter" ? ["view_outbox"] : ["view_worker_runs"],
            detected_basis_at: row.createdAt.toISOString() })) };
      }
      const groups = await repositories.adminQueries.operationalSummary(window);
      const keys = view === "summary" ? Object.keys(groups) : ({ dispatch: ["dispatch_rounds", "dispatch_candidates"], assignments: ["assignments", "assignment_slots"], mechanics: ["mechanics", "availability"], "service-requests": ["requests", "quotes", "payments"], workers: ["workers", "notifications", "outbox", "reminders", "occurrences"] } as const)[view];
      return { from: window.from.toISOString(), to: window.to.toISOString(), scope: "created_in_window", groups: Object.fromEntries(keys.map(key => [key, groups[key] ?? {}])) };
    });
  }
}
