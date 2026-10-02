import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import { prepareIdempotency } from "@/lib/idempotency";
import type { VerifiedSupabaseIdentity, UserRole, UserStatus } from "@/features/auth/auth.types";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { INITIAL_MECHANIC_SERVICE_RADIUS_KM } from "@/server/repositories/contracts/mechanic.repository";
import type {
  AdminDeviceSummary,
  AdminUserActivity,
  AdminUserCursor,
  ApplicationActor,
  UserDevice
} from "@/server/repositories/contracts/user.repository";

import { loadActiveAdminActor } from "./admin.authorization";
import {
  adminPaginationSchema,
  adminDateRangeSchema,
  adminReasonSchema,
  adminRoleMutationSchema,
  adminUserListFilterSchema,
  adminUuidSchema
} from "./admin.schemas";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type AdminUserSummaryResponse = {
  id: string;
  display_name?: string;
  phone_masked?: string;
  status: UserStatus;
  roles: UserRole[];
  device_summary: {
    total: number;
    enabled: number;
  };
  created_at: string;
  updated_at: string;
};

export type AdminUserDeviceResponse = {
  id: string;
  user_id: string;
  device_key_fingerprint: string;
  platform: string;
  enabled: boolean;
  last_registered_at: string;
  created_at: string;
  updated_at: string;
};

