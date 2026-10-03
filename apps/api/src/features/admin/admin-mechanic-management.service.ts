import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import { prepareIdempotency } from "@/lib/idempotency";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";
import { LOCATION_MAX_AGE_SECONDS } from "@/features/motorcycles/mechanic-profile.service";
import type {
  AdminMechanicCursor,
  AdminMechanicPerformance,
  AdminMechanicSummary,
  AdminMechanicWorkHistoryItem,
  MechanicLocationFreshness,
  MechanicProfile,
  MechanicProfileStatus,
  MechanicWorkState
} from "@/server/repositories/contracts/mechanic.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import type { UserRepository } from "@/server/repositories/contracts/user.repository";

import { loadActiveAdminActor } from "./admin.authorization";
import {
  adminMechanicListFilterSchema,
  adminMechanicRadiusMutationSchema,
  adminMechanicSkillsMutationSchema,
  adminPaginationSchema,
  adminReasonSchema,
  adminUuidSchema
} from "./admin.schemas";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type AdminMechanicSummaryResponse = {
  user_id: string;
  profile_status: MechanicProfileStatus;
  is_available: boolean;
  service_radius_km: number;
  service_types: ServiceType[];
  location_freshness: MechanicLocationFreshness;
  work_state: MechanicWorkState;
  rating_avg: number;
  rating_count: number;
  availability_updated_at: string;
  created_at: string;
  updated_at: string;
};

export type AdminMechanicWorkHistoryResponse = {
  assignment_id: string;
  request_id: string;
  status: AdminMechanicWorkHistoryItem["status"];
  accepted_at: string;
  started_at?: string;
  completed_at?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
};

export type AdminMechanicPerformanceResponse = {
  mechanic_id: string;
  assignments: {
    total: number;
    active: number;
    completed: number;
    canceled: number;
  };
  trusted_rating: {
    average: number;
    count: number;
  };
};

export type AdminMechanicPageResponse<T> = {
  items: T[];
  page: {
    limit: number;
    has_more: boolean;
    next_cursor?: string;
  };
};

type ServiceOptions = {
  now?: () => Date;
  createId?: () => string;
};

