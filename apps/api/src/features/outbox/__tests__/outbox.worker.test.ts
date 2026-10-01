import { describe, expect, it } from "vitest";

import type { Notification } from "@/server/repositories/contracts/notification.repository";
import type { OutboxEvent } from "@/server/repositories/contracts/outbox.repository";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { OutboxWorker, calculateBackoffMs } from "@/server/workers/outbox.worker";

const now = new Date("2026-06-30T03:00:00.000Z");
const notificationId = "22222222-2222-4222-8222-222222222222";

describe("OutboxWorker", () => {
  it("does not overwrite a completed event after its lease has been reclaimed", async () => {
    const uow = createUnitOfWork();
    let time = now;
    let started!: () => void; let release!: () => void;
    const entered = new Promise<void>((resolve) => { started = resolve; });
    const paused = new Promise<void>((resolve) => { release = resolve; });
    const running = new OutboxWorker(uow, { now: () => time, workerId: "same-header", consumers: { handlers: {
      "notification.created": async () => { started(); await paused; }
    } } }).processBatch();
    await entered;
    time = new Date(now.getTime() + 61_000);
    const recovered = await new OutboxWorker(uow, { now: () => time, workerId: "same-header", consumers: { handlers: {
      "notification.created": async () => undefined
    } } }).processBatch();
    expect(recovered.processed).toBe(1);
    release();
    expect(await running).toMatchObject({ processed: 0, leaseLost: 1, retried: 0 });
    expect(uow.snapshot().outboxEvents[0]).toMatchObject({ status: "processed", attemptCount: 2 });
    expect(uow.snapshot().auditLogs).toHaveLength(1);
  });

  it("honors Retry-After and does not acknowledge an unknown topic", async () => {
    const retryAfter = new Date(now.getTime() + 90_000);
    const uow = createUnitOfWork();
    const worker = new OutboxWorker(uow, { now: () => now, consumers: { handlers: {
      "notification.created": async () => { throw Object.assign(new Error("retry"), { errorCode: "FCM_THROTTLED", retryAfter }); }
    } } });
    await worker.processBatch();
    expect(uow.snapshot().outboxEvents[0]?.nextAttemptAt).toEqual(retryAfter);
    const unknown = createUnitOfWork({ outboxEvents: [outboxEvent({ topic: "new.action.requires_delivery", aggregateType: "new" })] });
    expect(await new OutboxWorker(unknown, { now: () => now }).processBatch()).toMatchObject({ processed: 0, retried: 1 });
    expect(unknown.snapshot().outboxEvents[0]?.lastErrorCode).toBe("OUTBOX_HANDLER_NOT_CONFIGURED");
  });

  it("leases and processes an event, marks notification sent, audits, and emits no recursive event", async () => {
    const delivered: string[] = [];
    const unitOfWork = createUnitOfWork();
    const worker = new OutboxWorker(unitOfWork, {
      now: () => now,
      workerId: "worker-a",
      createId: () => "audit-sent",
      consumers: {
        handlers: {
          "notification.created": async (event) => {
            delivered.push(event.dedupeKey);
          }
        }
      }
    });

    await expect(worker.processBatch()).resolves.toEqual({
      claimed: 1,
      processed: 1,
      retried: 0,
      deadLettered: 0
    });
    expect(delivered).toEqual(["notification.created:business-1"]);
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.outboxEvents[0]).toMatchObject({
      status: "processed",
      attemptCount: 1,
      processedAt: now
    });
    expect(snapshot.notifications[0]).toMatchObject({ status: "sent", sentAt: now });
    expect(snapshot.auditLogs).toMatchObject([{ action: "notification.sent" }]);
  });

  it("retries with exponential backoff and records failed notification audit without recursion", async () => {
    const unitOfWork = createUnitOfWork();
    const worker = failingWorker(unitOfWork, { maxAttempts: 5 });

    await expect(worker.processBatch()).resolves.toMatchObject({ claimed: 1, retried: 1 });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.outboxEvents[0]).toMatchObject({
      status: "pending",
      attemptCount: 1,
      nextAttemptAt: new Date(now.getTime() + 2_000),
      lastErrorCode: "TEMPORARY_PROVIDER_FAILURE"
    });
    expect(snapshot.notifications[0]).toMatchObject({
      status: "failed",
      lastErrorCode: "TEMPORARY_PROVIDER_FAILURE"
    });
    expect(snapshot.auditLogs).toMatchObject([{ action: "notification.failed" }]);
    expect(calculateBackoffMs(4, 2_000)).toBe(16_000);
  });

  it("does not treat a missing notification handler as successful delivery", async () => {
    const unitOfWork = createUnitOfWork();
    await expect(
      new OutboxWorker(unitOfWork, {
        now: () => now,
        workerId: "worker-no-handler"
      }).processBatch()
    ).resolves.toMatchObject({ claimed: 1, processed: 0, retried: 1 });
    expect(unitOfWork.snapshot().notifications[0]).toMatchObject({
      status: "failed",
      lastErrorCode: "OUTBOX_HANDLER_NOT_CONFIGURED"
    });
  });

  it("requires and invokes a configured assignment recovery handoff", async () => {
    const event = outboxEvent({
      id: "recovery-event",
      topic: "assignment.recovery.requested",
      aggregateType: "assignment",
      aggregateId: "assignment-1",
      dedupeKey: "assignment.recovery.requested:assignment-1",
      payload: { request_id: "request-1" }
    });
    const missingHandlerUnit = createUnitOfWork({ outboxEvents: [event] });
    await expect(new OutboxWorker(missingHandlerUnit, {
      now: () => now,
      workerId: "worker-recovery-missing"
    }).processBatch()).resolves.toMatchObject({ processed: 0, retried: 1 });

    const delivered: string[] = [];
    const configuredUnit = createUnitOfWork({ outboxEvents: [event] });
    await expect(new OutboxWorker(configuredUnit, {
      now: () => now,
      workerId: "worker-recovery",
      consumers: { handlers: {
        "assignment.recovery.requested": async (claimed) => {
          delivered.push(String(claimed.payload.request_id));
        }
      } }
    }).processBatch()).resolves.toMatchObject({ processed: 1, retried: 0 });
    expect(delivered).toEqual(["request-1"]);
  });

  it("processes a terminal all-device failure without marking the notification sent", async () => {
    const unitOfWork = createUnitOfWork();
    const result = await new OutboxWorker(unitOfWork, {
      now: () => now,
      workerId: "worker-terminal-failure",
      consumers: {
        handlers: {
          "notification.created": async () => ({
            notificationStatus: "failed" as const,
            errorCode: "NO_ACTIVE_DEVICE"
          })
        }
      }
    }).processBatch();
    expect(result).toMatchObject({ processed: 1, retried: 0 });
    expect(unitOfWork.snapshot().notifications[0]).toMatchObject({
      status: "failed",
      lastErrorCode: "NO_ACTIVE_DEVICE"
    });
  });

  it("recovers an expired processing lease after a crash", async () => {
    const event = outboxEvent({
      status: "processing",
      attemptCount: 1,
      leaseOwner: "crashed-worker",
      leaseExpiresAt: new Date(now.getTime() - 1)
    });
    const unitOfWork = createUnitOfWork({ outboxEvents: [event] });

    await expect(
      new OutboxWorker(unitOfWork, {
        now: () => now,
        workerId: "recovery-worker",
        createId: () => "audit-recovered",
        consumers: { handlers: { "notification.created": async () => undefined } }
      }).processBatch()
    ).resolves.toMatchObject({ claimed: 1, processed: 1 });
    expect(unitOfWork.snapshot().outboxEvents[0]).toMatchObject({
      status: "processed",
      attemptCount: 2
    });
  });

  it("dead-letters the final failed attempt", async () => {
    const unitOfWork = createUnitOfWork({
      outboxEvents: [outboxEvent({ attemptCount: 2 })]
    });
    await expect(failingWorker(unitOfWork, { maxAttempts: 3 }).processBatch()).resolves.toEqual({
      claimed: 1,
      processed: 0,
      retried: 0,
      deadLettered: 1
    });
    expect(unitOfWork.snapshot().outboxEvents[0]).toMatchObject({
      status: "dead_letter",
      attemptCount: 3
    });
  });
});

