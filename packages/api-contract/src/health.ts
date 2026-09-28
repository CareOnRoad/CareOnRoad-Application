import { z } from "zod";

/**
 * Response schemas for the unauthenticated deployment probes
 * `/api/v1/internal/health/live` and `/api/v1/internal/health/ready`.
 *
 * Mirrors `apps/api/src/features/health/health.service.ts`. Output is
 * fixed and redacted: no connection strings, provider keys, or raw errors.
 */

/** `HealthCheckName` (service line 1). */
export const healthCheckNames = [
  "database",
  "workers",
  "notifications",
  "media",
  "payments"
] as const;

/** `HealthCheckStatus` (service line 2). */
export const healthCheckStatuses = [
  "up",
  "configured",
  "disabled",
  "down",
  "invalid"
] as const;

export const healthCheckSchema = z.object({
  name: z.enum(healthCheckNames),
  status: z.enum(healthCheckStatuses)
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;

/** `HealthService.liveness()` (service line 20). */
export const healthLivenessResponseSchema = z.object({ status: z.literal("ok") });

/** `ReadinessSnapshot` (service lines 6-9). */
export const healthReadinessResponseSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  checks: z.array(healthCheckSchema)
});
