import { randomUUID } from "node:crypto";

import { normalizeErrorCode } from "@/features/notifications/notification.service";
import type { OutboxEvent } from "@/server/repositories/contracts/outbox.repository";
import type { FoundationRepositories } from "@/server/repositories/contracts/unit-of-work";

export type OutboxDeliveryResult = {
  notificationStatus: "sent" | "failed";
  errorCode?: string;
};

export type OutboxDeliveryHandler = (
  event: OutboxEvent
) => Promise<OutboxDeliveryResult | void>;

export type OutboxConsumerDependencies = {
  handlers?: Readonly<Record<string, OutboxDeliveryHandler>>;
  defaultHandler?: OutboxDeliveryHandler;
};

export async function deliverOutboxEvent(
  event: OutboxEvent,
  dependencies: OutboxConsumerDependencies = {}
): Promise<OutboxDeliveryResult | void> {
  const handler = dependencies.handlers?.[event.topic] ?? dependencies.defaultHandler;
  if (!handler && isNotificationCreation(event)) {
    throw new OutboxHandlerNotConfiguredError();
  }
  if (!handler && event.topic === "assignment.recovery.requested") {
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
