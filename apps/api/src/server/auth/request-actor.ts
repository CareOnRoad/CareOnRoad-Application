import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AuthError } from "@/features/auth/auth.types";

import { createSupabaseJwtVerifier, type SupabaseJwtVerifier } from "./supabase-jwt-verifier";

// One verifier per process: createRemoteJWKSet caches keys, a new one per request refetched JWKS every call.
let defaultVerifier: SupabaseJwtVerifier | undefined;

export async function authenticateSupabaseRequest(
  request: Request,
  verifier: Pick<SupabaseJwtVerifier, "verify"> = (defaultVerifier ??= createSupabaseJwtVerifier())
): Promise<VerifiedSupabaseIdentity> {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new AuthError("UNAUTHORIZED", "Authentication is required.", 401);
  }
  return verifier.verify(match[1].trim());
}
