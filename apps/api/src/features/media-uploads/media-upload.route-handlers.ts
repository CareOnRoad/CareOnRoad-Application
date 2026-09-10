import { NextResponse } from "next/server";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { authenticateWorkerSecret, type WorkerAuthority } from "@/server/auth/worker-secret";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { MediaUploadCleanupWorker } from "@/server/workers/media-upload-cleanup.worker";
import { recordWorkerRun } from "@/server/workers/worker-run-recorder";

import { MediaUploadService, type FinalizedMediaResponse, type MediaUploadIntentResponse } from "./media-upload.service";
import { createMediaStorageProvider, mediaStorageBucket } from "./media-storage.factory";

export type MediaUploadRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  service: {
    createIntent(identity: VerifiedSupabaseIdentity, input: unknown, key: string): Promise<MediaUploadIntentResponse>;
    finalizeIntent(identity: VerifiedSupabaseIdentity, intentId: string, key: string): Promise<FinalizedMediaResponse>;
  };
};

export function createMediaUploadRouteHandlers(dependencies: MediaUploadRouteDependencies) {
  return {
    async createIntent(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        const response = await dependencies.service.createIntent(
          identity,
          await readJson(request),
          requireIdempotencyKey(request)
        );
        return NextResponse.json(response, { status: 201 });
      } catch (error) {
        return routeError(error);
      }
    },
    async finalizeIntent(request: Request, intentId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        const response = await dependencies.service.finalizeIntent(
          identity,
          intentId,
          requireIdempotencyKey(request)
        );
        return NextResponse.json(response, { status: 201 });
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultMediaUploadRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createMediaUploadRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    service: new MediaUploadService(
      unitOfWork,
      createMediaStorageProvider(),
      mediaStorageBucket()
    )
  });
}

export type MediaUploadCleanupRouteDependencies = {
  authenticateWorker(request: Request): WorkerAuthority;
  createWorker(authority: WorkerAuthority): { processBatch(): Promise<unknown> };
};

export function createMediaUploadCleanupRouteHandlers(
  dependencies: MediaUploadCleanupRouteDependencies
) {
  return {
    async cleanup(request: Request) {
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

export function createDefaultMediaUploadCleanupRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  const storage = createMediaStorageProvider();
  return createMediaUploadCleanupRouteHandlers({
    authenticateWorker: authenticateWorkerSecret,
    createWorker: (authority) => {
      const worker = new MediaUploadCleanupWorker(unitOfWork, storage, { workerId: authority.workerId });
      return { processBatch: () => recordWorkerRun({
        unitOfWork, workerName: "media_upload_cleanup", run: () => worker.processBatch(),
        summarize: (result) => ({ claimed: result.claimed, succeeded: result.expired, failed: result.failed })
      }) };
    }
  });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const error = new Error("Request body must be valid JSON.") as Error & {
      status: number;
      errorCode: "INVALID_INPUT";
    };
    error.status = 400;
    error.errorCode = "INVALID_INPUT";
    throw error;
  }
}

function requireIdempotencyKey(request: Request): string {
  return request.headers.get("x-idempotency-key")?.trim() ?? "";
}

function routeError(error: unknown) {
  if (error instanceof DatabaseError) return databaseJsonError(error);
  if (
    error && typeof error === "object" && "status" in error && "errorCode" in error &&
    "message" in error && typeof error.status === "number" &&
    typeof error.errorCode === "string" && typeof error.message === "string"
  ) {
    return jsonError(error.status, error.errorCode as ApiErrorCode, error.message);
  }
  return jsonError(500, "INTERNAL_ERROR", "An internal API error occurred.");
}
