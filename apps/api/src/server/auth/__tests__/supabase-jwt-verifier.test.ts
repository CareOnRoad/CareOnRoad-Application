import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
  type JSONWebKeySet
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { AuthError } from "@/features/auth/auth.types";

import {
  createSupabaseJwtVerifier,
  SupabaseJwtVerifier
} from "../supabase-jwt-verifier";

const issuer = "https://careonroad.supabase.co/auth/v1";
const audience = "authenticated";
const subject = "11111111-1111-4111-8111-111111111111";
let privateKey: CryptoKey;
let publicKey: CryptoKey;
let publicJwk: JWK;
let keyResolver: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256", { extractable: true });
  privateKey = keyPair.privateKey;
  publicKey = keyPair.publicKey;
  publicJwk = await exportJWK(keyPair.publicKey);
  keyResolver = createLocalJWKSet({
    keys: [{ ...publicJwk, kid: "test-key", alg: "RS256", use: "sig" }]
  } as JSONWebKeySet);
});

describe("SupabaseJwtVerifier", () => {
  it("verifies signature and derives identity from sub", async () => {
    const verifier = createVerifier();
    const token = await createToken();

    await expect(verifier.verify(token)).resolves.toEqual({
      subject,
      issuer,
      audience: [audience]
    });
  });

  it("reads a bounded display name from verified user metadata", async () => {
    const token = await createToken({
      payload: { user_metadata: { full_name: "  Nguyễn Văn An  " } }
    });

    await expect(createVerifier().verify(token)).resolves.toEqual({
      subject,
      issuer,
      audience: [audience],
      displayName: "Nguyễn Văn An"
    });

    await expect(
      createVerifier().verify(
        await createToken({ payload: { user_metadata: { full_name: "x".repeat(121) } } })
      )
    ).resolves.toEqual({ subject, issuer, audience: [audience] });
  });

  it.each([
    ["wrong issuer", { tokenIssuer: "https://wrong.example/auth/v1" }],
    ["wrong audience", { tokenAudience: "other-client" }],
    ["expired token", { expiresAt: Math.floor(Date.now() / 1000) - 60 }],
    ["not-before token", { notBefore: Math.floor(Date.now() / 1000) + 600 }]
  ])("rejects %s", async (_name, options) => {
    await expect(createVerifier().verify(await createToken(options))).rejects.toMatchObject({
      errorCode: "INVALID_TOKEN"
    });
  });

  it("rejects unsupported algorithms before accepting claims", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", kid: "test-key" })
      .setSubject(subject)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("not-an-approved-signing-key"));

    await expect(createVerifier().verify(token)).rejects.toBeInstanceOf(AuthError);
  });

  it("enforces the configured JWKS algorithm allowlist", async () => {
    const esKeyPair = await generateKeyPair("ES256");
    const esToken = await signedToken(esKeyPair.privateKey, "ES256", "es-key");
    const esJwk = await exportJWK(esKeyPair.publicKey);
    const esResolver = createLocalJWKSet({
      keys: [{ ...esJwk, kid: "es-key", alg: "ES256", use: "sig" }]
    } as JSONWebKeySet);
    const defaultVerifier = new SupabaseJwtVerifier({
      issuer,
      audience,
      keyResolver: esResolver
    });
    const rsOnlyVerifier = new SupabaseJwtVerifier({
      issuer,
      audience,
      algorithms: ["RS256"],
      keyResolver: esResolver
    });

    await expect(defaultVerifier.verify(esToken)).resolves.toMatchObject({ subject });
    await expect(rsOnlyVerifier.verify(esToken)).rejects.toMatchObject({
      errorCode: "INVALID_TOKEN"
    });
  });

  it("rejects none and HS256 on the JWKS path", async () => {
    const unsignedToken = [
      encodeJson({ alg: "none", kid: "test-key" }),
      encodeJson({
        sub: subject,
        iss: issuer,
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 300
      }),
      ""
    ].join(".");
    const confusedSecret = new TextEncoder().encode(JSON.stringify(publicJwk));
    const hsToken = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", kid: "test-key" })
      .setSubject(subject)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(confusedSecret);

    await expect(createDefaultVerifier().verify(unsignedToken)).rejects.toMatchObject({
      errorCode: "INVALID_TOKEN"
    });
    await expect(createDefaultVerifier().verify(hsToken)).rejects.toMatchObject({
      errorCode: "INVALID_TOKEN"
    });
  });

  it("rejects unsupported algorithms, key/algorithm mismatch, and confusion attempts", async () => {
    const psKeyPair = await generateKeyPair("PS256");
    const psJwk = await exportJWK(psKeyPair.publicKey);
    const psResolver = createLocalJWKSet({
      keys: [{ ...psJwk, kid: "ps-key", alg: "PS256", use: "sig" }]
    } as JSONWebKeySet);
    const psToken = await signedToken(psKeyPair.privateKey, "PS256", "ps-key");
    const esKeyPair = await generateKeyPair("ES256");
    const rsToken = await createToken();
    const mismatchedVerifier = new SupabaseJwtVerifier({
      issuer,
      audience,
      algorithms: ["RS256"],
      keyResolver: async () => esKeyPair.publicKey
    });

    await expect(
      new SupabaseJwtVerifier({ issuer, audience, keyResolver: psResolver }).verify(psToken)
    ).rejects.toMatchObject({ errorCode: "INVALID_TOKEN" });
    await expect(mismatchedVerifier.verify(rsToken)).rejects.toMatchObject({
      errorCode: "INVALID_TOKEN"
    });

    const publicKeyBytes = new TextEncoder().encode(JSON.stringify(await exportJWK(publicKey)));
    const confusionToken = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", kid: "test-key" })
      .setSubject(subject)
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime("5m")
      .sign(publicKeyBytes);
    await expect(createDefaultVerifier().verify(confusionToken)).rejects.toMatchObject({
      errorCode: "INVALID_TOKEN"
    });
  });

  it("does not implicitly fall back to a legacy shared secret", () => {
    expect(() =>
      createSupabaseJwtVerifier({
        SUPABASE_JWT_ISSUER: issuer,
        SUPABASE_JWT_AUDIENCE: audience,
        SUPABASE_JWT_SECRET: "fixture-only-legacy-secret"
      } as Record<string, string>)
    ).toThrow("SUPABASE_JWKS_URL");
  });

  it("rejects malformed and subject-less tokens", async () => {
    await expect(createVerifier().verify("not-a-jwt")).rejects.toMatchObject({
      errorCode: "INVALID_TOKEN"
    });

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    await expect(createVerifier().verify(token)).rejects.toMatchObject({
      errorCode: "INVALID_TOKEN"
    });
  });
});

function createVerifier() {
  return new SupabaseJwtVerifier({
    issuer,
    audience,
    algorithms: ["RS256"],
    keyResolver
  });
}

function createDefaultVerifier() {
  return new SupabaseJwtVerifier({
    issuer,
    audience,
    keyResolver
  });
}

async function createToken(
  options: {
    tokenIssuer?: string;
    tokenAudience?: string;
    expiresAt?: number;
    notBefore?: number;
    payload?: Record<string, unknown>;
  } = {}
) {
  let token = new SignJWT(options.payload ?? {})
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setSubject(subject)
    .setIssuer(options.tokenIssuer ?? issuer)
    .setAudience(options.tokenAudience ?? audience)
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? Math.floor(Date.now() / 1000) + 300);
  if (options.notBefore) {
    token = token.setNotBefore(options.notBefore);
  }
  return token.sign(privateKey);
}

async function signedToken(
  signingKey: CryptoKey,
  algorithm: "ES256" | "PS256",
  kid: string
) {
  return new SignJWT({})
    .setProtectedHeader({ alg: algorithm, kid })
    .setSubject(subject)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(signingKey);
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
