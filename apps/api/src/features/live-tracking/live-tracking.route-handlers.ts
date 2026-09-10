import { NextResponse } from "next/server";

import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import { readLiveTrackingConfig } from "./live-tracking.schemas";
import { LiveTrackingService, type LiveLocationResponse } from "./live-tracking.service";

export type LiveTrackingRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  service: {
    publish(
      identity: VerifiedSupabaseIdentity,
      assignmentId: string,
      input: unknown
    ): Promise<{ location: LiveLocationResponse; created: boolean }>;
    getLatest(
      identity: VerifiedSupabaseIdentity,
      assignmentId: string
    ): Promise<LiveLocationResponse>;
  };
};

export function createLiveTrackingRouteHandlers(dependencies: LiveTrackingRouteDependencies) {
  return {
    async publish(request: Request, assignmentId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        const input = await readJson(request);
        const result = await dependencies.service.publish(identity, assignmentId, input);
        return NextResponse.json(result.location, { status: result.created ? 201 : 200 });
      } catch (error) {
        return routeError(error);
      }
    },

    async getLatest(request: Request, assignmentId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.service.getLatest(identity, assignmentId));
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultLiveTrackingRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  let config;
  try {
    config = readLiveTrackingConfig();
  } catch {
    config = readLiveTrackingConfig({ LIVE_TRACKING_ENABLED: "false" });
  }
  return createLiveTrackingRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    service: new LiveTrackingService(unitOfWork, config)
  });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), {
      status: 400,
      errorCode: "INVALID_INPUT" as const
    });
  }
}

function routeError(error: unknown) {
  if (error instanceof DatabaseError) {
    return databaseJsonError(error);
  }
  if (
    error && typeof error === "object" &&
    "status" in error && "errorCode" in error && "message" in error &&
    typeof error.status === "number" && typeof error.errorCode === "string" &&
    typeof error.message === "string"
  ) {
    return jsonError(error.status, error.errorCode as ApiErrorCode, error.message);
  }
  return jsonError(500, "INTERNAL_ERROR", "An internal API error occurred.");
}
