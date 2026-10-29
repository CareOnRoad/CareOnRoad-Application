import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import { isPastOrTodayVietnam } from "@/lib/vietnam-date";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import {
  motorcycleDetailColumns,
  type Motorcycle,
  type MotorcycleDetails,
  type MotorcycleDetailsPatch
} from "@/server/repositories/contracts/motorcycle.repository";
import type { ServiceRequest } from "@/server/repositories/contracts/service-request.repository";

import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import { requireActorRole } from "../auth/authorization";
import { hasPlan, planRequiredDetails } from "../plans/plan";
import {
  motorcycleDetailsPatchSchema,
  motorcycleInputSchema,
  type MotorcycleDetailsPatchInput,
  type MotorcycleInput
} from "./motorcycle.schemas";

const MAX_PURCHASE_AGE_DAYS = 36500;

export type MotorcycleResponse = {
  id: string;
  rider_id: string;
  brand_text: string;
  model_text: string;
  license_plate?: string;
  year?: number;
  notes?: string;
  // Rider-private VIP details, only non-null keys (snake_case); `{}` when none are set.
  details: Record<string, string | number>;
  last_maintenance_at?: string;
  next_maintenance_at?: string;
  created_at: string;
  updated_at: string;
};

const UPCOMING_SERVICE_REQUEST_STATUSES: readonly ServiceRequest["status"][] = [
  "submitted",
  "dispatching",
  "offered",
  "assigned",
  "mechanic_en_route",
  "in_service",
  "awaiting_quote_approval",
  "awaiting_payment"
];

