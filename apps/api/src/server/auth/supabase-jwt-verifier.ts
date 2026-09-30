import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey
} from "jose";

import { verifiedIdentitySchema } from "@/features/auth/auth.schemas";
import { AuthError, type VerifiedSupabaseIdentity } from "@/features/auth/auth.types";

export type SupabaseJwtEnvironment = {
  SUPABASE_JWT_ISSUER?: string;
  SUPABASE_JWT_AUDIENCE?: string;
  SUPABASE_JWKS_URL?: string;
};

export type SupabaseJwtVerifierOptions = {
  issuer: string;
  audience: string;
  algorithms?: string[];
  keyResolver: JWTVerifyGetKey;
};

export class SupabaseJwtVerifier {
  private readonly algorithms: string[];

  constructor(private readonly options: SupabaseJwtVerifierOptions) {
    this.algorithms = options.algorithms ?? ["ES256", "RS256"];
  }

  async verify(token: string): Promise<VerifiedSupabaseIdentity> {
    try {
      const result = await jwtVerify(token, this.options.keyResolver, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: this.algorithms
      });
      const displayName = extractDisplayName(result.payload.user_metadata);
      const parsed = verifiedIdentitySchema.safeParse({
        subject: result.payload.sub,
        issuer: result.payload.iss,
        audience: normalizeAudience(result.payload.aud),
        ...(displayName ? { displayName } : {})
      });
      if (!parsed.success) {
        throw new Error("Invalid verified claims.");
      }
      return parsed.data;
    } catch {
      throw new AuthError("INVALID_TOKEN", "The Supabase access token is invalid.", 401);
    }
  }
}

export function createSupabaseJwtVerifier(
  environment: SupabaseJwtEnvironment = process.env as SupabaseJwtEnvironment
): SupabaseJwtVerifier {
  const issuer = environment.SUPABASE_JWT_ISSUER?.trim();
  const audience = environment.SUPABASE_JWT_AUDIENCE?.trim();
  const jwksUrl = environment.SUPABASE_JWKS_URL?.trim();
  if (!issuer || !audience || !jwksUrl) {
    throw new Error(
      "SUPABASE_JWT_ISSUER, SUPABASE_JWT_AUDIENCE, and SUPABASE_JWKS_URL are required."
    );
  }
  return new SupabaseJwtVerifier({
    issuer,
    audience,
    keyResolver: createRemoteJWKSet(new URL(jwksUrl))
  });
}

function normalizeAudience(audience: string | string[] | undefined): string[] {
  if (Array.isArray(audience)) {
    return audience;
  }
  return audience ? [audience] : [];
}

function extractDisplayName(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  for (const key of ["full_name", "name"]) {
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized.length > 0 && normalized.length <= 120) {
        return normalized;
      }
    }
  }

  return undefined;
}
