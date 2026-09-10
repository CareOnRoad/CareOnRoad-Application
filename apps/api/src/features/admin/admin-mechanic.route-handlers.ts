import { NextResponse } from "next/server";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

import {
  adminRouteError,
  readAdminIdempotencyKey,
  readAdminJson
} from "./admin-route-helpers";
import {
  AdminMechanicManagementService,
  type AdminMechanicPageResponse,
  type AdminMechanicPerformanceResponse,
  type AdminMechanicSummaryResponse,
  type AdminMechanicWorkHistoryResponse
} from "./admin-mechanic-management.service";

export type AdminMechanicRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  service: {
    listMechanics(
      identity: VerifiedSupabaseIdentity,
      input: unknown
    ): Promise<AdminMechanicPageResponse<AdminMechanicSummaryResponse>>;
    getMechanic(
      identity: VerifiedSupabaseIdentity,
      mechanicId: string
    ): Promise<AdminMechanicSummaryResponse>;
    approve(
      identity: VerifiedSupabaseIdentity,
      mechanicId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminMechanicSummaryResponse>;
    reject(
      identity: VerifiedSupabaseIdentity,
      mechanicId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminMechanicSummaryResponse>;
    suspend(
      identity: VerifiedSupabaseIdentity,
      mechanicId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminMechanicSummaryResponse>;
    ban(
      identity: VerifiedSupabaseIdentity,
      mechanicId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminMechanicSummaryResponse>;
    reactivate(
      identity: VerifiedSupabaseIdentity,
      mechanicId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminMechanicSummaryResponse>;
    updateSkills(
      identity: VerifiedSupabaseIdentity,
      mechanicId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminMechanicSummaryResponse>;
    updateRadius(
      identity: VerifiedSupabaseIdentity,
      mechanicId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminMechanicSummaryResponse>;
    forceUnavailable(
      identity: VerifiedSupabaseIdentity,
      mechanicId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminMechanicSummaryResponse>;
    listWorkHistory(
      identity: VerifiedSupabaseIdentity,
      mechanicId: string,
      input: unknown
    ): Promise<AdminMechanicPageResponse<AdminMechanicWorkHistoryResponse>>;
    getPerformance(
      identity: VerifiedSupabaseIdentity,
      mechanicId: string
    ): Promise<AdminMechanicPerformanceResponse>;
  };
};

export function createAdminMechanicRouteHandlers(
  dependencies: AdminMechanicRouteDependencies
) {
  return {
    listMechanics: (request: Request) =>
      read(request, (identity) =>
        dependencies.service.listMechanics(identity, searchParams(request))
      ),
    getMechanic: (request: Request, mechanicId: string) =>
      read(request, (identity) =>
        dependencies.service.getMechanic(identity, mechanicId)
      ),
    approve: (request: Request, mechanicId: string) =>
      command(request, (identity, body, key) =>
        dependencies.service.approve(identity, mechanicId, body, key)
      ),
    reject: (request: Request, mechanicId: string) =>
      command(request, (identity, body, key) =>
        dependencies.service.reject(identity, mechanicId, body, key)
      ),
    suspend: (request: Request, mechanicId: string) =>
      command(request, (identity, body, key) =>
        dependencies.service.suspend(identity, mechanicId, body, key)
      ),
    ban: (request: Request, mechanicId: string) =>
      command(request, (identity, body, key) =>
        dependencies.service.ban(identity, mechanicId, body, key)
      ),
    reactivate: (request: Request, mechanicId: string) =>
      command(request, (identity, body, key) =>
        dependencies.service.reactivate(identity, mechanicId, body, key)
      ),
    updateSkills: (request: Request, mechanicId: string) =>
      command(request, (identity, body, key) =>
        dependencies.service.updateSkills(identity, mechanicId, body, key)
      ),
    updateRadius: (request: Request, mechanicId: string) =>
      command(request, (identity, body, key) =>
        dependencies.service.updateRadius(identity, mechanicId, body, key)
      ),
    forceUnavailable: (request: Request, mechanicId: string) =>
      command(request, (identity, body, key) =>
        dependencies.service.forceUnavailable(identity, mechanicId, body, key)
      ),
    listWorkHistory: (request: Request, mechanicId: string) =>
      read(request, (identity) =>
        dependencies.service.listWorkHistory(
          identity,
          mechanicId,
          searchParams(request)
        )
      ),
    getPerformance: (request: Request, mechanicId: string) =>
      read(request, (identity) =>
        dependencies.service.getPerformance(identity, mechanicId)
      )
  };

  async function read<T>(
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

  async function command<T>(
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

export function createDefaultAdminMechanicRouteHandlers() {
  return createAdminMechanicRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    service: new AdminMechanicManagementService(
      new PostgresUnitOfWork(getPostgresClient())
    )
  });
}

function searchParams(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
