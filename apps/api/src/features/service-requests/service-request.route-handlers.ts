import { NextResponse } from "next/server";
import { listQuery } from "@/lib/list-pagination";

import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import {
  ServiceRequestService,
  type RequestMediaMetadataResponse,
  type ServiceRequestResponse
} from "./service-request.service";

export type ServiceRequestRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  serviceRequestService: {
    updateAppointment?(identity: VerifiedSupabaseIdentity, requestId: string, input: unknown, key: string): Promise<ServiceRequestResponse>;
    createServiceRequest(
      identity: VerifiedSupabaseIdentity,
      input: unknown,
      idempotencyKey: string
    ): Promise<ServiceRequestResponse>;
    listServiceRequests(identity: VerifiedSupabaseIdentity, input?: unknown): Promise<{ items: ServiceRequestResponse[] }>;
    getServiceRequest(
      identity: VerifiedSupabaseIdentity,
      requestId: string
    ): Promise<ServiceRequestResponse>;
    cancelServiceRequest(
      identity: VerifiedSupabaseIdentity,
      requestId: string,
      input: unknown
    ): Promise<ServiceRequestResponse>;
    addMediaMetadata(
      identity: VerifiedSupabaseIdentity,
      requestId: string,
      input: unknown
    ): Promise<RequestMediaMetadataResponse>;
  };
};

export function createServiceRequestRouteHandlers(dependencies: ServiceRequestRouteDependencies) {
  return {
    async updateAppointment(request: Request, requestId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        const key = requireIdempotencyKey(request);
        if (!dependencies.serviceRequestService.updateAppointment) throw new Error("Appointment updates are not configured.");
        return NextResponse.json(await dependencies.serviceRequestService.updateAppointment(identity, requestId, await readJson(request), key));
      } catch (error) { return routeError(error); }
    },
    async listServiceRequests(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.serviceRequestService.listServiceRequests(identity, listQuery(request))
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async createServiceRequest(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        const idempotencyKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        return NextResponse.json(
          await dependencies.serviceRequestService.createServiceRequest(
            identity,
            body,
            idempotencyKey
          ),
          { status: 201 }
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async getServiceRequest(request: Request, requestId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.serviceRequestService.getServiceRequest(identity, requestId)
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async cancelServiceRequest(request: Request, requestId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.serviceRequestService.cancelServiceRequest(
            identity,
            requestId,
            await readJson(request)
          )
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async addMediaMetadata(request: Request, requestId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.serviceRequestService.addMediaMetadata(
            identity,
            requestId,
            await readJson(request)
          ),
          { status: 201 }
        );
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultServiceRequestRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createServiceRequestRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    serviceRequestService: new ServiceRequestService(unitOfWork)
  });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw routeInputError("Request body must be valid JSON.");
  }
}

function requireIdempotencyKey(request: Request): string {
  const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw routeInputError("X-Idempotency-Key is required for service-request creation.");
  }
  return idempotencyKey;
}

function routeInputError(message: string) {
  const error = new Error(message) as Error & {
    status: number;
    errorCode: "INVALID_INPUT";
  };
  error.status = 400;
  error.errorCode = "INVALID_INPUT";
  return error;
}

function routeError(error: unknown) {
  if (error instanceof DatabaseError) {
    return databaseJsonError(error);
  }
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    "errorCode" in error &&
    "message" in error &&
    typeof error.status === "number" &&
    typeof error.errorCode === "string" &&
    typeof error.message === "string"
  ) {
    return jsonError(error.status, error.errorCode as ApiErrorCode, error.message, {
      details:
        "details" in error && typeof error.details === "object" && error.details !== null
          ? (error.details as Record<string, unknown>)
          : undefined
    });
  }
  return jsonError(500, "INTERNAL_ERROR", "An internal API error occurred.");
}
