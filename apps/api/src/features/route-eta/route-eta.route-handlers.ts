import { NextResponse } from "next/server";

import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import { ExpiringSingleFlightCache } from "./route-eta.cache";
import { createRouteEtaProviderFromEnv } from "./google-routes.provider";
import { RouteEtaService } from "./route-eta.service";
import type { RouteEtaResponse } from "./route-eta.types";

export type RouteEtaRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  service: {
    getRouteEta(identity: VerifiedSupabaseIdentity, assignmentId: string): Promise<RouteEtaResponse>;
  };
};

export function createRouteEtaRouteHandlers(dependencies: RouteEtaRouteDependencies) {
  return {
    async getRouteEta(request: Request, assignmentId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.service.getRouteEta(identity, assignmentId));
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

const cacheTtlSeconds = boundedInteger(process.env.ROUTE_ETA_CACHE_TTL_SECONDS, 60, 5, 300);
const defaultCache = new ExpiringSingleFlightCache<never>({
  ttlMs: cacheTtlSeconds * 1000,
  maxEntries: 500
});

export function createDefaultRouteEtaRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  const service = new RouteEtaService(
    unitOfWork,
    createRouteEtaProviderFromEnv(),
    defaultCache,
    {
      cacheTtlSeconds,
      locationMaxAgeSeconds: boundedInteger(
        process.env.ROUTE_ETA_LOCATION_MAX_AGE_SECONDS,
        300,
        30,
        1800
      )
    }
  );
  return createRouteEtaRouteHandlers({ authenticate: authenticateSupabaseRequest, service });
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

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
