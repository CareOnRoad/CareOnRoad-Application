import { NextResponse } from "next/server";

import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateWorkerSecret, type WorkerAuthority } from "@/server/auth/worker-secret";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { recordWorkerRun } from "@/server/workers/worker-run-recorder";
import {
  DispatchWorker,
  type DispatchWorkerResult
} from "@/server/workers/dispatch.worker";

export type DispatchWorkerRouteDependencies = {
  authenticateWorker(request: Request): WorkerAuthority;
  createWorker(authority: WorkerAuthority): {
    processBatch(): Promise<DispatchWorkerResult>;
  };
};

export function createDispatchWorkerRouteHandlers(
  dependencies: DispatchWorkerRouteDependencies
) {
  return {
    async runDispatchWorker(request: Request) {
      try {
        const authority = dependencies.authenticateWorker(request);
        return NextResponse.json(
          await dependencies.createWorker(authority).processBatch(),
          { status: 202 }
        );
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultDispatchWorkerRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createDispatchWorkerRouteHandlers({
    authenticateWorker: authenticateWorkerSecret,
    createWorker: (authority) => {
      const worker = new DispatchWorker(unitOfWork, { workerId: authority.workerId });
      return { processBatch: () => recordWorkerRun({
        unitOfWork, workerName: "dispatch", run: () => worker.processBatch(),
        summarize: (result) => ({ claimed: result.claimed, succeeded: result.advanced + result.escalated + result.skipped, failed: result.failed })
      }) };
    }
  });
}

function routeError(error: unknown) {
  if (error instanceof DatabaseError) return databaseJsonError(error);
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
