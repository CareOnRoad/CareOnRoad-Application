import type { ApiErrorCode } from "@/lib/api-error";
import { distanceMeters } from "@/features/dispatch/dispatch-ranking";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/server/repositories/contracts/assignment.repository";
import type { GeoPoint } from "@/server/repositories/contracts/mechanic.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { loadActiveActor } from "../assignments/assignment.service";
import { isMechanicLocationFresh } from "../motorcycles/mechanic-profile.service";
import type { CachedValue } from "./route-eta.cache";
import { ExpiringSingleFlightCache } from "./route-eta.cache";
import {
  normalizeProviderError,
  type RouteEtaProvider
} from "./route-eta.provider";
import type {
  RouteEtaProviderFailureReason,
  RouteEtaResponse,
  RouteEtaUnavailableReason
} from "./route-eta.types";

const ADVISORY = {
  code: "TWO_WHEELER_ROUTE_ESTIMATE" as const,
  message:
    "Quang duong va thoi gian chi mang tinh tham khao; duong cho xe may co the thieu du lieu va khong phai cam ket den noi."
};

type ComputedEstimate = {
  status: "available" | "fallback";
  source: "google_routes" | "straight_line_fallback";
  distanceMeters: number;
  durationSeconds?: number;
  unavailableReason?: RouteEtaProviderFailureReason;
  calculatedAt: Date;
};

type RouteEtaContext = {
  origin?: GeoPoint;
  originUpdatedAt?: Date;
  destination?: GeoPoint;
};

export type RouteEtaServiceOptions = {
  now?: () => Date;
  locationMaxAgeSeconds?: number;
  cacheTtlSeconds?: number;
};

export class RouteEtaService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly provider: RouteEtaProvider,
    private readonly cache: ExpiringSingleFlightCache<ComputedEstimate>,
    private readonly options: RouteEtaServiceOptions = {}
  ) {}

  async getRouteEta(
    identity: VerifiedSupabaseIdentity,
    assignmentId: string
  ): Promise<RouteEtaResponse> {
    const now = this.options.now?.() ?? new Date();
    const context = await this.loadAuthorizedContext(identity, assignmentId);
    if (!context.origin) {
      return this.unavailable(assignmentId, "origin_missing", now);
    }
    if (!isMechanicLocationFresh(
      context.originUpdatedAt,
      now,
      this.options.locationMaxAgeSeconds ?? 300
    )) {
      return this.unavailable(assignmentId, "origin_stale", now);
    }
    if (!context.destination) {
      return this.unavailable(assignmentId, "destination_missing", now);
    }

    const origin = context.origin;
    const destination = context.destination;
    const key = cacheKey(assignmentId, origin, destination, context.originUpdatedAt);
    const cached = await this.cache.getOrLoad(key, async () => {
      const calculatedAt = this.options.now?.() ?? new Date();
      try {
        const route = await this.provider.compute({ origin, destination });
        return {
          status: "available",
          source: "google_routes",
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          calculatedAt
        } satisfies ComputedEstimate;
      } catch (error) {
        const normalized = normalizeProviderError(error);
        return {
          status: "fallback",
          source: "straight_line_fallback",
          distanceMeters: Math.max(1, distanceMeters(origin, destination)),
          unavailableReason: normalized.reason,
          calculatedAt
        } satisfies ComputedEstimate;
      }
    });
    return toResponse(assignmentId, cached);
  }

  private async loadAuthorizedContext(
    identity: VerifiedSupabaseIdentity,
    assignmentId: string
  ): Promise<RouteEtaContext> {
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const assignment = await repositories.assignments.findById(assignmentId);
      if (!assignment) {
        throw new RouteEtaError("NOT_FOUND", "Assignment not found.", 404);
      }
      const request = await repositories.serviceRequests.findById(assignment.requestId);
      if (!request) {
        throw new RouteEtaError("NOT_FOUND", "Service request not found.", 404);
      }
      const canRead =
        actor.roles.includes("admin") ||
        (actor.roles.includes("mechanic") && assignment.mechanicId === actor.id) ||
        (actor.roles.includes("rider") && request.riderId === actor.id);
      if (!canRead) {
        throw new RouteEtaError("FORBIDDEN", "Assignment access is not allowed.", 403);
      }
      if (!ACTIVE_ASSIGNMENT_STATUSES.includes(
        assignment.status as (typeof ACTIVE_ASSIGNMENT_STATUSES)[number]
      )) {
        throw new RouteEtaError("CONFLICT", "Route ETA is available only for active assignments.", 409);
      }
      const mechanic = await repositories.mechanics.findProfileByUserId(assignment.mechanicId);
      return {
        origin: mechanic?.latestLocation,
        originUpdatedAt: mechanic?.locationUpdatedAt,
        destination: request.serviceLocation
      };
    });
  }

  private unavailable(
    assignmentId: string,
    reason: RouteEtaUnavailableReason,
    now: Date
  ): RouteEtaResponse {
    const expiresAt = new Date(now.getTime() + (this.options.cacheTtlSeconds ?? 60) * 1000);
    return {
      assignment_id: assignmentId,
      status: "unavailable",
      source: "none",
      calculated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      unavailable_reason: reason,
      advisory: ADVISORY
    };
  }
}

export class RouteEtaError extends Error {
  constructor(
    public readonly errorCode: Extract<ApiErrorCode, "NOT_FOUND" | "FORBIDDEN" | "CONFLICT">,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "RouteEtaError";
  }
}

function toResponse(
  assignmentId: string,
  cached: CachedValue<ComputedEstimate>
): RouteEtaResponse {
  return {
    assignment_id: assignmentId,
    status: cached.value.status,
    source: cached.value.source,
    distance_meters: cached.value.distanceMeters,
    ...(cached.value.durationSeconds
      ? { duration_seconds: cached.value.durationSeconds }
      : {}),
    calculated_at: cached.value.calculatedAt.toISOString(),
    expires_at: cached.expiresAt.toISOString(),
    ...(cached.value.unavailableReason
      ? { unavailable_reason: cached.value.unavailableReason }
      : {}),
    advisory: ADVISORY
  };
}

function cacheKey(
  assignmentId: string,
  origin: GeoPoint,
  destination: GeoPoint,
  originUpdatedAt: Date | undefined
): string {
  return [
    assignmentId,
    origin.latitude,
    origin.longitude,
    originUpdatedAt?.toISOString() ?? "missing",
    destination.latitude,
    destination.longitude
  ].join(":");
}
