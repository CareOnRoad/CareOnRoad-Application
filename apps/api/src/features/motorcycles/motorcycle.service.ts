import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import type { Motorcycle } from "@/server/repositories/contracts/motorcycle.repository";

import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import { requireActorRole } from "../auth/authorization";
import { motorcycleInputSchema, type MotorcycleInput } from "./motorcycle.schemas";

export type MotorcycleResponse = {
  id: string;
  rider_id: string;
  brand_text: string;
  model_text: string;
  license_plate?: string;
  year?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
};

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

      return toMotorcycleResponse(motorcycle);
    });
  }

  listMotorcycles(identity: VerifiedSupabaseIdentity): Promise<{ items: MotorcycleResponse[] }> {
    return this.unitOfWork.execute(async ({ motorcycles, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const items = await motorcycles.listActiveByRider(actor.id);
      return { items: items.map(toMotorcycleResponse) };
    });
  }

  getMotorcycle(
    identity: VerifiedSupabaseIdentity,
    motorcycleId: string
  ): Promise<MotorcycleResponse> {
    return this.unitOfWork.execute(async ({ motorcycles, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const motorcycle = await loadOwnedMotorcycle(motorcycles, motorcycleId, actor.id);
      return toMotorcycleResponse(motorcycle);
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

export function toMotorcycleResponse(motorcycle: Motorcycle): MotorcycleResponse {
  return {
    id: motorcycle.id,
    rider_id: motorcycle.riderId,
    brand_text: motorcycle.brandText,
    model_text: motorcycle.modelText,
    ...(motorcycle.licensePlate ? { license_plate: motorcycle.licensePlate } : {}),
    ...(motorcycle.year ? { year: motorcycle.year } : {}),
    ...(motorcycle.notes ? { notes: motorcycle.notes } : {}),
    created_at: motorcycle.createdAt.toISOString(),
    updated_at: motorcycle.updatedAt.toISOString()
  };
}
