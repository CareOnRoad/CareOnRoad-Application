import { NextResponse } from "next/server";
import { z } from "zod";

import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateWorkerSecret, type WorkerAuthority } from "@/server/auth/worker-secret";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { recordWorkerRun } from "@/server/workers/worker-run-recorder";

import {
  LiveTrackingCleanupWorker,
  type LiveTrackingCleanupResult
} from "./live-tracking-cleanup.worker";

const inputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25)
}).strict();

export type LiveTrackingCleanupRouteDependencies = {
  authenticateWorker(request: Request): WorkerAuthority;
  run(
    input: { limit: number },
    authority: WorkerAuthority
  ): Promise<LiveTrackingCleanupResult>;
};

export function createLiveTrackingCleanupRouteHandlers(
  dependencies: LiveTrackingCleanupRouteDependencies
) {
  return {
    async run(request: Request) {
      try {
        const authority = dependencies.authenticateWorker(request);
        const parsed = inputSchema.safeParse(await readJson(request));
        if (!parsed.success) {
          throw Object.assign(new Error("Live tracking cleanup input is invalid."), {
            status: 400,
            errorCode: "INVALID_INPUT" as const
          });
        }
        return NextResponse.json(await dependencies.run(parsed.data, authority));
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultLiveTrackingCleanupRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createLiveTrackingCleanupRouteHandlers({
    authenticateWorker: authenticateWorkerSecret,
    run: (input) => {
      const worker = new LiveTrackingCleanupWorker({
        deleteExpired: (now, limit) =>
          unitOfWork.execute(({ liveTracking }) => liveTracking.deleteExpired(now, limit))
      });
      return recordWorkerRun({
        unitOfWork,
        workerName: "live_location_cleanup",
        run: () => worker.run(input),
        summarize: (result) => ({
          claimed: result.deleted,
          succeeded: result.deleted,
          failed: 0
        })
      });
    }
  });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), {
      status: 400,
      errorCode: "INVALID_INPUT" as const
    });
  }
}

function routeError(error: unknown) {
  if (error instanceof DatabaseError) return databaseJsonError(error);
  if (
    error && typeof error === "object" &&
    "status" in error && "errorCode" in error && "message" in error &&
    typeof error.status === "number" && typeof error.errorCode === "string" &&
    typeof error.message === "string"
  ) {
    return jsonError(error.status, error.errorCode as ApiErrorCode, error.message);
  }
  return jsonError(500, "INTERNAL_ERROR", "An internal cleanup worker error occurred.");
}
