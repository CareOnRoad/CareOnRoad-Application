import { NextResponse } from "next/server";

import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";

import {
  adminRouteError,
  readAdminIdempotencyKey,
  readAdminJson
} from "./admin-route-helpers";
import {
  AdminUserManagementService,
  type AdminPageResponse,
  type AdminUserActivityResponse,
  type AdminUserDeviceResponse,
  type AdminUserSummaryResponse
} from "./admin-user-management.service";

export type AdminUserRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  service: {
    listUsers(
      identity: VerifiedSupabaseIdentity,
      input: unknown
    ): Promise<AdminPageResponse<AdminUserSummaryResponse>>;
    getUser(
      identity: VerifiedSupabaseIdentity,
      userId: string
    ): Promise<AdminUserSummaryResponse>;
    suspendUser(
      identity: VerifiedSupabaseIdentity,
      userId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminUserSummaryResponse>;
    reactivateUser(
      identity: VerifiedSupabaseIdentity,
      userId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminUserSummaryResponse>;
    archiveUser(
      identity: VerifiedSupabaseIdentity,
      userId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminUserSummaryResponse>;
    listDevices(
      identity: VerifiedSupabaseIdentity,
      userId: string,
      input: unknown
    ): Promise<AdminPageResponse<AdminUserDeviceResponse>>;
    grantRole(
      identity: VerifiedSupabaseIdentity,
      userId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminUserSummaryResponse>;
    revokeRole(
      identity: VerifiedSupabaseIdentity,
      userId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminUserSummaryResponse>;
    listActivity(
      identity: VerifiedSupabaseIdentity,
      userId: string,
      input: unknown
    ): Promise<AdminPageResponse<AdminUserActivityResponse>>;
    revokeDevice(
      identity: VerifiedSupabaseIdentity,
      deviceId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminUserDeviceResponse>;
  };
};

export function createAdminUserRouteHandlers(
  dependencies: AdminUserRouteDependencies
) {
  return {
    listUsers: (request: Request) =>
      readOperation(request, (identity) =>
        dependencies.service.listUsers(identity, searchParams(request))
      ),
    getUser: (request: Request, userId: string) =>
      readOperation(request, (identity) =>
        dependencies.service.getUser(identity, userId)
      ),
    suspendUser: (request: Request, userId: string) =>
      mutationOperation(request, (identity, body, key) =>
        dependencies.service.suspendUser(identity, userId, body, key)
      ),
    reactivateUser: (request: Request, userId: string) =>
      mutationOperation(request, (identity, body, key) =>
        dependencies.service.reactivateUser(identity, userId, body, key)
      ),
    archiveUser: (request: Request, userId: string) =>
      mutationOperation(request, (identity, body, key) =>
        dependencies.service.archiveUser(identity, userId, body, key)
      ),
    listDevices: (request: Request, userId: string) =>
      readOperation(request, (identity) =>
        dependencies.service.listDevices(identity, userId, searchParams(request))
      ),
    grantRole: (request: Request, userId: string) =>
      mutationOperation(request, (identity, body, key) =>
        dependencies.service.grantRole(identity, userId, body, key)
      ),
    revokeRole: (request: Request, userId: string) =>
      mutationOperation(request, (identity, body, key) =>
        dependencies.service.revokeRole(identity, userId, body, key)
      ),
    listActivity: (request: Request, userId: string) =>
      readOperation(request, (identity) =>
        dependencies.service.listActivity(identity, userId, searchParams(request))
      ),
    revokeDevice: (request: Request, deviceId: string) =>
      mutationOperation(request, (identity, body, key) =>
        dependencies.service.revokeDevice(identity, deviceId, body, key)
      )
  };

  async function readOperation<T>(
    request: Request,
    operation: (identity: VerifiedSupabaseIdentity) => Promise<T>
  ) {
    try {
      return NextResponse.json(
        await operation(await dependencies.authenticate(request))
      );
    } catch (error) {
      return adminRouteError(error);
    }
  }

  async function mutationOperation<T>(
    request: Request,
    operation: (
      identity: VerifiedSupabaseIdentity,
      body: unknown,
      idempotencyKey: string
    ) => Promise<T>
  ) {
    try {
      const identity = await dependencies.authenticate(request);
      const idempotencyKey = readAdminIdempotencyKey(request);
      const body = await readAdminJson(request);
      return NextResponse.json(await operation(identity, body, idempotencyKey));
    } catch (error) {
      return adminRouteError(error);
    }
  }
}

export function createDefaultAdminUserRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createAdminUserRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    service: new AdminUserManagementService(unitOfWork)
  });
}

function searchParams(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
