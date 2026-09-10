import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import type {
  MechanicProfile,
  MechanicProfileStatus
} from "@/server/repositories/contracts/mechanic.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { requireActorRole } from "../auth/authorization";
import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import {
  geoPointSchema,
  mechanicAvailabilitySchema,
  mechanicProfileUpdateSchema,
  type GeoPointInput,
  type MechanicAvailabilityInput,
  type MechanicProfileUpdateInput
} from "./motorcycle.schemas";

export const LOCATION_MAX_AGE_SECONDS = 300;

export type MechanicProfileResponse = {
  user_id: string;
  profile_status: MechanicProfileStatus;
  is_available: boolean;
  service_radius_km: number;
  latest_location?: GeoPointInput;
  location_updated_at?: string;
  availability_updated_at: string;
  rating_avg: number;
  rating_count: number;
  service_types: string[];
  created_at: string;
  updated_at: string;
};

export class MechanicProfileService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: { now?: () => Date; createId?: () => string } = {}
  ) {}

  getMyProfile(identity: VerifiedSupabaseIdentity): Promise<MechanicProfileResponse> {
    return this.unitOfWork.execute(async ({ mechanics, users }) => {
      const actor = await loadMechanicActor(users, identity.subject);
      const profile = await mechanics.findProfileByUserId(actor.id);
      if (!profile) {
        throw new MechanicProfileError("NOT_FOUND", "Mechanic profile not found.", 404);
      }
      return toMechanicProfileResponse(profile);
    });
  }

  async updateMyProfile(
    identity: VerifiedSupabaseIdentity,
    input: unknown
  ): Promise<MechanicProfileResponse> {
    const parsed = parseProfileUpdate(input);
    return await this.unitOfWork.execute(async ({ audit, mechanics, outbox, users }) => {
      const actor = await loadMechanicActor(users, identity.subject);
      const existing = await mechanics.findProfileByUserId(actor.id);
      if (!existing) {
        throw new MechanicProfileError("NOT_FOUND", "Mechanic profile not found.", 404);
      }
      const now = this.options.now?.() ?? new Date();
      const profile = await mechanics.updateSettings({
        userId: actor.id,
        serviceRadiusKm: parsed.service_radius_km,
        serviceTypes: parsed.service_types,
        updatedAt: now
      });
      if (!profile) {
        throw new MechanicProfileError("NOT_FOUND", "Mechanic profile not found.", 404);
      }
      await appendMechanicMutationAuditOutbox({
        action: "mechanic.profile.updated",
        actorId: actor.id,
        changedFields: Object.keys(parsed),
        profile,
        audit,
        outbox,
        now,
        createId: this.options.createId ?? randomUUID
      });
      return toMechanicProfileResponse(profile);
    });
  }

  async updateAvailability(
    identity: VerifiedSupabaseIdentity,
    input: unknown
  ): Promise<MechanicProfileResponse> {
    const parsed = parseAvailability(input);
    return await this.unitOfWork.execute(async ({ audit, mechanics, outbox, users }) => {
      const actor = await loadMechanicActor(users, identity.subject);
      const existing = await mechanics.findProfileByUserId(actor.id);
      if (!existing) {
        throw new MechanicProfileError("NOT_FOUND", "Mechanic profile not found.", 404);
      }
      const now = this.options.now?.() ?? new Date();
      const profile = await mechanics.updateAvailability(actor.id, parsed.is_available, now);
      if (!profile) {
        throw new MechanicProfileError("NOT_FOUND", "Mechanic profile not found.", 404);
      }
      await appendMechanicMutationAuditOutbox({
        action: "mechanic.availability.updated",
        actorId: actor.id,
        changedFields: ["is_available", "availability_updated_at"],
        profile,
        audit,
        outbox,
        now,
        createId: this.options.createId ?? randomUUID
      });
      return toMechanicProfileResponse(profile);
    });
  }

  async updateLocation(identity: VerifiedSupabaseIdentity, input: unknown): Promise<void> {
    const parsed = parseLocation(input);
    return await this.unitOfWork.execute(async ({ audit, mechanics, outbox, users }) => {
      const actor = await loadMechanicActor(users, identity.subject);
      const existing = await mechanics.findProfileByUserId(actor.id);
      if (!existing) {
        throw new MechanicProfileError("NOT_FOUND", "Mechanic profile not found.", 404);
      }
      const now = this.options.now?.() ?? new Date();
      const profile = await mechanics.updateLocation(actor.id, parsed, now);
      if (!profile) {
        throw new MechanicProfileError("NOT_FOUND", "Mechanic profile not found.", 404);
      }
      await appendMechanicMutationAuditOutbox({
        action: "mechanic.location.updated",
        actorId: actor.id,
        changedFields: ["latest_location", "location_updated_at"],
        profile,
        audit,
        outbox,
        now,
        createId: this.options.createId ?? randomUUID
      });
    });
  }
}