export class AdminMechanicManagementService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: ServiceOptions = {}
  ) {}

  listMechanics(
    identity: VerifiedSupabaseIdentity,
    input: unknown
  ): Promise<AdminMechanicPageResponse<AdminMechanicSummaryResponse>> {
    const filters = parseListFilters(input);
    const now = this.now();
    return this.unitOfWork.execute(async ({ mechanics, users }) => {
      await loadActiveAdminActor(identity, users);
      const page = await mechanics.listAdminProfiles({ ...filters, now });
      return toPage(
        page.items.map((profile) => toSummaryFromList(profile, now)),
        filters.limit,
        page.nextCursor
      );
    });
  }

  getMechanic(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string
  ): Promise<AdminMechanicSummaryResponse> {
    const id = parseUuid(mechanicId);
    const now = this.now();
    return this.unitOfWork.execute(async ({ mechanics, users }) => {
      await loadActiveAdminActor(identity, users);
      const profile = await mechanics.findProfileByUserId(id);
      if (!profile) throw notFound();
      const performance = await mechanics.getAdminPerformance(id);
      if (!performance) throw notFound();
      return toSummary(profile, performance, now);
    });
  }

  listWorkHistory(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string,
    input: unknown
  ): Promise<AdminMechanicPageResponse<AdminMechanicWorkHistoryResponse>> {
    const id = parseUuid(mechanicId);
    const pagination = parsePagination(input);
    return this.unitOfWork.execute(async ({ mechanics, users }) => {
      await loadActiveAdminActor(identity, users);
      if (!(await mechanics.findProfileByUserId(id))) throw notFound();
      const page = await mechanics.listAdminWorkHistory({
        mechanicId: id,
        limit: pagination.limit,
        ...(pagination.cursor ? { cursor: pagination.cursor } : {})
      });
      return toPage(
        page.items.map(toWorkHistoryResponse),
        pagination.limit,
        page.nextCursor
      );
    });
  }

  getPerformance(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string
  ): Promise<AdminMechanicPerformanceResponse> {
    const id = parseUuid(mechanicId);
    return this.unitOfWork.execute(async ({ mechanics, users }) => {
      await loadActiveAdminActor(identity, users);
      const performance = await mechanics.getAdminPerformance(id);
      if (!performance) throw notFound();
      return toPerformanceResponse(id, performance);
    });
  }

  approve(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string,
    input: unknown,
    idempotencyKey: string
  ) {
    return this.changeStatus(identity, mechanicId, input, idempotencyKey, {
      scope: "admin.mechanic.approve",
      action: "admin.mechanic.approved",
      allowed: ["pending"],
      next: "active",
      guardActiveAssignment: false
    });
  }

  reject(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string,
    input: unknown,
    idempotencyKey: string
  ) {
    return this.changeStatus(identity, mechanicId, input, idempotencyKey, {
      scope: "admin.mechanic.reject",
      action: "admin.mechanic.rejected",
      allowed: ["pending"],
      next: "rejected",
      guardActiveAssignment: false
    });
  }

  suspend(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string,
    input: unknown,
    idempotencyKey: string
  ) {
    return this.changeStatus(identity, mechanicId, input, idempotencyKey, {
      scope: "admin.mechanic.suspend",
      action: "admin.mechanic.suspended",
      allowed: ["active"],
      next: "suspended",
      guardActiveAssignment: true
    });
  }

  ban(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string,
    input: unknown,
    idempotencyKey: string
  ) {
    return this.changeStatus(identity, mechanicId, input, idempotencyKey, {
      scope: "admin.mechanic.ban",
      action: "admin.mechanic.banned",
      allowed: ["pending", "active", "suspended"],
      next: "banned",
      guardActiveAssignment: true
    });
  }

  reactivate(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string,
    input: unknown,
    idempotencyKey: string
  ) {
    return this.changeStatus(identity, mechanicId, input, idempotencyKey, {
      scope: "admin.mechanic.reactivate",
      action: "admin.mechanic.reactivated",
      allowed: ["suspended"],
      next: "active",
      guardActiveAssignment: false
    });
  }

  updateSkills(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminMechanicSummaryResponse> {
    const id = parseUuid(mechanicId);
    const parsed = adminMechanicSkillsMutationSchema.safeParse(input);
    if (!parsed.success) throw invalid("Mechanic skills input is invalid.");
    const serviceTypeSet = [...new Set(parsed.data.service_types)].sort();
    if (serviceTypeSet.length !== parsed.data.service_types.length) {
      throw invalid("Mechanic service types must be unique.");
    }
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.now();
      const replay = await this.prepareCommand(
        repositories,
        actor.id,
        "admin.mechanic.skills.update",
        idempotencyKey,
        { mechanic_id: id, reason: parsed.data.reason, service_types: serviceTypeSet },
        now
      );
      if (replay) return replay as AdminMechanicSummaryResponse;
      if (!(await repositories.mechanics.findProfileByUserIdForUpdate(id))) {
        throw notFound();
      }
      await requireMechanicRole(repositories.users, id);
      const updated = await repositories.mechanics.updateSettings({
        userId: id,
        serviceTypes: serviceTypeSet,
        updatedAt: now
      });
      if (!updated) throw notFound();
      const response = await this.summaryResponse(repositories, updated, now);
      await this.recordMutation(repositories, {
        actorId: actor.id,
        action: "admin.mechanic.skills_updated",
        entityId: id,
        reason: parsed.data.reason,
        metadata: { resource_id: id, field: "service_types" },
        now
      });
      await completeCommand(
        repositories,
        actor.id,
        "admin.mechanic.skills.update",
        idempotencyKey,
        response,
        id,
        now
      );
      return response;
    });
  }

  updateRadius(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminMechanicSummaryResponse> {
    const id = parseUuid(mechanicId);
    const parsed = adminMechanicRadiusMutationSchema.safeParse(input);
    if (!parsed.success) throw invalid("Mechanic radius input is invalid.");
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.now();
      const replay = await this.prepareCommand(
        repositories,
        actor.id,
        "admin.mechanic.radius.update",
        idempotencyKey,
        {
          mechanic_id: id,
          reason: parsed.data.reason,
          service_radius_km: parsed.data.service_radius_km
        },
        now
      );
      if (replay) return replay as AdminMechanicSummaryResponse;
      if (!(await repositories.mechanics.findProfileByUserIdForUpdate(id))) {
        throw notFound();
      }
      await requireMechanicRole(repositories.users, id);
      const updated = await repositories.mechanics.updateSettings({
        userId: id,
        serviceRadiusKm: parsed.data.service_radius_km,
        updatedAt: now
      });
      if (!updated) throw notFound();
      const response = await this.summaryResponse(repositories, updated, now);
      await this.recordMutation(repositories, {
        actorId: actor.id,
        action: "admin.mechanic.radius_updated",
        entityId: id,
        reason: parsed.data.reason,
        metadata: { resource_id: id, field: "service_radius_km" },
        now
      });
      await completeCommand(
        repositories,
        actor.id,
        "admin.mechanic.radius.update",
        idempotencyKey,
        response,
        id,
        now
      );
      return response;
    });
  }

  forceUnavailable(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminMechanicSummaryResponse> {
    const id = parseUuid(mechanicId);
    const parsed = parseReason(input);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.now();
      const replay = await this.prepareCommand(
        repositories,
        actor.id,
        "admin.mechanic.force_unavailable",
        idempotencyKey,
        { mechanic_id: id, reason: parsed.reason },
        now
      );
      if (replay) return replay as AdminMechanicSummaryResponse;
      const target =
        await repositories.mechanics.findProfileByUserIdForUpdate(id);
      if (!target) throw notFound();
      await requireMechanicRole(repositories.users, id);
      if (!target.isAvailable) throw conflict("Mechanic is already unavailable.");
      const updated = await repositories.mechanics.updateAvailability(id, false, now);
      if (!updated) throw notFound();
      const response = await this.summaryResponse(repositories, updated, now);
      await this.recordMutation(repositories, {
        actorId: actor.id,
        action: "admin.mechanic.forced_unavailable",
        entityId: id,
        reason: parsed.reason,
        metadata: { resource_id: id, field: "is_available", status: "unavailable" },
        now
      });
      await completeCommand(
        repositories,
        actor.id,
        "admin.mechanic.force_unavailable",
        idempotencyKey,
        response,
        id,
        now
      );
      return response;
    });
  }

  private changeStatus(
    identity: VerifiedSupabaseIdentity,
    mechanicId: string,
    input: unknown,
    idempotencyKey: string,
    policy: {
      scope: string;
      action: string;
      allowed: MechanicProfileStatus[];
      next: MechanicProfileStatus;
      guardActiveAssignment: boolean;
    }
  ): Promise<AdminMechanicSummaryResponse> {
    const id = parseUuid(mechanicId);
    const parsed = parseReason(input);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.now();
      const replay = await this.prepareCommand(
        repositories,
        actor.id,
        policy.scope,
        idempotencyKey,
        { mechanic_id: id, reason: parsed.reason },
        now
      );
      if (replay) return replay as AdminMechanicSummaryResponse;
      const target =
        await repositories.mechanics.findProfileByUserIdForUpdate(id);
      if (!target) throw notFound();
      if (!policy.allowed.includes(target.profileStatus)) {
        throw conflict(
          `Mechanic cannot transition from ${target.profileStatus} to ${policy.next}.`
        );
      }
      await requireMechanicRole(repositories.users, id);
      if (
        policy.guardActiveAssignment &&
        (await repositories.assignments.findUnfinishedByMechanicForUpdate(id))
      ) {
        throw conflict(
          "Mechanic status cannot change while an active assignment exists."
        );
      }
      if (policy.next !== "active") await repositories.mechanics.updateAvailability(id, false, now);
      const updated = await repositories.mechanics.updateProfileStatus(
        id,
        policy.next,
        now
      );
      if (!updated) throw notFound();
      const response = await this.summaryResponse(repositories, updated, now);
      await this.recordMutation(repositories, {
        actorId: actor.id,
        action: policy.action,
        entityId: id,
        reason: parsed.reason,
        metadata: {
          resource_id: id,
          previous_status: target.profileStatus,
          next_status: policy.next
        },
        now
      });
      await completeCommand(
        repositories,
        actor.id,
        policy.scope,
        idempotencyKey,
        response,
        id,
        now
      );
      return response;
    });
  }

  private async summaryResponse(
    repositories: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0],
    profile: MechanicProfile,
    now: Date
  ) {
    const performance = await repositories.mechanics.getAdminPerformance(
      profile.userId
    );
    if (!performance) throw notFound();
    return toSummary(profile, performance, now);
  }

  private async prepareCommand(
    repositories: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0],
    actorId: string,
    scope: string,
    idempotencyKey: string,
    request: unknown,
    now: Date
  ): Promise<Record<string, unknown> | undefined> {
    const decision = await prepareIdempotency(repositories.idempotency, {
      actorId,
      scope,
      idempotencyKey,
      request,
      expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
      id: this.createId()
    });
    if (decision.action === "conflict") {
      throw conflict("Idempotency key was already used with different input.");
    }
    if (decision.action === "in_progress") {
      throw conflict("An operation with this idempotency key is in progress.");
    }
    return decision.action === "replay" ? decision.responseBody : undefined;
  }

  private async recordMutation(
    repositories: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0],
    input: {
      actorId: string;
      action: string;
      entityId: string;
      reason: string;
      metadata: Record<string, unknown>;
      now: Date;
    }
  ) {
    const occurrenceId = this.createId();
    await repositories.outbox.append({
      id: occurrenceId,
      topic: input.action,
      aggregateType: "mechanic_profile",
      aggregateId: input.entityId,
      dedupeKey: `${input.action}:${input.entityId}:${occurrenceId}`,
      payload: input.metadata,
      createdAt: input.now,
      nextAttemptAt: input.now
    });
    await repositories.audit.append({
      id: this.createId(),
      actorId: input.actorId,
      actorRole: "admin",
      action: input.action,
      entityType: "mechanic_profile",
      entityId: input.entityId,
      adminReason: input.reason,
      metadata: input.metadata,
      createdAt: input.now
    });
  }

  private now() {
    return this.options.now?.() ?? new Date();
  }

  private createId() {
    return (this.options.createId ?? randomUUID)();
  }
}

