import { NextResponse } from "next/server";
import { CancellationConflict } from "@/features/assignments/assignment-cancellation";

import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { getPostgresClient } from "@/server/db/postgres-client";
import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { DatabaseError } from "@/server/db/database-errors";
import type { RequestActor, VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

import { loadActiveAdminActor } from "./admin.authorization";
import { adminIdempotencyKeySchema } from "./admin.schemas";

export type AdminRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  unitOfWork: UnitOfWork;
};

export type AdminPage<T> = {
  items: T[];
  limit: number;
  nextCursor?: string;
};

export function createDefaultAdminRouteDependencies(): AdminRouteDependencies {
  return {
    authenticate: authenticateSupabaseRequest,
    unitOfWork: new PostgresUnitOfWork(getPostgresClient())
  };
}

export async function authenticateAdminRequest(
  request: Request,
  dependencies: AdminRouteDependencies
): Promise<RequestActor> {
  const identity = await dependencies.authenticate(request);
  return dependencies.unitOfWork.execute(({ users }) =>
    loadActiveAdminActor(identity, users)
  );
}

export async function readAdminJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AdminRouteError("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }
}

export function readAdminIdempotencyKey(request: Request): string {
  const parsed = adminIdempotencyKeySchema.safeParse(
    request.headers.get("x-idempotency-key")
  );
  if (!parsed.success) {
    throw new AdminRouteError(
      "INVALID_INPUT",
      "A valid X-Idempotency-Key header is required.",
      400
    );
  }
  return parsed.data;
}

export function toAdminPageResponse<T>(page: AdminPage<T>) {
  return {
    items: page.items,
    page: {
      limit: page.limit,
      ...(page.nextCursor ? { next_cursor: page.nextCursor } : {}),
      has_more: Boolean(page.nextCursor)
    }
  };
}

export function adminRouteError(error: unknown): NextResponse {
  if (error instanceof CancellationConflict) return jsonError(error.status, error.errorCode, error.message, { details: error.details });
  if (error instanceof DatabaseError) {
    return databaseJsonError(error);
  }
  if (isMappedRouteError(error)) {
    return jsonError(error.status, error.errorCode as ApiErrorCode, error.message);
  }
  return jsonError(500, "INTERNAL_ERROR", "An internal admin operation error occurred.");
}

export class AdminRouteError extends Error {
  constructor(
    public readonly errorCode: Extract<ApiErrorCode, "INVALID_INPUT" | "CONFLICT" | "NOT_FOUND">,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AdminRouteError";
  }
}

function isMappedRouteError(
  error: unknown
): error is { status: number; errorCode: string; message: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      "errorCode" in error &&
      "message" in error &&
      typeof error.status === "number" &&
      typeof error.errorCode === "string" &&
      typeof error.message === "string"
  );
}