export class MechanicProfileError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "ACTOR_SUSPENDED"
    >,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "MechanicProfileError";
  }
}

export function isMechanicLocationFresh(
  locationUpdatedAt: Date | undefined,
  now: Date,
  maxAgeSeconds = LOCATION_MAX_AGE_SECONDS
): boolean {
  if (!locationUpdatedAt) {
    return false;
  }
  return now.getTime() - locationUpdatedAt.getTime() <= maxAgeSeconds * 1000;
}

function parseProfileUpdate(input: unknown): MechanicProfileUpdateInput {
  const parsed = mechanicProfileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new MechanicProfileError("INVALID_INPUT", "Mechanic profile input is invalid.", 400, {
      issues: parsed.error.issues
    });
  }
  return {
    ...parsed.data,
    service_types: parsed.data.service_types
      ? [...new Set(parsed.data.service_types)].sort()
      : undefined
  };
}

function parseAvailability(input: unknown): MechanicAvailabilityInput {
  const parsed = mechanicAvailabilitySchema.safeParse(input);
  if (!parsed.success) {
    throw new MechanicProfileError("INVALID_INPUT", "Availability input is invalid.", 400, {
      issues: parsed.error.issues
    });
  }
  return parsed.data;
}

function parseLocation(input: unknown): GeoPointInput {
  const parsed = geoPointSchema.safeParse(input);
  if (!parsed.success) {
    throw new MechanicProfileError("INVALID_INPUT", "Location input is invalid.", 400, {
      issues: parsed.error.issues
    });
  }
  return parsed.data;
}

async function loadMechanicActor(
  users: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["users"],
  actorId: string
) {
  const actor = await users.findActorById(actorId);
  if (!actor) {
    throw new MechanicProfileError("NOT_FOUND", "Application profile not found.", 404);
  }
  requireActorRole(
    {
      id: actor.id,
      ...(actor.displayName ? { display_name: actor.displayName } : {}),
      roles: actor.roles,
      status: actor.status
    },
    "mechanic"
  );
  return actor;
}

async function appendMechanicMutationAuditOutbox(input: {
  action: string;
  actorId: string;
  changedFields: string[];
  profile: MechanicProfile;
  audit: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["audit"];
  outbox: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["outbox"];
  now: Date;
  createId: () => string;
}): Promise<void> {
  const occurrenceId = input.createId();
  await input.outbox.append({
    id: occurrenceId,
    topic: input.action,
    aggregateType: "mechanic_profile",
    aggregateId: input.profile.userId,
    dedupeKey: `${input.action}:${input.profile.userId}:${occurrenceId}`,
    payload: {
      resource_id: input.profile.userId,
      changed_fields: input.changedFields,
      has_latest_location: Boolean(input.profile.latestLocation)
    },
    createdAt: input.now,
    nextAttemptAt: input.now
  });
  await input.audit.append({
    id: input.createId(),
    actorId: input.actorId,
    actorRole: "mechanic",
    action: input.action,
    entityType: "mechanic_profile",
    entityId: input.profile.userId,
    metadata: {
      resource_id: input.profile.userId,
      changed_fields: input.changedFields,
      has_latest_location: Boolean(input.profile.latestLocation)
    },
    createdAt: input.now
  });
}

export function toMechanicProfileResponse(profile: MechanicProfile): MechanicProfileResponse {
  return {
    user_id: profile.userId,
    profile_status: profile.profileStatus,
    is_available: profile.isAvailable,
    service_radius_km: profile.serviceRadiusKm,
    ...(profile.latestLocation ? { latest_location: profile.latestLocation } : {}),
    ...(profile.locationUpdatedAt
      ? { location_updated_at: profile.locationUpdatedAt.toISOString() }
      : {}),
    availability_updated_at: profile.availabilityUpdatedAt.toISOString(),
    rating_avg: profile.ratingAvg,
    rating_count: profile.ratingCount,
    service_types: profile.serviceTypes,
    created_at: profile.createdAt.toISOString(),
    updated_at: profile.updatedAt.toISOString()
  };
}