export type AdminUserActivityResponse = {
  id: string;
  actor_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

export type AdminPageResponse<T> = {
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

export class AdminUserManagementService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: ServiceOptions = {}
  ) {}

  listUsers(
    identity: VerifiedSupabaseIdentity,
    input: unknown
  ): Promise<AdminPageResponse<AdminUserSummaryResponse>> {
    const filters = parseUserFilters(input);
    return this.unitOfWork.execute(async ({ users }) => {
      await loadActiveAdminActor(identity, users);
      const page = await users.listAdminUsers(filters);
      const items = await Promise.all(
        page.items.map(async (user) =>
          toUserResponse(user, await users.deviceSummary(user.id))
        )
      );
      return toPage(items, filters.limit, page.nextCursor);
    });
  }

  getUser(
    identity: VerifiedSupabaseIdentity,
    userId: string
  ): Promise<AdminUserSummaryResponse> {
    const id = parseUuid(userId, "User identifier is invalid.");
    return this.unitOfWork.execute(async ({ users }) => {
      await loadActiveAdminActor(identity, users);
      const user = await users.findActorById(id);
      if (!user) throw notFound("User not found.");
      return toUserResponse(user, await users.deviceSummary(id));
    });
  }

  listDevices(
    identity: VerifiedSupabaseIdentity,
    userId: string,
    input: unknown
  ): Promise<AdminPageResponse<AdminUserDeviceResponse>> {
    const id = parseUuid(userId, "User identifier is invalid.");
    const pagination = parsePagination(input);
    return this.unitOfWork.execute(async ({ users }) => {
      await loadActiveAdminActor(identity, users);
      if (!(await users.findById(id))) throw notFound("User not found.");
      const page = await users.listDevicesForAdmin({
        userId: id,
        limit: pagination.limit,
        ...(pagination.cursor ? { cursor: pagination.cursor } : {})
      });
      return toPage(
        page.items.map(toDeviceResponse),
        pagination.limit,
        page.nextCursor
      );
    });
  }

  listActivity(
    identity: VerifiedSupabaseIdentity,
    userId: string,
    input: unknown
  ): Promise<AdminPageResponse<AdminUserActivityResponse>> {
    const id = parseUuid(userId, "User identifier is invalid.");
    const filters = parseActivityFilters(input);
    return this.unitOfWork.execute(async ({ users }) => {
      await loadActiveAdminActor(identity, users);
      if (!(await users.findById(id))) throw notFound("User not found.");
      const page = await users.listAdminActivity({
        userId: id,
        limit: filters.limit,
        ...(filters.cursor ? { cursor: filters.cursor } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {})
      });
      return toPage(
        page.items.map(toActivityResponse),
        filters.limit,
        page.nextCursor
      );
    });
  }

  suspendUser(
    identity: VerifiedSupabaseIdentity,
    userId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminUserSummaryResponse> {
    return this.changeStatus(identity, userId, input, idempotencyKey, {
      action: "admin.user.suspended",
      scope: "admin.user.suspend",
      allowed: ["active"],
      next: "suspended",
      guardLastAdmin: true
    });
  }

  reactivateUser(
    identity: VerifiedSupabaseIdentity,
    userId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminUserSummaryResponse> {
    return this.changeStatus(identity, userId, input, idempotencyKey, {
      action: "admin.user.reactivated",
      scope: "admin.user.reactivate",
      allowed: ["suspended"],
      next: "active",
      guardLastAdmin: false
    });
  }

  archiveUser(
    identity: VerifiedSupabaseIdentity,
    userId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminUserSummaryResponse> {
    return this.changeStatus(identity, userId, input, idempotencyKey, {
      action: "admin.user.archived",
      scope: "admin.user.archive",
      allowed: ["active", "suspended"],
      next: "archived",
      guardLastAdmin: true
    });
  }

  grantRole(
    identity: VerifiedSupabaseIdentity,
    userId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminUserSummaryResponse> {
    return this.changeRole(identity, userId, input, idempotencyKey, "grant");
  }

  revokeRole(
    identity: VerifiedSupabaseIdentity,
    userId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminUserSummaryResponse> {
    return this.changeRole(identity, userId, input, idempotencyKey, "revoke");
  }

  revokeDevice(
    identity: VerifiedSupabaseIdentity,
    deviceId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminUserDeviceResponse> {
    const id = parseUuid(deviceId, "Device identifier is invalid.");
    const parsed = parseReason(input);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.now();
      const replay = await this.prepareCommand(
        repositories,
        actor.id,
        "admin.device.revoke",
        idempotencyKey,
        { device_id: id, reason: parsed.reason },
        now
      );
      if (replay) return replay as AdminUserDeviceResponse;

      const device = await repositories.users.findDeviceForUpdate(id);
      if (!device) throw notFound("Device not found.");
      if (!device.enabled) throw conflict("Device is already revoked.");
      const updated = await repositories.users.revokeDevice(id, now);
      await repositories.deviceDeliveryCredentials.disableForDevice({
        deviceId: id,
        reason: "admin_revoked",
        disabledAt: now
      });
      const response = toDeviceResponse(updated);
      await this.recordMutation(repositories, {
        actorId: actor.id,
        action: "admin.device.revoked",
        entityType: "user_device",
        entityId: id,
        userId: device.userId,
        reason: parsed.reason,
        metadata: { device_id: id, user_id: device.userId, enabled: false },
        now
      });
      await completeCommand(
        repositories,
        actor.id,
        "admin.device.revoke",
        idempotencyKey,
        response,
        "user_device",
        id,
        now
      );
      return response;
    });
  }

  private changeStatus(
    identity: VerifiedSupabaseIdentity,
    userId: string,
    input: unknown,
    idempotencyKey: string,
    policy: {
      action: string;
      scope: string;
      allowed: UserStatus[];
      next: UserStatus;
      guardLastAdmin: boolean;
    }
  ): Promise<AdminUserSummaryResponse> {
    const id = parseUuid(userId, "User identifier is invalid.");
    const parsed = parseReason(input);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.now();
      const replay = await this.prepareCommand(
        repositories,
        actor.id,
        policy.scope,
        idempotencyKey,
        { user_id: id, reason: parsed.reason },
        now
      );
      if (replay) return replay as AdminUserSummaryResponse;

      if (policy.guardLastAdmin) await repositories.users.acquireLastAdminGuard();
      const target = await repositories.users.findActorForUpdate(id);
      if (!target) throw notFound("User not found.");
      if (!policy.allowed.includes(target.status)) {
        throw conflict(`User cannot transition from ${target.status} to ${policy.next}.`);
      }
      if (
        policy.guardLastAdmin &&
        target.status === "active" &&
        target.roles.includes("admin") &&
        (await repositories.users.countActiveAdmins()) <= 1
      ) {
        throw conflict("The last active administrator cannot be disabled.");
      }

      const updated = await repositories.users.updateStatus(id, policy.next, now);
      const response = toUserResponse(
        updated,
        await repositories.users.deviceSummary(id)
      );
      await this.recordMutation(repositories, {
        actorId: actor.id,
        action: policy.action,
        entityType: "app_user",
        entityId: id,
        userId: id,
        reason: parsed.reason,
        metadata: {
          user_id: id,
          previous_status: target.status,
          new_status: policy.next
        },
        now
      });
      await completeCommand(
        repositories,
        actor.id,
        policy.scope,
        idempotencyKey,
        response,
        "app_user",
        id,
        now
      );
      return response;
    });
  }

  private changeRole(
    identity: VerifiedSupabaseIdentity,
    userId: string,
    input: unknown,
    idempotencyKey: string,
    mode: "grant" | "revoke"
  ): Promise<AdminUserSummaryResponse> {
    const id = parseUuid(userId, "User identifier is invalid.");
    const parsed = adminRoleMutationSchema.safeParse(input);
    if (!parsed.success) throw invalid("Role mutation input is invalid.");
    const scope = `admin.user.role.${mode}`;
    const action = `admin.user.role.${mode === "grant" ? "granted" : "revoked"}`;

    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.now();
      const replay = await this.prepareCommand(
        repositories,
        actor.id,
        scope,
        idempotencyKey,
        { user_id: id, role: parsed.data.role, reason: parsed.data.reason },
        now
      );
      if (replay) return replay as AdminUserSummaryResponse;

      if (mode === "revoke" && parsed.data.role === "admin") {
        await repositories.users.acquireLastAdminGuard();
      }
      const target = await repositories.users.findActorForUpdate(id);
      if (!target) throw notFound("User not found.");
      if (target.status === "archived") {
        throw conflict("Roles cannot be changed for an archived user.");
      }
      if (
        mode === "revoke" &&
        parsed.data.role === "admin" &&
        target.status === "active" &&
        (await repositories.users.countActiveAdmins()) <= 1
      ) {
        throw conflict("The last active administrator role cannot be revoked.");
      }

      if (parsed.data.role === "mechanic") {
        const profile = await repositories.mechanics.findProfileByUserIdForUpdate(id);
        if (mode === "revoke" && await repositories.assignments.findUnfinishedByMechanicForUpdate(id)) {
          throw conflict("Mechanic role cannot be revoked while unfinished work or appointments exist.");
        }
        if (mode === "revoke" && profile && target.roles.includes("mechanic")) {
          await repositories.mechanics.updateAvailability(id, false, now);
          if (profile.profileStatus === "active") {
            await repositories.mechanics.updateProfileStatus(id, "suspended", now);
          }
        }
      }
      const changed =
        mode === "grant"
          ? await repositories.users.grantRole(id, parsed.data.role)
          : await repositories.users.revokeRole(id, parsed.data.role);
      if (!changed) {
        throw conflict(
          mode === "grant" ? "User already has this role." : "User does not have this role."
        );
      }
      if (parsed.data.role === "mechanic") {
        const profile = await repositories.mechanics.findProfileByUserId(id);
        if (mode === "grant" && !profile) {
          await repositories.mechanics.createProfile({
            userId: id,
            profileStatus: "pending",
            isAvailable: false,
            serviceRadiusKm: INITIAL_MECHANIC_SERVICE_RADIUS_KM,
            availabilityUpdatedAt: now,
            createdAt: now,
            updatedAt: now
          });
        } else if (mode === "grant" && profile) {
          await repositories.mechanics.updateAvailability(id, false, now);
          if (profile.profileStatus === "active") await repositories.mechanics.updateProfileStatus(id, "suspended", now);
        }
      }
      const updated = await repositories.users.findActorById(id);
      if (!updated) throw notFound("User not found.");
      const response = toUserResponse(
        updated,
        await repositories.users.deviceSummary(id)
      );
      await this.recordMutation(repositories, {
        actorId: actor.id,
        action,
        entityType: "app_user",
        entityId: id,
        userId: id,
        reason: parsed.data.reason,
        metadata: { user_id: id, role: parsed.data.role, change: mode },
        now
      });
      await completeCommand(
        repositories,
        actor.id,
        scope,
        idempotencyKey,
        response,
        "app_user",
        id,
        now
      );
      return response;
    });
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
      entityType: string;
      entityId: string;
      userId: string;
      reason: string;
      metadata: Record<string, unknown>;
      now: Date;
    }
  ): Promise<void> {
    const occurrenceId = this.createId();
    await repositories.outbox.append({
      id: occurrenceId,
      topic: input.action,
      aggregateType: input.entityType,
      aggregateId: input.entityId,
      dedupeKey: `${input.action}:${input.entityId}:${occurrenceId}`,
      payload: { ...input.metadata, user_id: input.userId },
      nextAttemptAt: input.now,
      createdAt: input.now
    });
    await repositories.audit.append({
      id: this.createId(),
      actorId: input.actorId,
      actorRole: "admin",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      adminReason: input.reason,
      metadata: input.metadata,
      createdAt: input.now
    });
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private createId(): string {
    return (this.options.createId ?? randomUUID)();
  }
}

