import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AuthError } from "@/features/auth/auth.types";

import { createSupabaseJwtVerifier, type SupabaseJwtVerifier } from "./supabase-jwt-verifier";

export async function authenticateSupabaseRequest(
  request: Request,
  verifier: Pick<SupabaseJwtVerifier, "verify"> = createSupabaseJwtVerifier()
): Promise<VerifiedSupabaseIdentity> {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new AuthError("UNAUTHORIZED", "Authentication is required.", 401);
  }
  return verifier.verify(match[1].trim());
}
