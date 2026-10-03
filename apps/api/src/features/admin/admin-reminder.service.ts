import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { CancellationConflict } from "@/features/assignments/assignment-cancellation";
import { listQuerySchema, toPage } from "@/lib/list-pagination";
import type { ReminderRule, ReminderOccurrence } from "@/server/repositories/contracts/reminder.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { queueReminderNotification } from "@/server/workers/reminder.worker";
import { loadActiveAdminActor } from "./admin.authorization";
import { adminReasonSchema, adminUuidSchema } from "./admin.schemas";
import { prepareAdminCommand, recordAdminAction } from "./admin-command";
import { boundedWindow, recoverNotification } from "./admin-delivery.service";
import { AdminRouteError } from "./admin-route-helpers";

const page = listQuerySchema.omit({ date_from: true, date_to: true });
const dates = { from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional() };
const rulesQuery = page.extend({ ...dates, rider_id: z.string().uuid().optional(), enabled: z.enum(["true", "false"]).transform(value => value === "true").optional() });
const occurrencesQuery = page.extend({ ...dates, status: z.enum(["due", "queued", "sent", "dismissed", "failed"]).optional() });
const enable = adminReasonSchema.extend({ next_due_at: z.string().datetime({ offset: true }) }).strict();
export class AdminReminderService {
  constructor(private readonly unitOfWork: UnitOfWork, private readonly options: { now?: () => Date; createId?: () => string } = {}) {}
  async read(identity: VerifiedSupabaseIdentity, view: "list" | "detail" | "occurrences" | "health", input: unknown = {}, id?: string) {
    const parsed = (view === "list" ? rulesQuery : view === "occurrences" ? occurrencesQuery : page).safeParse(input);
    if (!parsed.success || (["detail", "occurrences"].includes(view) && !adminUuidSchema.safeParse(id).success)) throw new AdminRouteError("INVALID_INPUT", "Reminder query is invalid.", 400);
    const now = this.options.now?.() ?? new Date();
    return this.unitOfWork.execute(async repositories => {
      await loadActiveAdminActor(identity, repositories.users);
      const query = parsed.data as z.infer<typeof rulesQuery> & { status?: ReminderOccurrence["status"] };
      if (view === "health") {
        const rows = await repositories.operationalMonitoring.listWorkerRuns({ limit: query.limit + 1, workerName: "reminders", cursor: query.cursor ? { id: query.cursor.id, createdAt: query.cursor.timestamp } : undefined });
        return toPage(rows.map(row => ({ ...row, createdAt: row.completedAt })), query.limit, row => ({ id: row.id, status: row.status, items_claimed: row.itemsClaimed, items_succeeded: row.itemsSucceeded, items_failed: row.itemsFailed, completed_at: row.completedAt.toISOString() }));
      }
      if (view === "list") return toPage(await repositories.reminders.listRulesAdmin({ ...query, ...boundedWindow(query, now), riderId: query.rider_id }), query.limit, row => safeRule(row, now));
      const rule = await repositories.reminders.findRuleById(id!); if (!rule) throw notFound();
      if (view === "detail") return safeRule(rule, now);
      return toPage(await repositories.reminders.listOccurrencesAdmin({ ...query, ...boundedWindow(query, now), ruleId: id }), query.limit, safeOccurrence);
    });
  }
  async command(identity: VerifiedSupabaseIdentity, id: string, action: "enable" | "disable" | "retry", input: unknown, key: string) {
    const parsed = (action === "enable" ? enable : adminReasonSchema).safeParse(input);
    if (!adminUuidSchema.safeParse(id).success || !parsed.success) throw new AdminRouteError("INVALID_INPUT", "Reminder command is invalid.", 400);
    const now = this.options.now?.() ?? new Date(), createId = this.options.createId ?? randomUUID;
    const body = parsed.data as { reason: string; next_due_at?: string };
    if (action === "enable" && new Date(body.next_due_at!) <= now) throw new AdminRouteError("INVALID_INPUT", "next_due_at must be in the future.", 400);
    return this.unitOfWork.execute(async repositories => {
      let actor = await loadActiveAdminActor(identity, repositories.users);
      const occurrenceSnapshot = action === "retry" ? await repositories.reminders.findOccurrenceById(id) : undefined;
      const snapshot = await repositories.reminders.findRuleById(action === "retry" ? occurrenceSnapshot?.ruleId ?? id : id);
      if (!snapshot || (action === "retry" && !occurrenceSnapshot)) throw notFound();
      const motorcycle = await repositories.motorcycles.findByIdForUpdate(snapshot.motorcycleId);
      const rule = await repositories.reminders.findRuleByIdForUpdate(snapshot.id); if (!rule) throw notFound();
      actor = await loadActiveAdminActor(identity, repositories.users);
      const scope = `admin.reminder.${action}:${id}`;
      const replay = await prepareAdminCommand(repositories, actor.id, scope, key, body, now, createId); if (replay) return replay;
      if (action !== "disable") {
        const rider = await repositories.users.findActorById(rule.riderId);
        if (!motorcycle || motorcycle.archivedAt || motorcycle.riderId !== rule.riderId || rider?.status !== "active" || !rider.roles.includes("rider")) throw new CancellationConflict("reminder_owner_ineligible");
        if (rule.leaseExpiresAt && rule.leaseExpiresAt > now) throw new CancellationConflict("worker_lease_active");
      }
      let response;
      if (action === "retry") {
        const occurrence = await repositories.reminders.findOccurrenceByIdForUpdate(id);
        if (!occurrence || occurrence.ruleId !== rule.id || occurrence.status !== "failed") throw new CancellationConflict("occurrence_not_failed");
        if (occurrence.riderId !== rule.riderId || occurrence.motorcycleId !== rule.motorcycleId) throw new CancellationConflict("occurrence_owner_mismatch");
        if (!rule.enabled || occurrence.dueAt > now || occurrence.retryCount >= 3) throw new CancellationConflict("reminder_retry_blocked");
        if (occurrence.notificationId) {
          const existing = await repositories.notifications.findById(occurrence.notificationId); if (!existing) throw new CancellationConflict("notification_missing");
          const source = await repositories.outbox.findByDedupeKey(`notification.created:${existing.dedupeKey}`);
          const event = source ? await repositories.outbox.findByIdForUpdate(source.id) : undefined;
          if (event?.leaseExpiresAt && event.leaseExpiresAt > now) throw new CancellationConflict("worker_lease_active");
          const notification = await repositories.notifications.findByIdForUpdate(existing.id); if (!notification) throw new CancellationConflict("notification_missing");
          if (notification.userId !== rule.riderId || notification.type !== "maintenance.reminder" || notification.dedupeKey !== `maintenance.reminder:${id}` || notification.data?.reminder_id !== rule.id || notification.data?.reminder_context_id !== id) throw new CancellationConflict("notification_context_mismatch");
          await loadActiveAdminActor(identity, repositories.users);
          await recoverNotification(repositories, notification, event, "retry", actor.id, body.reason, now);
        } else {
          const queued = await queueReminderNotification(repositories, rule, occurrence.id, occurrence.dueAt, now, createId);
          if (queued.notification.status !== "pending") throw new CancellationConflict("notification_already_terminal");
          occurrence.notificationId = queued.notification.id;
        }
        const updated = await repositories.reminders.updateOccurrenceStatus({ id, status: "queued", notificationId: occurrence.notificationId, retryCount: occurrence.retryCount + 1, processedAt: now });
        if (!updated) throw notFound(); response = safeOccurrence(updated);
      } else {
        const updated = action === "disable" ? await repositories.reminders.disableRule({ id, updatedAt: now }) : await repositories.reminders.updateRule({ id, title: rule.title, intervalDays: rule.intervalDays, nextDueAt: new Date(body.next_due_at!), enabled: true, updatedAt: now });
        if (!updated) throw notFound(); response = safeRule(updated, now);
      }
      await recordAdminAction(repositories, { actorId: actor.id, action: `admin.reminder.${action}`, entityType: action === "retry" ? "reminder_occurrence" : "reminder_rule", entityId: id, reason: body.reason, now, createId, metadata: { resource_id: id } });
      await repositories.idempotency.complete({ actorId: actor.id, scope, idempotencyKey: key, responseStatus: action === "retry" ? 202 : 200, responseBody: response, resourceType: "reminder", resourceId: id, completedAt: now });
      return response;
    });
  }
}
function safeRule(row: ReminderRule, now = new Date()) { return { id: row.id, rider_id: row.riderId, motorcycle_id: row.motorcycleId, enabled: row.enabled, interval_days: row.intervalDays, next_due_at: row.nextDueAt.toISOString(), failure_count: row.failureCount, active_lease: Boolean(row.leaseExpiresAt && row.leaseExpiresAt > now), created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() }; }
function safeOccurrence(row: ReminderOccurrence) { return { id: row.id, rule_id: row.ruleId, status: row.status, notification_id: row.notificationId, retry_count: row.retryCount, due_at: row.dueAt.toISOString(), created_at: row.createdAt.toISOString(), processed_at: row.processedAt?.toISOString() }; }
function notFound() { return new AdminRouteError("NOT_FOUND", "Reminder record not found.", 404); }
