import { createHash, randomUUID } from "node:crypto";

import type {
  IdempotencyRecord,
  IdempotencyRepository,
  JsonObject
} from "@/server/repositories/contracts/idempotency.repository";

export type IdempotencyDecision =
  | { action: "execute"; record: IdempotencyRecord }
  | {
      action: "replay";
      responseStatus: number;
      responseBody: JsonObject;
      resourceType?: string;
      resourceId?: string;
    }
  | { action: "conflict" }
  | { action: "in_progress" };

export function hashIdempotencyRequest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export async function prepareIdempotency(
  repository: IdempotencyRepository,
  input: {
    actorId: string;
    scope: string;
    idempotencyKey: string;
    request: unknown;
    expiresAt: Date;
    id?: string;
  }
): Promise<IdempotencyDecision> {
  const requestHash = hashIdempotencyRequest(input.request);
  const existing = await repository.find(input.actorId, input.scope, input.idempotencyKey);

  if (!existing) {
    const record = await repository.create({
      id: input.id ?? randomUUID(),
      actorId: input.actorId,
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      expiresAt: input.expiresAt
    });
    return { action: "execute", record };
  }

  if (existing.requestHash !== requestHash) {
    return { action: "conflict" };
  }

  if (existing.completedAt && existing.responseStatus && existing.responseBody) {
    return {
      action: "replay",
      responseStatus: existing.responseStatus,
      responseBody: existing.responseBody,
      resourceType: existing.resourceType,
      resourceId: existing.resourceId
    };
  }

  return { action: "in_progress" };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