export class AdminMechanicManagementError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT"
    >,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AdminMechanicManagementError";
  }
}

function parseListFilters(input: unknown) {
  const parsed = adminMechanicListFilterSchema.safeParse(input);
  if (!parsed.success) throw invalid("Mechanic list filters are invalid.");
  return {
    limit: parsed.data.limit,
    ...(parsed.data.cursor ? { cursor: decodeCursor(parsed.data.cursor) } : {}),
    ...(parsed.data.profile_status
      ? { profileStatus: parsed.data.profile_status }
      : {}),
    ...(parsed.data.service_type ? { serviceType: parsed.data.service_type } : {}),
    ...(parsed.data.is_available !== undefined
      ? { isAvailable: parsed.data.is_available }
      : {}),
    ...(parsed.data.location_freshness
      ? { locationFreshness: parsed.data.location_freshness }
      : {}),
    ...(parsed.data.work_state ? { workState: parsed.data.work_state } : {})
  };
}

function parsePagination(input: unknown) {
  const parsed = adminPaginationSchema.safeParse(input);
  if (!parsed.success) throw invalid("Pagination input is invalid.");
  return {
    limit: parsed.data.limit,
    ...(parsed.data.cursor ? { cursor: decodeCursor(parsed.data.cursor) } : {})
  };
}

