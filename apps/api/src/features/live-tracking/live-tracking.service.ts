import type { ApiErrorCode } from "@/lib/api-error";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { AssignmentLiveLocation } from "@/server/repositories/contracts/live-tracking.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { loadActiveActor } from "../assignments/assignment.service";
import {
  liveLocationInputSchema,
  type LiveTrackingConfig
} from "./live-tracking.schemas";

const TRACKING_STATUSES = new Set(["accepted", "en_route"]);

export type LiveLocationResponse = {
  assignment_id: string;
  latitude: number;
  longitude: number;
  observed_at: string;
  accuracy_meters: number;
  received_at: string;
  expires_at: string;
  freshness: "current";
};

export class LiveTrackingService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly config: LiveTrackingConfig,
    private readonly options: { now?: () => Date } = {}
  ) {}

  async publish(
    identity: VerifiedSupabaseIdentity,
    assignmentId: string,
    input: unknown
  ): Promise<{ location: LiveLocationResponse; created: boolean }> {
    if (!this.config.enabled || !this.config.retentionMinutes) {
      throw new LiveTrackingError(
        "CONFLICT",
        "Live tracking is disabled or retention is not configured.",
        409
      );
    }
    const parsed = liveLocationInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new LiveTrackingError("INVALID_INPUT", "Live location input is invalid.", 400);
    }
    if (parsed.data.accuracy_meters > this.config.maxAccuracyMeters) {
      throw new LiveTrackingError("INVALID_INPUT", "Live location accuracy is insufficient.", 400);
    }
    const receivedAt = this.options.now?.() ?? new Date();
    const observedAt = new Date(parsed.data.observed_at);
    if (
      observedAt.getTime() < receivedAt.getTime() - this.config.maxLocationAgeSeconds * 1000 ||
      observedAt.getTime() > receivedAt.getTime() + this.config.maxFutureSkewSeconds * 1000
    ) {
      throw new LiveTrackingError("INVALID_INPUT", "Live location timestamp is outside the allowed window.", 400);
    }

    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      if (!actor.roles.includes("mechanic")) {
        throw new LiveTrackingError("FORBIDDEN", "Assigned mechanic access is required.", 403);
      }
      const assignment = await repositories.assignments.findByIdForUpdate(assignmentId);
      if (!assignment) {
        throw new LiveTrackingError("NOT_FOUND", "Assignment not found.", 404);
      }
      if (assignment.mechanicId !== actor.id) {
        throw new LiveTrackingError("FORBIDDEN", "Assigned mechanic access is required.", 403);
      }
      if (!TRACKING_STATUSES.has(assignment.status)) {
        throw new LiveTrackingError("CONFLICT", "Assignment is not in a tracking-eligible state.", 409);
      }
      const existing = await repositories.liveTracking.findByAssignmentIdForUpdate(assignmentId);
      if (existing && observedAt.getTime() <= existing.observedAt.getTime()) {
        throw new LiveTrackingError("CONFLICT", "Live location update is stale or replayed.", 409);
      }
      if (
        existing &&
        receivedAt.getTime() - existing.receivedAt.getTime() <
          this.config.minUpdateIntervalSeconds * 1000
      ) {
        throw new LiveTrackingError("RATE_LIMITED", "Live location updates are too frequent.", 429);
      }
      const expiresAt = new Date(
        receivedAt.getTime() + this.config.retentionMinutes! * 60_000
      );
      const result = await repositories.liveTracking.upsert({
        assignmentId,
        mechanicId: assignment.mechanicId,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        observedAt,
        accuracyMeters: parsed.data.accuracy_meters,
        receivedAt,
        expiresAt,
        createdAt: existing?.createdAt ?? receivedAt,
        updatedAt: receivedAt
      });
      return { location: toResponse(result.location), created: result.created };
    });
  }

  async getLatest(
    identity: VerifiedSupabaseIdentity,
    assignmentId: string
  ): Promise<LiveLocationResponse> {
    if (!this.config.enabled || !this.config.retentionMinutes) {
      throw new LiveTrackingError("NOT_FOUND", "Current live location not found.", 404);
    }
    const now = this.options.now?.() ?? new Date();
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const assignment = await repositories.assignments.findById(assignmentId);
      if (!assignment) {
        throw new LiveTrackingError("NOT_FOUND", "Assignment not found.", 404);
      }
      const request = await repositories.serviceRequests.findById(assignment.requestId);
      if (!request) {
        throw new LiveTrackingError("NOT_FOUND", "Service request not found.", 404);
      }
      const canRead =
        actor.roles.includes("admin") ||
        (actor.roles.includes("mechanic") && assignment.mechanicId === actor.id) ||
        (actor.roles.includes("rider") && request.riderId === actor.id);
      if (!canRead) {
        throw new LiveTrackingError("FORBIDDEN", "Live location access is not allowed.", 403);
      }
      if (!TRACKING_STATUSES.has(assignment.status)) {
        throw new LiveTrackingError("NOT_FOUND", "Current live location not found.", 404);
      }
      const location = await repositories.liveTracking.findCurrentByAssignmentId(assignmentId, now);
      if (!location) {
        throw new LiveTrackingError("NOT_FOUND", "Current live location not found.", 404);
      }
      return toResponse(location);
    });
  }
}

export class LiveTrackingError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED"
    >,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "LiveTrackingError";
  }
}

function toResponse(location: AssignmentLiveLocation): LiveLocationResponse {
  return {
    assignment_id: location.assignmentId,
    latitude: location.latitude,
    longitude: location.longitude,
    observed_at: location.observedAt.toISOString(),
    accuracy_meters: location.accuracyMeters,
    received_at: location.receivedAt.toISOString(),
    expires_at: location.expiresAt.toISOString(),
    freshness: "current"
  };
}
