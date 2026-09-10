import type { MediaStorageProvider } from "./media-storage.provider";
import { SupabaseMediaStorageProvider } from "./supabase-media-storage.provider";

export function createMediaStorageProvider(
  environment: Record<string, string | undefined> = process.env
): MediaStorageProvider {
  const supabaseUrl = required(environment, "SUPABASE_URL");
  const serviceRoleKey = required(environment, "SUPABASE_SERVICE_ROLE_KEY");
  return new SupabaseMediaStorageProvider({
    supabaseUrl,
    serviceRoleKey,
    timeoutMs: positiveInteger(environment.MEDIA_STORAGE_TIMEOUT_MS, 15_000)
  });
}

export function mediaStorageBucket(
  environment: Record<string, string | undefined> = process.env
): string {
  const bucket = required(environment, "MEDIA_STORAGE_BUCKET");
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(bucket)) {
    throw new Error("MEDIA_STORAGE_BUCKET must be a safe bucket identifier.");
  }
  return bucket;
}

function required(environment: Record<string, string | undefined>, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for media storage.`);
  return value;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
