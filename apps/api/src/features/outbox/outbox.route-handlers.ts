import { NextResponse } from "next/server";

import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { createPushTokenCipher } from "@/features/auth/push-token.crypto";
import { NotificationDeliveryService } from "@/features/notifications/notification-delivery.service";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import { createNotificationProvider } from "@/features/notifications/notification-provider.factory";
import { authenticateWorkerSecret, type WorkerAuthority } from "@/server/auth/worker-secret";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { OutboxWorker, type OutboxWorkerResult } from "@/server/workers/outbox.worker";
import { recordWorkerRun } from "@/server/workers/worker-run-recorder";

export type OutboxRouteDependencies = {
  authenticateWorker(request: Request): WorkerAuthority;
  createWorker(authority: WorkerAuthority): {
    processBatch(): Promise<OutboxWorkerResult>;
  };
};

export function createOutboxRouteHandlers(dependencies: OutboxRouteDependencies) {
  return {
    async runOutboxWorker(request: Request) {
      try {
        const authority = dependencies.authenticateWorker(request);
        const result = await dependencies.createWorker(authority).processBatch();
        return NextResponse.json(result, { status: 202 });
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultOutboxRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  const deliveryService = new NotificationDeliveryService(
    unitOfWork,
    createNotificationProvider(),
    createPushTokenCipher()
  );
  const dispatchService = new DispatchService(unitOfWork);
  return createOutboxRouteHandlers({
    authenticateWorker: authenticateWorkerSecret,
    createWorker: (authority) => {
      const worker = new OutboxWorker(unitOfWork, {
        workerId: authority.workerId,
        consumers: {
          handlers: {
            "notification.created": async (event) => {
              const result = await deliveryService.deliver(event.aggregateId);
              return {
                notificationStatus: result.status,
                ...(result.errorCode ? { errorCode: result.errorCode } : {})
              };
            },
            "assignment.recovery.requested": async (event) => {
              const requestId = event.payload.request_id;
              if (typeof requestId !== "string" || requestId.length === 0) {
                throw new Error("Recovery event request id is invalid.");
              }
              await dispatchService.restartRecoveredRequest(requestId);
            }
          }
        }
      });
      return { processBatch: () => recordWorkerRun({
        unitOfWork, workerName: "outbox", run: () => worker.processBatch(),
        summarize: (result) => ({ claimed: result.claimed, succeeded: result.processed + result.retried + result.deadLettered, failed: 0 })
      }) };
    }
  });
}

function routeError(error: unknown) {
  if (error instanceof DatabaseError) {
    return databaseJsonError(error);
  }
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    "errorCode" in error &&
    "message" in error &&
    typeof error.status === "number" &&
    typeof error.errorCode === "string" &&
    typeof error.message === "string"
  ) {
    return jsonError(error.status, error.errorCode as ApiErrorCode, error.message);
  }
  return jsonError(500, "INTERNAL_ERROR", "An internal API error occurred.");
}