export class MotorcycleService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: { now?: () => Date; createId?: () => string } = {}
  ) {}

  async createMotorcycle(
    identity: VerifiedSupabaseIdentity,
    input: unknown
  ): Promise<MotorcycleResponse> {
    const parsed = parseMotorcycleInput(input);

    return await this.unitOfWork.execute(async ({ audit, motorcycles, outbox, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const motorcycle = await motorcycles.create({
        ...toRepositoryInput(parsed),
        id: createId(),
        riderId: actor.id,
        createdAt: now,
        updatedAt: now
      });
      const occurrenceId = createId();

      await outbox.append({
        id: occurrenceId,
        topic: "motorcycle.created",
        aggregateType: "motorcycle",
        aggregateId: motorcycle.id,
        dedupeKey: `motorcycle.created:${motorcycle.id}:${occurrenceId}`,
        payload: { resource_id: motorcycle.id, rider_id: actor.id },
        createdAt: now,
        nextAttemptAt: now
      });
      await audit.append({
        id: createId(),
        actorId: actor.id,
        actorRole: "rider",
        action: "motorcycle.created",
        entityType: "motorcycle",
        entityId: motorcycle.id,
        metadata: { resource_id: motorcycle.id, rider_id: actor.id },
        createdAt: now
      });

      return toMotorcycleResponse(motorcycle, { lastMaintenanceAt: undefined, nextMaintenanceAt: undefined });
    });
  }

  listMotorcycles(identity: VerifiedSupabaseIdentity): Promise<{ items: MotorcycleResponse[] }> {
    return this.unitOfWork.execute(async ({ motorcycles, reminders, serviceRequests, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const now = this.options.now?.() ?? new Date();
      const items = await motorcycles.listActiveByRider(actor.id);
      if (items.length === 0) {
        return { items: [] };
      }
      const motorcycleIds = items.map((motorcycle) => motorcycle.id);
      const maintenance = await deriveMaintenanceDates({
        serviceRequests,
        reminders,
        motorcycleIds,
        now
      });
      return {
        items: items.map((motorcycle) =>
          toMotorcycleResponse(motorcycle, maintenance.get(motorcycle.id))
        )
      };
    });
  }

  getMotorcycle(
    identity: VerifiedSupabaseIdentity,
    motorcycleId: string
  ): Promise<MotorcycleResponse> {
    return this.unitOfWork.execute(async ({ motorcycles, reminders, serviceRequests, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const motorcycle = await loadOwnedMotorcycle(motorcycles, motorcycleId, actor.id);
      const now = this.options.now?.() ?? new Date();
      const maintenance = await deriveMaintenanceDates({
        serviceRequests,
        reminders,
        motorcycleIds: [motorcycle.id],
        now
      });
      return toMotorcycleResponse(motorcycle, maintenance.get(motorcycle.id));
    });
  }

  async updateMotorcycle(
    identity: VerifiedSupabaseIdentity,
    motorcycleId: string,
    input: unknown
  ): Promise<MotorcycleResponse> {
    const parsed = parseMotorcycleInput(input);

    return await this.unitOfWork.execute(async ({ audit, motorcycles, outbox, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      await loadOwnedMotorcycle(motorcycles, motorcycleId, actor.id);
      const now = this.options.now?.() ?? new Date();
      const updated = await motorcycles.update({
        ...toRepositoryInput(parsed),
        id: motorcycleId,
        updatedAt: now
      });
      if (!updated) {
        throw new MotorcycleError("NOT_FOUND", "Motorcycle not found.", 404);
      }
      const createId = this.options.createId ?? randomUUID;
      const occurrenceId = createId();

      await outbox.append({
        id: occurrenceId,
        topic: "motorcycle.updated",
        aggregateType: "motorcycle",
        aggregateId: updated.id,
        dedupeKey: `motorcycle.updated:${updated.id}:${occurrenceId}`,
        payload: { resource_id: updated.id, rider_id: actor.id },
        createdAt: now,
        nextAttemptAt: now
      });
      await audit.append({
        id: createId(),
        actorId: actor.id,
        actorRole: "rider",
        action: "motorcycle.updated",
        entityType: "motorcycle",
        entityId: updated.id,
        metadata: { resource_id: updated.id, rider_id: actor.id },
        createdAt: now
      });

      return toMotorcycleResponse(updated, { lastMaintenanceAt: undefined, nextMaintenanceAt: undefined });
    });
  }

  async updateMotorcycleDetails(
    identity: VerifiedSupabaseIdentity,
    motorcycleId: string,
    input: unknown
  ): Promise<MotorcycleResponse> {
    const parsed = parseDetailsPatch(input);

    return await this.unitOfWork.execute(async ({ audit, motorcycles, outbox, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      await loadOwnedMotorcycle(motorcycles, motorcycleId, actor.id);
      const now = this.options.now?.() ?? new Date();
      if (parsed.purchase_date && !isPastOrTodayVietnam(parsed.purchase_date, now, MAX_PURCHASE_AGE_DAYS)) {
        throw new MotorcycleError("INVALID_INPUT", "purchase_date must be today or earlier (Vietnam time) and within 100 years.", 400);
      }
      const sent = Object.entries(parsed).filter(([, value]) => value !== undefined);
      // D14: clearing (null) stays allowed without a plan; writing a value needs vip.
      if (sent.some(([, value]) => value !== null) && !hasPlan(actor, "vip", now)) {
        throw new MotorcycleError("FORBIDDEN", "A higher plan is required.", 403, planRequiredDetails("vip"));
      }
      const updated = await motorcycles.updateDetails({
        id: motorcycleId,
        patch: toDetailsPatch(parsed),
        updatedAt: now
      });
      if (!updated) {
        throw new MotorcycleError("NOT_FOUND", "Motorcycle not found.", 404);
      }
      const createId = this.options.createId ?? randomUUID;
      const occurrenceId = createId();
      // Column names only: the values are rider-private and must never reach audit/outbox/logs.
      const metadata = {
        resource_id: updated.id,
        rider_id: actor.id,
        changed_fields: sent.map(([column]) => column)
      };

      await outbox.append({
        id: occurrenceId,
        topic: "motorcycle.details_updated",
        aggregateType: "motorcycle",
        aggregateId: updated.id,
        dedupeKey: `motorcycle.details_updated:${updated.id}:${occurrenceId}`,
        payload: metadata,
        createdAt: now,
        nextAttemptAt: now
      });
      await audit.append({
        id: createId(),
        actorId: actor.id,
        actorRole: "rider",
        action: "motorcycle.details_updated",
        entityType: "motorcycle",
        entityId: updated.id,
        metadata,
        createdAt: now
      });

      return toMotorcycleResponse(updated);
    });
  }

  archiveMotorcycle(identity: VerifiedSupabaseIdentity, motorcycleId: string): Promise<void> {
    return this.unitOfWork.execute(async ({ audit, motorcycles, outbox, reminders, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      await loadOwnedMotorcycle(motorcycles, motorcycleId, actor.id);
      const now = this.options.now?.() ?? new Date();
      const archived = await motorcycles.archive(motorcycleId, now);
      for (const rule of await reminders.listRulesByRider(actor.id)) {
        if (rule.motorcycleId === motorcycleId) await reminders.disableRule({ id: rule.id, updatedAt: now });
      }
      if (!archived) {
        throw new MotorcycleError("NOT_FOUND", "Motorcycle not found.", 404);
      }
      const createId = this.options.createId ?? randomUUID;
      const occurrenceId = createId();

      await outbox.append({
        id: occurrenceId,
        topic: "motorcycle.archived",
        aggregateType: "motorcycle",
        aggregateId: archived.id,
        dedupeKey: `motorcycle.archived:${archived.id}:${occurrenceId}`,
        payload: { resource_id: archived.id, rider_id: actor.id },
        createdAt: now,
        nextAttemptAt: now
      });
      await audit.append({
        id: createId(),
        actorId: actor.id,
        actorRole: "rider",
        action: "motorcycle.archived",
        entityType: "motorcycle",
        entityId: archived.id,
        metadata: { resource_id: archived.id, rider_id: actor.id },
        createdAt: now
      });
    });
  }
}

export class MotorcycleError extends Error {
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
    this.name = "MotorcycleError";
  }
}

function parseMotorcycleInput(input: unknown): MotorcycleInput {
  const parsed = motorcycleInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new MotorcycleError("INVALID_INPUT", "Motorcycle input is invalid.", 400, {
      issues: parsed.error.issues
    });
  }
  return parsed.data;
}

function parseDetailsPatch(input: unknown): MotorcycleDetailsPatchInput {
  const parsed = motorcycleDetailsPatchSchema.safeParse(input);
  if (!parsed.success) {
    throw new MotorcycleError("INVALID_INPUT", "Motorcycle details input is invalid.", 400, {
      issues: parsed.error.issues
    });
  }
  return parsed.data;
}

const detailKeyByColumn = Object.fromEntries(
  Object.entries(motorcycleDetailColumns).map(([key, column]) => [column, key])
) as Record<string, keyof MotorcycleDetails>;

function toDetailsPatch(input: MotorcycleDetailsPatchInput): MotorcycleDetailsPatch {
  return Object.fromEntries(
    Object.entries(input).map(([column, value]) => [detailKeyByColumn[column], value])
  );
}

function toRepositoryInput(input: MotorcycleInput) {
  return {
    brandText: input.brand_text,
    modelText: input.model_text,
    licensePlate: input.license_plate,
    year: input.year,
    notes: input.notes
  };
}

async function loadRiderActor(
  users: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["users"],
  actorId: string
) {
  const actor = await users.findActorById(actorId);
  if (!actor) {
    throw new MotorcycleError("NOT_FOUND", "Application profile not found.", 404);
  }
  try {
    requireActorRole(
      {
        id: actor.id,
        ...(actor.displayName ? { display_name: actor.displayName } : {}),
        roles: actor.roles,
        status: actor.status
      },
      "rider"
    );
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && "errorCode" in error) {
      throw error;
    }
    throw error;
  }
  return actor;
}

async function loadOwnedMotorcycle(
  motorcycles: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["motorcycles"],
  motorcycleId: string,
  riderId: string
): Promise<Motorcycle> {
  const motorcycle = await motorcycles.findById(motorcycleId);
  if (!motorcycle || motorcycle.archivedAt) {
    throw new MotorcycleError("NOT_FOUND", "Motorcycle not found.", 404);
  }
  if (motorcycle.riderId !== riderId) {
    throw new MotorcycleError("FORBIDDEN", "Motorcycle ownership is required.", 403);
  }
  return motorcycle;
}

export function toMotorcycleResponse(
  motorcycle: Motorcycle,
  maintenance?: MaintenanceDates
): MotorcycleResponse {
  return {
    id: motorcycle.id,
    rider_id: motorcycle.riderId,
    brand_text: motorcycle.brandText,
    model_text: motorcycle.modelText,
    ...(motorcycle.licensePlate ? { license_plate: motorcycle.licensePlate } : {}),
    ...(motorcycle.year ? { year: motorcycle.year } : {}),
    ...(motorcycle.notes ? { notes: motorcycle.notes } : {}),
    details: Object.fromEntries(
      Object.entries(motorcycleDetailColumns).flatMap(([key, column]) => {
        const value = motorcycle.details?.[key as keyof MotorcycleDetails];
        return value === undefined ? [] : [[column, value]];
      })
    ),
    ...(maintenance?.lastMaintenanceAt
      ? { last_maintenance_at: maintenance.lastMaintenanceAt.toISOString() }
      : {}),
    ...(maintenance?.nextMaintenanceAt
      ? { next_maintenance_at: maintenance.nextMaintenanceAt.toISOString() }
      : {}),
    created_at: motorcycle.createdAt.toISOString(),
    updated_at: motorcycle.updatedAt.toISOString()
  };
}

type MaintenanceDates = {
  lastMaintenanceAt?: Date;
  nextMaintenanceAt?: Date;
};

type MaintenanceRepositories = {
  serviceRequests: Pick<
    Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["serviceRequests"],
    "listCompletedLastUpdatedByMotorcycles" | "listUpcomingMaintenanceByMotorcycles"
  >;
  reminders: Pick<
    Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["reminders"],
    "listUpcomingByMotorcycles"
  >;
};

async function deriveMaintenanceDates(input: {
  serviceRequests: MaintenanceRepositories["serviceRequests"];
  reminders: MaintenanceRepositories["reminders"];
  motorcycleIds: string[];
  now: Date;
}): Promise<Map<string, MaintenanceDates>> {
  const result = new Map<string, MaintenanceDates>();
  if (input.motorcycleIds.length === 0) {
    return result;
  }
  const [lastByMotorcycle, upcomingByMotorcycle, reminderByMotorcycle] = await Promise.all([
    input.serviceRequests.listCompletedLastUpdatedByMotorcycles({
      motorcycleIds: input.motorcycleIds
    }),
    input.serviceRequests.listUpcomingMaintenanceByMotorcycles({
      motorcycleIds: input.motorcycleIds,
      activeStatuses: UPCOMING_SERVICE_REQUEST_STATUSES,
      now: input.now
    }),
    input.reminders.listUpcomingByMotorcycles({
      motorcycleIds: input.motorcycleIds,
      now: input.now
    })
  ]);

  for (const motorcycleId of input.motorcycleIds) {
    const last = lastByMotorcycle.get(motorcycleId);
    const upcoming = upcomingByMotorcycle.get(motorcycleId);
    const reminder = reminderByMotorcycle.get(motorcycleId);
    let nextMaintenanceAt: Date | undefined;
    if (upcoming && reminder) {
      nextMaintenanceAt =
        upcoming.getTime() <= reminder.getTime() ? upcoming : reminder;
    } else {
      nextMaintenanceAt = upcoming ?? reminder;
    }
    result.set(motorcycleId, {
      lastMaintenanceAt: last,
      nextMaintenanceAt
    });
  }
  return result;
}
