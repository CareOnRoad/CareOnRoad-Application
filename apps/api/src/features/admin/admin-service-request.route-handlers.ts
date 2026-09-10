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
  AdminServiceRequestService,
  type AdminPageResponse,
  type AdminRequestAssignmentResponse,
  type AdminRequestMediaResponse,
  type AdminRequestNoteResponse,
  type AdminRequestQuoteResponse,
  type AdminRequestTimelineResponse,
  type AdminServiceRequestDetailResponse,
  type AdminServiceRequestSummaryResponse
} from "./admin-service-request.service";

export type AdminServiceRequestRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  service: {
    listRequests(
      identity: VerifiedSupabaseIdentity,
      input: unknown
    ): Promise<AdminPageResponse<AdminServiceRequestSummaryResponse>>;
    getRequest(
      identity: VerifiedSupabaseIdentity,
      requestId: string
    ): Promise<AdminServiceRequestDetailResponse>;
    listTimeline(
      identity: VerifiedSupabaseIdentity,
      requestId: string,
      input: unknown
    ): Promise<AdminPageResponse<AdminRequestTimelineResponse>>;
    cancel(
      identity: VerifiedSupabaseIdentity,
      requestId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminServiceRequestDetailResponse>;
    manualEscalate(
      identity: VerifiedSupabaseIdentity,
      requestId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminServiceRequestDetailResponse>;
    addNote(
      identity: VerifiedSupabaseIdentity,
      requestId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AdminRequestNoteResponse>;
    listMedia(
      identity: VerifiedSupabaseIdentity,
      requestId: string,
      input: unknown
    ): Promise<AdminPageResponse<AdminRequestMediaResponse>>;
    getAssignment(
      identity: VerifiedSupabaseIdentity,
      requestId: string
    ): Promise<AdminRequestAssignmentResponse>;
    listQuotes(
      identity: VerifiedSupabaseIdentity,
      requestId: string,
      input: unknown
    ): Promise<AdminPageResponse<AdminRequestQuoteResponse>>;
  };
};

export function createAdminServiceRequestRouteHandlers(
  dependencies: AdminServiceRequestRouteDependencies
) {
  return {
    listRequests: (request: Request) =>
      read(request, (identity) =>
        dependencies.service.listRequests(identity, searchParams(request))
      ),
    getRequest: (request: Request, requestId: string) =>
      read(request, (identity) =>
        dependencies.service.getRequest(identity, requestId)
      ),
    listTimeline: (request: Request, requestId: string) =>
      read(request, (identity) =>
        dependencies.service.listTimeline(
          identity,
          requestId,
          searchParams(request)
        )
      ),
    cancel: (request: Request, requestId: string) =>
      command(request, (identity, body, key) =>
        dependencies.service.cancel(identity, requestId, body, key)
      ),
    manualEscalate: (request: Request, requestId: string) =>
      command(request, (identity, body, key) =>
        dependencies.service.manualEscalate(identity, requestId, body, key)
      ),
    addNote: (request: Request, requestId: string) =>
      command(
        request,
        (identity, body, key) =>
          dependencies.service.addNote(identity, requestId, body, key),
        201
      ),
    listMedia: (request: Request, requestId: string) =>
      read(request, (identity) =>
        dependencies.service.listMedia(
          identity,
          requestId,
          searchParams(request)
        )
      ),
    getAssignment: (request: Request, requestId: string) =>
      read(request, (identity) =>
        dependencies.service.getAssignment(identity, requestId)
      ),
    listQuotes: (request: Request, requestId: string) =>
      read(request, (identity) =>
        dependencies.service.listQuotes(
          identity,
          requestId,
          searchParams(request)
        )
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
    ) => Promise<T>,
    status = 200
  ) {
    try {
      const identity = await dependencies.authenticate(request);
      const idempotencyKey = readAdminIdempotencyKey(request);
      const body = await readAdminJson(request);
      return NextResponse.json(
        await operation(identity, body, idempotencyKey),
        { status }
      );
    } catch (error) {
      return adminRouteError(error);
    }
  }
}

export function createDefaultAdminServiceRequestRouteHandlers() {
  return createAdminServiceRequestRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    service: new AdminServiceRequestService(
      new PostgresUnitOfWork(getPostgresClient())
    )
  });
}

function searchParams(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
