import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { CancellationConflict } from "@/features/assignments/assignment-cancellation";
import { domainOnlyTopics } from "@/features/outbox/outbox-consumers";
import { listQuerySchema, toPage } from "@/lib/list-pagination";
import type { Notification } from "@/server/repositories/contracts/notification.repository";
import type { OutboxEvent } from "@/server/repositories/contracts/outbox.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { loadActiveAdminActor } from "./admin.authorization";
import { adminReasonSchema, adminUuidSchema } from "./admin.schemas";
import { prepareAdminCommand, recordAdminAction } from "./admin-command";
import { AdminRouteError } from "./admin-route-helpers";

const pageSchema = listQuerySchema.omit({ date_from: true, date_to: true });
const dates = { from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional() };
const notificationQuery = pageSchema.extend({ ...dates, status: z.enum(["pending", "sent", "failed", "canceled"]).optional(), user_id: z.string().uuid().optional() });
const outboxQuery = pageSchema.extend({ ...dates, status: z.enum(["pending", "processing", "processed", "dead_letter", "abandoned"]).optional(), topic: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_.-]+$/).optional() });
export type DeliveryKind = "notifications" | "outbox";
export type DeliveryAction = "retry" | "cancel" | "abandon";

export class AdminDeliveryService {
  constructor(private readonly unitOfWork: UnitOfWork, private readonly options: { now?: () => Date; createId?: () => string } = {}) {}
  async read(identity: VerifiedSupabaseIdentity, kind: DeliveryKind, view: "list" | "detail" | "summary" | "health" | "dead_letter", input: unknown = {}, id?: string) {
    const schema = view === "summary" ? z.object(dates).strict() : view === "health" || view === "detail" ? pageSchema : kind === "notifications" ? notificationQuery : outboxQuery;
    const parsed = schema.safeParse(input);
    if (!parsed.success || (view === "detail" && !adminUuidSchema.safeParse(id).success)) throw new AdminRouteError("INVALID_INPUT", "Delivery query is invalid.", 400);
    const now = this.options.now?.() ?? new Date();
    const window = boundedWindow(parsed.data as { from?: string; to?: string }, now);
    return this.unitOfWork.execute(async (repositories) => {
      await loadActiveAdminActor(identity, repositories.users);
      if (view === "summary") return { from: window.date_from, to: window.date_to, counts: await repositories.notifications.summary({ from: new Date(window.date_from), to: new Date(window.date_to) }) };
      const query = parsed.data as z.infer<typeof outboxQuery> & { user_id?: string };
      if (view === "health") {
        const rows = await repositories.operationalMonitoring.listWorkerRuns({ limit: query.limit + 1, cursor: query.cursor ? { createdAt: query.cursor.timestamp, id: query.cursor.id } : undefined });
        return { source: "operational_worker_runs", ...toPage(rows.map(row => ({ ...row, createdAt: row.completedAt })), query.limit, (row) => ({ id: row.id, worker_name: row.workerName, status: row.status,
          items_claimed: row.itemsClaimed, items_succeeded: row.itemsSucceeded, items_failed: row.itemsFailed, error_code: safeDeliveryError(row.errorCode),
          started_at: row.startedAt.toISOString(), completed_at: row.completedAt.toISOString() })) };
      }
      if (view === "detail") {
        if (kind === "outbox") {
          const event = await repositories.outbox.findById(id!); if (!event) throw notFound();
          return safeOutbox(event, now);
        }
        const notification = await repositories.notifications.findById(id!); if (!notification) throw notFound();
        const receipts = await repositories.notificationDeliveries.listPage(id!, query.limit, query.cursor);
        return { ...safeNotification(notification), delivery_receipts: toPage(receipts, query.limit, (row) => ({ id: row.id, status: row.status, provider: row.provider,
          attempt_count: row.attemptCount, active_lease: Boolean(row.leaseExpiresAt && row.leaseExpiresAt > now), error_code: safeDeliveryError(row.lastErrorCode),
          created_at: row.createdAt.toISOString(), completed_at: row.completedAt?.toISOString(), next_attempt_at: row.nextAttemptAt?.toISOString() })) };
      }
      if (kind === "notifications") return toPage(await repositories.notifications.listAdmin({ ...query, ...window, userId: query.user_id }), query.limit, safeNotification);
      return toPage(await repositories.outbox.listAdmin({ ...query, ...window, ...(view === "dead_letter" ? { status: "dead_letter" } : {}) }), query.limit, (row) => safeOutbox(row, now));
    });
  }

