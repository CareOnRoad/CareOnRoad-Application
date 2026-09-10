import { z } from "zod";

export const liveLocationInputSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  observed_at: z.string().datetime({ offset: true }),
  accuracy_meters: z.number().finite().min(0).max(100)
}).strict();

export type LiveLocationInput = z.infer<typeof liveLocationInputSchema>;

export type LiveTrackingConfig = {
  enabled: boolean;
  retentionMinutes?: number;
  maxLocationAgeSeconds: number;
  maxFutureSkewSeconds: number;
  minUpdateIntervalSeconds: number;
  maxAccuracyMeters: number;
};

export function readLiveTrackingConfig(
  environment: Record<string, string | undefined> = process.env
): LiveTrackingConfig {
  const enabled = environment.LIVE_TRACKING_ENABLED?.trim().toLowerCase() === "true";
  const retentionMinutes = optionalBoundedInteger(
    "LIVE_TRACKING_RETENTION_MINUTES",
    environment.LIVE_TRACKING_RETENTION_MINUTES,
    1,
    1440
  );
  if (enabled && retentionMinutes === undefined) {
    throw new Error(
      "LIVE_TRACKING_RETENTION_MINUTES must be an integer from 1 to 1440 when live tracking is enabled."
    );
  }
  return {
    enabled,
    ...(retentionMinutes !== undefined ? { retentionMinutes } : {}),
    maxLocationAgeSeconds: boundedInteger(
      "LIVE_TRACKING_MAX_LOCATION_AGE_SECONDS",
      environment.LIVE_TRACKING_MAX_LOCATION_AGE_SECONDS,
      30,
      5,
      300
    ),
    maxFutureSkewSeconds: boundedInteger(
      "LIVE_TRACKING_MAX_FUTURE_SKEW_SECONDS",
      environment.LIVE_TRACKING_MAX_FUTURE_SKEW_SECONDS,
      5,
      0,
      30
    ),
    minUpdateIntervalSeconds: boundedInteger(
      "LIVE_TRACKING_MIN_UPDATE_INTERVAL_SECONDS",
      environment.LIVE_TRACKING_MIN_UPDATE_INTERVAL_SECONDS,
      5,
      1,
      60
    ),
    maxAccuracyMeters: boundedInteger(
      "LIVE_TRACKING_MAX_ACCURACY_METERS",
      environment.LIVE_TRACKING_MAX_ACCURACY_METERS,
      100,
      1,
      100
    )
  };
}

function optionalBoundedInteger(
  name: string,
  raw: string | undefined,
  min: number,
  max: number
): number | undefined {
  if (!raw?.trim()) return undefined;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return parsed;
}

function boundedInteger(
  name: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  return optionalBoundedInteger(name, raw, min, max) ?? fallback;
}