function failingWorker(
  unitOfWork: InMemoryUnitOfWork,
  options: { maxAttempts: number }
) {
  return new OutboxWorker(unitOfWork, {
    now: () => now,
    workerId: "worker-fail",
    maxAttempts: options.maxAttempts,
    backoffMs: 2_000,
    createId: () => `audit-${unitOfWork.snapshot().auditLogs.length + 1}`,
    consumers: {
      handlers: {
        "notification.created": async () => {
          const error = new Error("sensitive provider message") as Error & {
            errorCode: string;
          };
          error.errorCode = "temporary-provider-failure";
          throw error;
        }
      }
    }
  });
}

function createUnitOfWork(
  overrides: Partial<ConstructorParameters<typeof InMemoryUnitOfWork>[0]> = {}
) {
  return new InMemoryUnitOfWork({
    notifications: [notification()],
    outboxEvents: [outboxEvent()],
    ...overrides
  });
}

function notification(): Notification {
  return {
    id: notificationId,
    userId: "11111111-1111-4111-8111-111111111111",
    type: "reminder_due",
    title: "Bao duong",
    body: "Mo ung dung.",
    data: {},
    dedupeKey: "business-1",
    status: "pending",
    createdAt: now
  };
}

function outboxEvent(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    topic: "notification.created",
    aggregateType: "notification",
    aggregateId: notificationId,
    dedupeKey: "notification.created:business-1",
    payload: { resource_id: notificationId },
    status: "pending",
    attemptCount: 0,
    nextAttemptAt: now,
    createdAt: now,
    ...overrides
  };
}