  async command(identity: VerifiedSupabaseIdentity, kind: DeliveryKind, id: string, action: DeliveryAction, input: unknown, key: string) {
    if (!adminUuidSchema.safeParse(id).success || !adminReasonSchema.safeParse(input).success ||
      (kind === "notifications" && action === "abandon") || (kind === "outbox" && action === "cancel")) throw new AdminRouteError("INVALID_INPUT", "Delivery command is invalid.", 400);
    const body = adminReasonSchema.parse(input); const now = this.options.now?.() ?? new Date(); const createId = this.options.createId ?? randomUUID;
    return this.unitOfWork.execute(async (repositories) => {
      let actor = await loadActiveAdminActor(identity, repositories.users);
      let event: OutboxEvent | undefined; let notificationId: string | undefined;
      if (kind === "outbox") {
        event = await repositories.outbox.findByIdForUpdate(id); if (!event) throw notFound();
        if (event.topic === "notification.created" && event.aggregateType === "notification") notificationId = event.aggregateId;
      } else {
        const snapshot = await repositories.notifications.findById(id); if (!snapshot) throw notFound(); notificationId = snapshot.id;
        const source = await repositories.outbox.findByDedupeKey(`notification.created:${snapshot.dedupeKey}`);
        if (source) event = await repositories.outbox.findByIdForUpdate(source.id);
      }
      const notification = notificationId ? await repositories.notifications.findByIdForUpdate(notificationId) : undefined;
      actor = await loadActiveAdminActor(identity, repositories.users);
      const scope = `admin.delivery.${kind}.${action}:${id}`;
      const replay = await prepareAdminCommand(repositories, actor.id, scope, key, body, now, createId);
      if (replay) return replay;
      if (event?.leaseExpiresAt && event.leaseExpiresAt > now) throw new CancellationConflict("worker_lease_active");
      let response;
      if (notificationId) {
        if (!notification) throw notFound();
        const updated = await recoverNotification(repositories, notification, event, action === "retry" ? "retry" : "cancel", actor.id, body.reason, now);
        response = safeNotification(updated);
      } else {
        if (!event) throw notFound();
        if (action === "retry") {
          if (event.status !== "dead_letter") throw new CancellationConflict("outbox_not_dead_letter");
          if (!domainOnlyTopics.has(event.topic) && event.topic !== "assignment.recovery.requested") throw new CancellationConflict("topic_retry_unsupported");
        } else if (!domainOnlyTopics.has(event.topic)) throw new CancellationConflict("critical_handoff_cannot_abandon");
        const updated = await repositories.outbox.recover({ id: event.id, action: action === "retry" ? "retry" : "abandon", actorId: actor.id, reason: body.reason, now });
        if (!updated) throw new CancellationConflict("delivery_state_or_retry_limit");
        response = safeOutbox(updated, now);
      }
      await recordAdminAction(repositories, { actorId: actor.id, action: `admin.delivery.${kind}.${action}`, entityType: kind === "outbox" ? "outbox_event" : "notification",
        entityId: id, reason: body.reason, now, createId, metadata: { resource_id: id, change: action } });
      await repositories.idempotency.complete({ actorId: actor.id, scope, idempotencyKey: key, responseStatus: action === "retry" ? 202 : 200,
        responseBody: response, resourceType: kind, resourceId: id, completedAt: now });
      return response;
    });
  }
}

