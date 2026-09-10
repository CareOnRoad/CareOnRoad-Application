import { NextResponse } from "next/server";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { authenticateWorkerSecret, type WorkerAuthority } from "@/server/auth/worker-secret";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { ReviewRatingRebuildWorker } from "@/server/workers/review-rating-rebuild.worker";
import { recordWorkerRun } from "@/server/workers/worker-run-recorder";

import { ReviewService, type ReviewResponse } from "./review.service";

export type ReviewRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  service: {
    createReview(
      identity: VerifiedSupabaseIdentity,
      assignmentId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<ReviewResponse>;
  };
};

export function createReviewRouteHandlers(dependencies: ReviewRouteDependencies) {
  return {
    async createReview(request: Request, assignmentId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        const response = await dependencies.service.createReview(
          identity,
          assignmentId,
          await readJson(request),
          request.headers.get("x-idempotency-key")?.trim() ?? ""
        );
        return NextResponse.json(response, { status: 201 });
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultReviewRouteHandlers() {
  return createReviewRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    service: new ReviewService(new PostgresUnitOfWork(getPostgresClient()))
  });
}

export type ReviewRebuildRouteDependencies = {
  authenticateWorker(request: Request): WorkerAuthority;
  createWorker(authority: WorkerAuthority): { rebuild(): Promise<{ mechanics_rebuilt: number }> };
};

export function createReviewRebuildRouteHandlers(dependencies: ReviewRebuildRouteDependencies) {
  return {
    async rebuild(request: Request) {
      try {
        const authority = dependencies.authenticateWorker(request);
        void authority;
        return NextResponse.json(await dependencies.createWorker(authority).rebuild(), {
          status: 202
        });
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultReviewRebuildRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createReviewRebuildRouteHandlers({
    authenticateWorker: authenticateWorkerSecret,
    createWorker: () => {
      const worker = new ReviewRatingRebuildWorker(unitOfWork);
      return { rebuild: () => recordWorkerRun({
        unitOfWork, workerName: "review_rating_rebuild", run: () => worker.rebuild(),
        summarize: (result) => ({ claimed: result.mechanics_rebuilt, succeeded: result.mechanics_rebuilt, failed: 0 })
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