export class AdminUserManagementError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT"
    >,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AdminUserManagementError";
  }
}

function parseUserFilters(input: unknown) {
  const parsed = adminUserListFilterSchema.safeParse(input);
  if (!parsed.success) throw invalid("User list filters are invalid.");
  return {
    limit: parsed.data.limit,
    ...(parsed.data.cursor ? { cursor: decodeCursor(parsed.data.cursor) } : {}),
    ...(parsed.data.role ? { role: parsed.data.role } : {}),
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.query ? { query: parsed.data.query } : {}),
    ...(parsed.data.from ? { from: new Date(parsed.data.from) } : {}),
    ...(parsed.data.to ? { to: new Date(parsed.data.to) } : {})
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

function parseActivityFilters(input: unknown) {
  const source =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const pagination = adminPaginationSchema.safeParse({
    cursor: source.cursor,
    limit: source.limit
  });
  const dates = adminDateRangeSchema.safeParse({
    from: source.from,
    to: source.to
  });
  if (!pagination.success || !dates.success) {
    throw invalid("Activity filters are invalid.");
  }
  return {
    limit: pagination.data.limit,
    ...(pagination.data.cursor
      ? { cursor: decodeCursor(pagination.data.cursor) }
      : {}),
    ...(dates.data.from ? { from: new Date(dates.data.from) } : {}),
    ...(dates.data.to ? { to: new Date(dates.data.to) } : {})
  };
}

function parseReason(input: unknown) {
  const parsed = adminReasonSchema.safeParse(input);
  if (!parsed.success) throw invalid("A valid administrative reason is required.");
  return parsed.data;
}

function parseUuid(value: string, message: string): string {
  const parsed = adminUuidSchema.safeParse(value);
  if (!parsed.success) throw invalid(message);
  return parsed.data;
}

function toUserResponse(
  user: ApplicationActor,
  devices: AdminDeviceSummary
): AdminUserSummaryResponse {
  return {
    id: user.id,
    ...(user.displayName ? { display_name: user.displayName } : {}),
    ...(user.phoneMasked ? { phone_masked: user.phoneMasked } : {}),
    status: user.status,
    roles: [...user.roles].sort(),
    device_summary: devices,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString()
  };
}

function toDeviceResponse(device: UserDevice): AdminUserDeviceResponse {
  return {
    id: device.id,
    user_id: device.userId,
    device_key_fingerprint: device.deviceKeyHash.slice(0, 12),
    platform: device.platform,
    enabled: device.enabled,
    last_registered_at: device.lastRegisteredAt.toISOString(),
    created_at: device.createdAt.toISOString(),
    updated_at: device.updatedAt.toISOString()
  };
}

function toActivityResponse(activity: AdminUserActivity): AdminUserActivityResponse {
  const allowedMetadata = [
    "user_id",
    "device_id",
    "role",
    "change",
    "previous_status",
    "new_status",
    "enabled",
    "outcome"
  ];
  return {
    id: activity.id,
    ...(activity.actorId ? { actor_id: activity.actorId } : {}),
    action: activity.action,
    entity_type: activity.entityType,
    ...(activity.entityId ? { entity_id: activity.entityId } : {}),
    metadata: Object.fromEntries(
      allowedMetadata
        .filter((key) => Object.hasOwn(activity.metadata, key))
        .map((key) => [key, activity.metadata[key]])
    ),
    occurred_at: activity.createdAt.toISOString()
  };
}

function toPage<T>(
  items: T[],
  limit: number,
  nextCursor?: AdminUserCursor
): AdminPageResponse<T> {
  return {
    items,
    page: {
      limit,
      has_more: Boolean(nextCursor),
      ...(nextCursor ? { next_cursor: encodeCursor(nextCursor) } : {})
    }
  };
}

function encodeCursor(cursor: AdminUserCursor): string {
  return Buffer.from(
    JSON.stringify({ timestamp: cursor.timestamp.toISOString(), id: cursor.id })
  ).toString("base64url");
}

function decodeCursor(value: string): AdminUserCursor {
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
  resourceType: string,
  resourceId: string,
  now: Date
): Promise<void> {
  await repositories.idempotency.complete({
    actorId,
    scope,
    idempotencyKey,
    responseStatus: 200,
    responseBody: response as Record<string, unknown>,
    resourceType,
    resourceId,
    completedAt: now
  });
}

function invalid(message: string): AdminUserManagementError {
  return new AdminUserManagementError("INVALID_INPUT", message, 400);
}

function notFound(message: string): AdminUserManagementError {
  return new AdminUserManagementError("NOT_FOUND", message, 404);
}

function conflict(message: string): AdminUserManagementError {
  return new AdminUserManagementError("CONFLICT", message, 409);
}