function parseReason(input: unknown) {
  const parsed = adminReasonSchema.safeParse(input);
  if (!parsed.success) {
    throw invalid("A valid administrative reason is required.");
  }
  return parsed.data;
}

function parseUuid(value: string) {
  const parsed = adminUuidSchema.safeParse(value);
  if (!parsed.success) throw invalid("Mechanic identifier is invalid.");
  return parsed.data;
}

function toSummaryFromList(
  profile: AdminMechanicSummary,
  now: Date
): AdminMechanicSummaryResponse {
  return toSummary(
    profile,
    {
      totalAssignments: profile.hasActiveAssignment ? 1 : 0,
      activeAssignments: profile.hasActiveAssignment ? 1 : 0,
      completedAssignments: 0,
      canceledAssignments: 0,
      ratingAvg: profile.ratingAvg,
      ratingCount: profile.ratingCount
    },
    now
  );
}

function toSummary(
  profile: MechanicProfile,
  performance: AdminMechanicPerformance,
  now: Date
): AdminMechanicSummaryResponse {
  return {
    user_id: profile.userId,
    profile_status: profile.profileStatus,
    is_available: profile.isAvailable,
    service_radius_km: profile.serviceRadiusKm,
    service_types: [...profile.serviceTypes].sort(),
    location_freshness: locationFreshness(profile, now),
    work_state:
      performance.activeAssignments > 0 ? "active_assignment" : "idle",
    rating_avg: profile.ratingAvg,
    rating_count: profile.ratingCount,
    availability_updated_at: profile.availabilityUpdatedAt.toISOString(),
    created_at: profile.createdAt.toISOString(),
    updated_at: profile.updatedAt.toISOString()
  };
}