export async function recoverNotification(repositories: FoundationRepositories, notification: Notification, event: OutboxEvent | undefined, action: "retry" | "cancel", actorId: string, reason: string, now: Date) {
  if (event && (event.topic !== "notification.created" || event.aggregateType !== "notification" || event.aggregateId !== notification.id)) throw new CancellationConflict("delivery_source_mismatch");
  if (["sent", "canceled"].includes(notification.status)) throw new CancellationConflict("notification_terminal");
  const receipts = await repositories.notificationDeliveries.listByNotificationIdForUpdate(notification.id);
  // ponytail: cap admin commands at 100 device receipts; use SQL bulk eligibility if fan-out grows.
  if (receipts.length > 100) throw new CancellationConflict("delivery_receipt_limit");
  if (receipts.some((row) => row.leaseExpiresAt && row.leaseExpiresAt > now)) throw new CancellationConflict("delivery_lease_active");
  if (action === "retry") {
    if (notification.status !== "failed" || !event || !["dead_letter", "processed"].includes(event.status)) throw new CancellationConflict("notification_not_retryable");
    if ((notification.adminRetryCount ?? 0) >= 3 || (event.adminRetryCount ?? 0) >= 3) throw new CancellationConflict("retry_limit_reached");
    if (receipts.some((row) => row.status === "pending")) throw new CancellationConflict("delivery_work_pending");
    const credentials = await repositories.deviceDeliveryCredentials.listActiveByUserId(notification.userId);
    if ((await repositories.users.findActorById(notification.userId))?.status !== "active") throw new CancellationConflict("notification_owner_inactive");
    const failed = receipts.filter((row) => ["retryable_failed", "permanent_failed"].includes(row.status) && credentials.some((credential) => credential.id === row.credentialId &&
      credential.credentialVersion === row.credentialVersion && credential.credentialCiphertext && credential.credentialIv && credential.credentialTag));
    if (!failed.length) throw new CancellationConflict("delivery_credential_unavailable");
    if (await repositories.notificationDeliveries.retryFailed({ ids: failed.map((row) => row.id), now }) !== failed.length) throw new CancellationConflict("delivery_state_changed");
    if (!await repositories.outbox.recover({ id: event.id, action: "retry", actorId, reason, now })) throw new CancellationConflict("delivery_state_changed");
  } else {
    if (receipts.some((row) => row.status === "sent")) throw new CancellationConflict("delivery_already_sent");
    await repositories.notificationDeliveries.cancelPending({ notificationId: notification.id, now });
    if (event && ["pending", "processing", "dead_letter"].includes(event.status) && !await repositories.outbox.recover({ id: event.id, action: "abandon", actorId, reason, now })) throw new CancellationConflict("delivery_state_changed");
  }
  const updated = await repositories.notifications.recoverDelivery({ id: notification.id, status: action === "retry" ? "pending" : "canceled", actorId, reason, now });
  if (!updated) throw new CancellationConflict("delivery_state_changed"); return updated;
}

export function boundedWindow(input: { from?: string; to?: string }, now: Date) {
  const to = input.to ? new Date(input.to) : now; const from = input.from ? new Date(input.from) : new Date(to.getTime() - 7 * 86_400_000);
  if (from > to || to.getTime() - from.getTime() > 31 * 86_400_000) throw new AdminRouteError("INVALID_INPUT", "Date window must be ordered and at most 31 days.", 400);
  return { date_from: from.toISOString(), date_to: to.toISOString() };
}
export function safeDeliveryError(value?: string) { return value && /^[A-Z][A-Z0-9_]{0,99}$/.test(value) ? value : value ? "OPERATION_FAILED" : undefined; }
function safeNotification(row: Notification) { return { id: row.id, user_id: row.userId, type: row.type, status: row.status, is_read: Boolean(row.readAt), created_at: row.createdAt.toISOString(),
  sent_at: row.sentAt?.toISOString(), canceled_at: row.canceledAt?.toISOString(), admin_retry_count: row.adminRetryCount ?? 0, error_code: safeDeliveryError(row.lastErrorCode) }; }
function safeOutbox(row: OutboxEvent, now: Date) { const leased = Boolean(row.leaseExpiresAt && row.leaseExpiresAt > now); return { id: row.id, topic: row.topic, aggregate_type: row.aggregateType,
  aggregate_id: row.aggregateId, status: row.status, attempt_count: row.attemptCount, admin_retry_count: row.adminRetryCount ?? 0, active_lease: leased,
  next_attempt_at: row.nextAttemptAt.toISOString(), created_at: row.createdAt.toISOString(), processed_at: row.processedAt?.toISOString(), abandoned_at: row.abandonedAt?.toISOString(), error_code: safeDeliveryError(row.lastErrorCode),
  next_action_codes: leased ? [] : [...(row.status === "dead_letter" && (row.adminRetryCount ?? 0) < 3 && (domainOnlyTopics.has(row.topic) || row.topic === "assignment.recovery.requested") ? ["retry"] : []),
    ...(["pending", "dead_letter", "processing"].includes(row.status) && domainOnlyTopics.has(row.topic) ? ["abandon"] : [])] }; }
function notFound() { return Object.assign(new Error("Delivery record not found."), { errorCode: "NOT_FOUND", status: 404 }); }
