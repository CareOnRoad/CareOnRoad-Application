import { prepareIdempotency } from "@/lib/idempotency";
import type { FoundationRepositories } from "@/server/repositories/contracts/unit-of-work";
import type { JsonObject } from "@/server/repositories/contracts/idempotency.repository";
import { adminIdempotencyKeySchema } from "./admin.schemas";
import { AdminRouteError } from "./admin-route-helpers";

export async function prepareAdminCommand(repositories: FoundationRepositories, actorId: string, scope: string, key: string, request: unknown, now: Date, createId: () => string) {
  if (!adminIdempotencyKeySchema.safeParse(key).success) throw new AdminRouteError("INVALID_INPUT", "A valid X-Idempotency-Key is required.", 400);
  const decision = await prepareIdempotency(repositories.idempotency, { actorId, scope, idempotencyKey: key, request,
    expiresAt: new Date(now.getTime() + 86_400_000), id: createId() });
  if (decision.action === "conflict" || decision.action === "in_progress") throw new AdminRouteError("CONFLICT", "Idempotency key conflict.", 409);
  return decision.action === "replay" ? decision.responseBody : undefined;
}

export async function recordAdminAction(repositories: FoundationRepositories, input: {
  actorId: string; action: string; entityType: string; entityId: string; requestId?: string; reason: string;
  now: Date; createId: () => string; metadata?: JsonObject;
}) {
  await repositories.audit.append({ id: input.createId(), actorId: input.actorId, actorRole: "admin", action: input.action,
    entityType: input.entityType, entityId: input.entityId, requestId: input.requestId, adminReason: input.reason,
    metadata: input.metadata ?? { resource_id: input.entityId }, createdAt: input.now });
  const eventId = input.createId();
  await repositories.outbox.append({ id: eventId, topic: input.action, dedupeKey: `${input.action}:${eventId}`, aggregateType: input.entityType,
    aggregateId: input.entityId, payload: { action: input.action, resource_id: input.entityId, ...(input.requestId ? { request_id: input.requestId } : {}) },
    createdAt: input.now, nextAttemptAt: input.now });
}