function locationFreshness(
  profile: MechanicProfile,
  now: Date
): MechanicLocationFreshness {
  if (!profile.locationUpdatedAt) return "missing";
  return now.getTime() - profile.locationUpdatedAt.getTime() <=
    LOCATION_MAX_AGE_SECONDS * 1000
    ? "fresh"
    : "stale";
}

function toWorkHistoryResponse(
  item: AdminMechanicWorkHistoryItem
): AdminMechanicWorkHistoryResponse {
  return {
    assignment_id: item.id,
    request_id: item.requestId,
    status: item.status,
    accepted_at: item.acceptedAt.toISOString(),
    ...(item.startedAt ? { started_at: item.startedAt.toISOString() } : {}),
    ...(item.completedAt
      ? { completed_at: item.completedAt.toISOString() }
      : {}),
    ...(item.canceledAt ? { canceled_at: item.canceledAt.toISOString() } : {}),
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString()
  };
}

function toPerformanceResponse(
  mechanicId: string,
  performance: AdminMechanicPerformance
): AdminMechanicPerformanceResponse {
  return {
    mechanic_id: mechanicId,
    assignments: {
      total: performance.totalAssignments,
      active: performance.activeAssignments,
      completed: performance.completedAssignments,
      canceled: performance.canceledAssignments
    },
    trusted_rating: {
      average: performance.ratingAvg,
      count: performance.ratingCount
    }
  };
}

function toPage<T>(
  items: T[],
  limit: number,
  nextCursor?: AdminMechanicCursor
): AdminMechanicPageResponse<T> {
  return {
    items,
    page: {
      limit,
      has_more: Boolean(nextCursor),
      ...(nextCursor ? { next_cursor: encodeCursor(nextCursor) } : {})
    }
  };
}

function encodeCursor(cursor: AdminMechanicCursor) {
  return Buffer.from(
    JSON.stringify({ timestamp: cursor.timestamp.toISOString(), id: cursor.id })
  ).toString("base64url");
}

function decodeCursor(value: string): AdminMechanicCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      timestamp?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.timestamp !== "string" ||
      Number.isNaN(new Date(parsed.timestamp).getTime()) ||
      typeof parsed.id !== "string" ||
      !adminUuidSchema.safeParse(parsed.id).success
    ) {
      throw new Error("INVALID_CURSOR");
    }
    return { timestamp: new Date(parsed.timestamp), id: parsed.id };
  } catch {
    throw invalid("Cursor is invalid.");
  }
}

async function completeCommand(
  repositories: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0],
  actorId: string,
  scope: string,
  idempotencyKey: string,
  response: object,
  resourceId: string,
  now: Date
) {
  await repositories.idempotency.complete({
    actorId,
    scope,
    idempotencyKey,
    responseStatus: 200,
    responseBody: response as Record<string, unknown>,
    resourceType: "mechanic_profile",
    resourceId,
    completedAt: now
  });
}

function invalid(message: string) {
  return new AdminMechanicManagementError("INVALID_INPUT", message, 400);
}

function notFound() {
  return new AdminMechanicManagementError(
    "NOT_FOUND",
    "Mechanic profile not found.",
    404
  );
}

function conflict(message: string) {
  return new AdminMechanicManagementError("CONFLICT", message, 409);
}

async function requireMechanicRole(users: UserRepository, id: string): Promise<void> {
  const user = await users.findActorById(id);
  if (!user?.roles.includes("mechanic")) throw conflict("The user no longer has the mechanic role.");
}
