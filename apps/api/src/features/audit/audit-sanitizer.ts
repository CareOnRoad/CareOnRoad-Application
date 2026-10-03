import type { JsonObject } from "@/server/repositories/contracts/idempotency.repository";

const ALLOWED_LEAF_KEYS = new Set([
  "actor_id",
  "aggregate_id",
  "assignment_id",
  "attempt_count",
  "change",
  "checklist_revision",
  "completion_checklist_id",
  "dedupe_key",
  "delay_reason",
  "demo_force",
  "demo_force_mechanic_id",
  "device_id",
  "entity_id",
  "error_code",
  "eta_at",
  "eta_metadata_id",
  "event_type",
  "field",
  "idempotency_key_hash",
  "media_metadata_id",
  "media_purpose",
  "media_size_bytes",
  "mechanic_id",
  "next_status",
  "new_status",
  "previous_status",
  "provider",
  "reason_code",
  "request_code",
  "request_id",
  "resource_id",
  "resource_type",
  "role",
  "scope",
  "service_type",
  "safety_check_count",
  "source",
  "status",
  "user_id"
]);
const ALLOWED_CONTAINER_KEYS = new Set(["changes", "context"]);
const PROHIBITED_KEY_PATTERN =
  /(api[_-]?key|authorization|secret|password|credential|token|audio|blob|buffer|bytes|content|symptom|transcri|message|phone|email|payment|card|cvv|bank|amount|currency|price)/i;

export function sanitizeAuditMetadata(metadata: JsonObject): JsonObject {
  return sanitizeObject(metadata);
}

function sanitizeObject(value: JsonObject): JsonObject {
  const sanitized: JsonObject = {};

  for (const [key, entry] of Object.entries(value)) {
    if (PROHIBITED_KEY_PATTERN.test(key) && !ALLOWED_LEAF_KEYS.has(key)) {
      continue;
    }

    if (ALLOWED_CONTAINER_KEYS.has(key)) {
      sanitized[key] = sanitizeValue(entry);
      continue;
    }

    if (ALLOWED_LEAF_KEYS.has(key) && isSafeScalar(entry)) {
      sanitized[key] = entry;
    }
  }

  return sanitized;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      entry && typeof entry === "object" ? sanitizeObject(entry as JsonObject) : entry
    );
  }

  if (value && typeof value === "object") {
    return sanitizeObject(value as JsonObject);
  }

  return value;
}

function isSafeScalar(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}
