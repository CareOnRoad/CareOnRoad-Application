import { sanitizeAuditMetadata } from "@/features/audit/audit-sanitizer";
import type { JsonObject } from "@/server/repositories/contracts/idempotency.repository";

const REDACTED = "[REDACTED]";
const PROHIBITED_KEY_PATTERN =
  /(password|passcode|access[_-]?token|refresh[_-]?token|bearer|authorization|provider[_-]?token|service[_-]?role|api[_-]?key|device[_-]?key|secret|credential|raw[_-]?(?:audio|text)|audio(?:[_-]?(?:data|blob|bytes|buffer))?|chatbot(?:[_-]?(?:text|message|content))?|full[_-]?(?:text|message)|diagnosis(?:[_-]?(?:text|content|body))?|provider[_-]?payload|payment|card|cvv|bank[_-]?account)/i;
const BEARER_VALUE_PATTERN = /^\s*bearer\s+\S+/i;
const INLINE_SECRET_PATTERN =
  /\b(password|passcode|access[_-]?token|refresh[_-]?token|provider[_-]?token|service[_-]?role[_-]?key|api[_-]?key|device[_-]?key|secret|credential)\s*[:=]\s*\S+/gi;

const ADMIN_OUTBOX_ALLOWED_KEYS = new Set([
  "action",
  "aggregate_id",
  "changes",
  "context",
  "entity_id",
  "event_type",
  "next_status",
  "previous_status",
  "reason_code",
  "request_id",
  "resource_id",
  "resource_type",
  "scope",
  "status"
]);

export function redactAdminResponse<T>(value: T): T {
  return redactValue(value) as T;
}

export function sanitizeAdminReason(reason: string): string {
  return reason
    .replace(/\bbearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(INLINE_SECRET_PATTERN, "$1=[REDACTED]");
}

export function pickAdminSafeDto(
  source: Record<string, unknown>,
  allowedKeys: readonly string[]
): Record<string, unknown> {
  const allowed = new Set(allowedKeys);
  const selected = Object.fromEntries(
    Object.entries(source).filter(([key]) => allowed.has(key))
  );
  return redactAdminResponse(selected);
}

export function sanitizeAdminAuditMetadata(metadata: JsonObject): JsonObject {
  return sanitizeAuditMetadata(redactValue(metadata) as JsonObject);
}

export function sanitizeAdminOutboxPayload(payload: JsonObject): JsonObject {
  const selected = Object.fromEntries(
    Object.entries(payload).filter(([key]) => ADMIN_OUTBOX_ALLOWED_KEYS.has(key))
  );
  return toJsonObject(redactValue(selected));
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return BEARER_VALUE_PATTERN.test(value) ? REDACTED : value;
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (PROHIBITED_KEY_PATTERN.test(key)) {
      continue;
    }
    redacted[key] = redactValue(entry);
  }
  return redacted;
}

function toJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}
