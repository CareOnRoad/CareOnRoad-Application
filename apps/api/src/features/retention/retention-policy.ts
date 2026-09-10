import type { RetentionDataClass } from "@/server/repositories/contracts/retention.repository";
export type RetentionPolicy = { enabled: boolean; days: Partial<Record<RetentionDataClass, number>> };
export function readRetentionPolicy(env: NodeJS.ProcessEnv = process.env): RetentionPolicy {
  return { enabled: env.DATA_RETENTION_ENABLED?.trim().toLowerCase() === "true", days: {
    ...readDays("media_upload_intents", env.RETENTION_MEDIA_UPLOAD_INTENTS_DAYS),
    ...readDays("device_delivery_credentials", env.RETENTION_DEVICE_CREDENTIALS_DAYS),
    ...readDays("worker_runs", env.RETENTION_WORKER_RUNS_DAYS)
  } };
}
function readDays(key: RetentionDataClass, raw?: string) { if (!raw?.trim()) return {}; const value = Number(raw); if (!Number.isSafeInteger(value) || value < 1 || value > 3650) throw new Error(`${key} retention days must be an integer from 1 to 3650.`); return { [key]: value }; }
