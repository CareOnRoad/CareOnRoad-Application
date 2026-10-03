import { randomUUID } from "node:crypto";

import { normalizeErrorCode } from "@/features/notifications/notification.service";
import type { OutboxEvent } from "@/server/repositories/contracts/outbox.repository";
import type { FoundationRepositories } from "@/server/repositories/contracts/unit-of-work";

export type OutboxDeliveryResult = {
  notificationStatus: "sent" | "failed" | "canceled";
  errorCode?: string;
};

export type OutboxDeliveryHandler = (
  event: OutboxEvent
) => Promise<OutboxDeliveryResult | void>;

export type OutboxConsumerDependencies = {
  handlers?: Readonly<Record<string, OutboxDeliveryHandler>>;
  defaultHandler?: OutboxDeliveryHandler;
};

// These events preserve domain history; their notifications are persisted in the source transaction.
export const domainOnlyTopics = new Set([
  "user.profile.bootstrapped", "user.device.registered", "user.device.push_token.registered",
  "user.device.push_token.rotated", "user.device.push_token.revoked", "user.device.push_token.invalidated",
  "motorcycle.created", "motorcycle.updated", "motorcycle.archived",
  "mechanic.profile.updated", "mechanic.location.updated", "mechanic.availability.updated",
  "service_request.created", "service_request.canceled", "service_request.media_added", "service_request.media_uploaded", "service_request.appointment_updated",
  "dispatch.round.started", "dispatch.round.expired", "dispatch.candidate.rejected", "dispatch.candidate.expired", "dispatch.request.manual_escalated",
  "admin.delivery.notifications.retry", "admin.delivery.notifications.cancel", "admin.delivery.outbox.retry", "admin.delivery.outbox.abandon",
  "admin.supervision.diagnosis_revision", "admin.supervision.quote_revision", "admin.supervision.void", "admin.supervision.expire", "admin.supervision.dispute",
  "admin.assignment.manual_assign", "admin.assignment.reassign", "admin.assignment.cancel", "admin.assignment.note", "admin.assignment.resolve_stuck",
  "admin.dispatch.retry", "admin.dispatch.cancel", "admin.dispatch.expire",
  "assignment.accepted", "assignment.status_changed", "assignment.payment_verified", "assignment.eta_updated",
  "assignment.media_added", "assignment.media_uploaded", "assignment.completion_checklist_submitted",
  "mechanic_diagnosis.created", "mechanic_diagnosis.revised",
  "quote.created", "quote.approved", "quote.rejected",
  "payment.created", "payment.pending", "payment.canceled", "payment.failed", "payment.succeeded", "payment.needs_review", "payment.review.resolved",
  "reminder.rule.created", "reminder.rule.updated", "reminder.rule.snoozed", "reminder.rule.disabled",
  "admin.reminder.enable", "admin.reminder.disable", "admin.reminder.retry",
  "admin.configuration.dispatch",
  "reminder.job.generated", "reminder.job.sent", "review.created",
  "chatbot.session.created", "chatbot.session.claimed", "chatbot.message.persisted", "chatbot.diagnosis.persisted",
  "admin.user.suspended", "admin.user.reactivated", "admin.user.archived", "admin.device.revoked", "admin.user.role.granted", "admin.user.role.revoked",
  "admin.mechanic.approved", "admin.mechanic.rejected", "admin.mechanic.suspended", "admin.mechanic.banned",
  "admin.mechanic.reactivated", "admin.mechanic.skills_updated", "admin.mechanic.radius_updated", "admin.mechanic.forced_unavailable",
  "admin.service_request.canceled", "admin.service_request.manual_escalated", "admin.service_request.note_added", "admin.service_request.cancellation_repaired", "admin.service_request.reservation_repaired"
]);

export async function deliverOutboxEvent(
  event: OutboxEvent,
  dependencies: OutboxConsumerDependencies = {}
): Promise<OutboxDeliveryResult | void> {
  const handler = dependencies.handlers?.[event.topic] ?? dependencies.defaultHandler;
  if (!handler && !domainOnlyTopics.has(event.topic)) {
    throw new OutboxHandlerNotConfiguredError();
  }
  return handler?.(event);
}

export async function applyOutboxDeliverySuccess(input: {
  event: OutboxEvent;
  repositories: FoundationRepositories;
  processedAt: Date;
  deliveryResult?: OutboxDeliveryResult | void;
  createId?: () => string;
}): Promise<void> {
  if (!isNotificationCreation(input.event)) {
    return;
  }
  if (input.deliveryResult?.notificationStatus === "canceled" || (await input.repositories.notifications.findById(input.event.aggregateId))?.status === "canceled") return;
  const failed = input.deliveryResult?.notificationStatus === "failed";
  const errorCode = failed
    ? normalizeErrorCode(input.deliveryResult?.errorCode ?? "DELIVERY_FAILED")
    : undefined;
  if (failed) {
    await input.repositories.notifications.markFailed(
      input.event.aggregateId,
      errorCode ?? "DELIVERY_FAILED"
    );
  } else {
    await input.repositories.notifications.markSent(input.event.aggregateId, input.processedAt);
  }
  await appendDeliveryAudit({
    event: input.event,
    repositories: input.repositories,
    status: failed ? "failed" : "sent",
    ...(errorCode ? { errorCode } : {}),
    now: input.processedAt,
    createId: input.createId ?? randomUUID
  });
}

class OutboxHandlerNotConfiguredError extends Error {
  readonly errorCode = "OUTBOX_HANDLER_NOT_CONFIGURED";

  constructor() {
    super("An outbox delivery handler is not configured.");
  }
}

export async function applyOutboxDeliveryFailure(input: {
  event: OutboxEvent;
  repositories: FoundationRepositories;
  failedAt: Date;
  errorCode: string;
  createId?: () => string;
}): Promise<void> {
  if (!isNotificationCreation(input.event)) {
    return;
  }
  if ((await input.repositories.notifications.findById(input.event.aggregateId))?.status === "canceled") return;
  const errorCode = normalizeErrorCode(input.errorCode);
  await input.repositories.notifications.markFailed(input.event.aggregateId, errorCode);
  await appendDeliveryAudit({
    event: input.event,
    repositories: input.repositories,
    status: "failed",
    errorCode,
    now: input.failedAt,
    createId: input.createId ?? randomUUID
  });
}

function isNotificationCreation(event: OutboxEvent): boolean {
  return event.topic === "notification.created" && event.aggregateType === "notification";
}

async function appendDeliveryAudit(input: {
  event: OutboxEvent;
  repositories: FoundationRepositories;
  status: "sent" | "failed";
  errorCode?: string;
  now: Date;
  createId: () => string;
}): Promise<void> {
  await input.repositories.audit.append({
    id: input.createId(),
    action: `notification.${input.status}`,
    entityType: "notification",
    entityId: input.event.aggregateId,
    requestId: input.event.id,
    metadata: {
      resource_id: input.event.aggregateId,
      status: input.status,
      attempt_count: input.event.attemptCount,
      ...(input.errorCode ? { error_code: input.errorCode } : {})
    },
    createdAt: input.now
  });
}
