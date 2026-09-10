import { expect, vi } from "vitest";

import { AuthError } from "@/features/auth/auth.types";
import type {
  RequestActor,
  VerifiedSupabaseIdentity
} from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import type { AdminRouteDependencies } from "../admin-route-helpers";

export const ADMIN_USER_ID = "11111111-1111-4111-8111-111111111111";
export const RIDER_USER_ID = "22222222-2222-4222-8222-222222222222";
export const ADMIN_IDEMPOTENCY_KEY = "admin-operation-key-001";

export const adminIdentity: VerifiedSupabaseIdentity = {
  subject: ADMIN_USER_ID,
  issuer: "https://careonroad.test/auth/v1",
  audience: ["authenticated"]
};

export const adminActor: RequestActor = {
  id: ADMIN_USER_ID,
  display_name: "Admin",
  roles: ["admin"],
  status: "active"
};

export function createAdminRequest(
  path = "/api/v1/admin/test",
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    idempotencyKey?: string;
  } = {}
): Request {
  const headers = new Headers();
  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }
  if (options.idempotencyKey) {
    headers.set("x-idempotency-key", options.idempotencyKey);
  }
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  return new Request(`http://localhost${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
  });
}

export function createAdminRouteDependencies(
  options: {
    actor?: RequestActor;
    invalidToken?: string;
  } = {}
): AdminRouteDependencies {
  const actor = options.actor ?? adminActor;
  const now = new Date("2026-07-05T00:00:00.000Z");
  const unitOfWork = new InMemoryUnitOfWork({
    users: [
      {
        id: actor.id,
        displayName: actor.display_name,
        status: actor.status,
        createdAt: now,
        updatedAt: now
      }
    ],
    userRoles: actor.roles.map((role) => ({ userId: actor.id, role }))
  });

  return {
    authenticate: vi.fn(async (request: Request) => {
      const authorization = request.headers.get("authorization");
      if (!authorization) {
        throw new AuthError("UNAUTHORIZED", "Authentication is required.", 401);
      }
      const token = authorization.replace(/^Bearer\s+/i, "");
      if (token === (options.invalidToken ?? "invalid-token")) {
        throw new AuthError("INVALID_TOKEN", "The access token is invalid.", 401);
      }
      return {
        ...adminIdentity,
        subject: actor.id
      };
    }),
    unitOfWork
  };
}

export async function expectApiError(
  response: Response,
  status: number,
  errorCode: string
): Promise<void> {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toMatchObject({ error_code: errorCode });
}
