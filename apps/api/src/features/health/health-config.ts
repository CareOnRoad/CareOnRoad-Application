import type { HealthCheck } from "./health.service";

type HealthEnvironment = Record<string, string | undefined>;

export function readHealthTimeoutMs(environment: HealthEnvironment = process.env): number {
  const parsed = Number.parseInt(environment.HEALTH_READINESS_TIMEOUT_MS?.trim() ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 1500;
}

export function evaluateHealthConfiguration(
  environment: HealthEnvironment = process.env
): HealthCheck[] {
  return [
    group("workers", [environment.INTERNAL_WORKER_SECRET], false),
    group("notifications", [environment.FCM_PROJECT_ID, environment.FCM_CLIENT_EMAIL, environment.FCM_PRIVATE_KEY], true),
    group("media", [environment.MEDIA_STORAGE_BUCKET, environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY], true),
    paymentGroup(environment)
  ];
}

function group(
  name: HealthCheck["name"],
  values: Array<string | undefined>,
  optional: boolean
): HealthCheck {
  const present = values.map((value) => Boolean(value?.trim()));
  if (present.every(Boolean)) return { name, status: "configured" };
  if (present.every((value) => !value)) return { name, status: optional ? "disabled" : "invalid" };
  return { name, status: "invalid" };
}

function paymentGroup(environment: HealthEnvironment): HealthCheck {
  const enabled = /^(1|true|yes)$/i.test(environment.PAYMENTS_ENABLED?.trim() ?? "");
  const values = [
    environment.PAYMENT_PROVIDER,
    environment.PAYOS_CLIENT_ID,
    environment.PAYOS_API_KEY,
    environment.PAYOS_CHECKSUM_KEY,
    environment.PAYOS_BASE_URL,
    environment.PAYOS_RETURN_URL,
    environment.PAYOS_CANCEL_URL
  ];
  if (!enabled) {
    const secretPresent = values.slice(1, 4).some((value) => Boolean(value?.trim()));
    return { name: "payments", status: secretPresent ? "invalid" : "disabled" };
  }
  return group("payments", values, false);
}
