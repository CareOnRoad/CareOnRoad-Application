import { NextResponse } from "next/server";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

import {
  MechanicAssignmentMetadataService,
  type AssignmentCompletionChecklistResponse,
  type AssignmentEtaMetadataResponse,
  type AssignmentMediaMetadataResponse
} from "./mechanic-assignment-metadata.service";
import { MechanicDashboardService } from "./mechanic-dashboard.service";
import { MechanicJobListService, type MechanicJobDetailResponse } from "./mechanic-job-list.service";
import { MechanicPerformanceService } from "./mechanic-performance.service";
import type {
  MechanicDashboardResponse,
  MechanicJobPageResponse,
  MechanicPerformanceResponse
} from "./mechanic-operations.mappers";

export type MechanicOperationsRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  dashboardService: {
    getDashboard(identity: VerifiedSupabaseIdentity): Promise<MechanicDashboardResponse>;
  };
  jobListService: {
    getJob?(identity: VerifiedSupabaseIdentity, assignmentId: string): Promise<MechanicJobDetailResponse>;
    listJobs(identity: VerifiedSupabaseIdentity, query: unknown): Promise<MechanicJobPageResponse>;
  };
  performanceService: {
    getPerformance(
      identity: VerifiedSupabaseIdentity,
      query: unknown
    ): Promise<MechanicPerformanceResponse>;
  };
  etaService?: {
    updateEta(
      identity: VerifiedSupabaseIdentity,
      assignmentId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AssignmentEtaMetadataResponse>;
  };
  mediaService?: {
    addMedia(
      identity: VerifiedSupabaseIdentity,
      assignmentId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AssignmentMediaMetadataResponse>;
  };
  completionChecklistService?: {
    getCompletionChecklist?(identity: VerifiedSupabaseIdentity, assignmentId: string): Promise<AssignmentCompletionChecklistResponse>;
    submitCompletionChecklist(
      identity: VerifiedSupabaseIdentity,
      assignmentId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AssignmentCompletionChecklistResponse>;
  };
};

export function createMechanicOperationsRouteHandlers(
  dependencies: MechanicOperationsRouteDependencies
) {
  return {
    async getJob(request: Request, assignmentId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        if (!dependencies.jobListService.getJob) throw new Error("Job detail service is not configured.");
        return NextResponse.json(await dependencies.jobListService.getJob(identity, assignmentId), { headers: { "Cache-Control": "private, no-store" } });
      } catch (error) { return routeError(error); }
    },
    async getCompletionChecklist(request: Request, assignmentId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        if (!dependencies.completionChecklistService?.getCompletionChecklist) throw new Error("Completion checklist service is not configured.");
        return NextResponse.json(await dependencies.completionChecklistService.getCompletionChecklist(identity, assignmentId));
      } catch (error) { return routeError(error); }
    },
    async getDashboard(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.dashboardService.getDashboard(identity));
      } catch (error) {
        return routeError(error);
      }
    },

    async listJobs(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.jobListService.listJobs(identity, queryParams(request))
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async getPerformance(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.performanceService.getPerformance(identity, queryParams(request))
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async updateEta(request: Request, assignmentId: string) {
      try {
        if (!dependencies.etaService) {
          throw new Error("ETA service is not configured.");
        }
        const identity = await dependencies.authenticate(request);
        const response = await dependencies.etaService.updateEta(
          identity,
          assignmentId,
          await readJson(request),
          requireIdempotencyKey(request, "assignment ETA updates")
        );
        return NextResponse.json(response, { status: 201 });
      } catch (error) {
        return routeError(error);
      }
    },

    async addMedia(request: Request, assignmentId: string) {
      try {
        if (!dependencies.mediaService) {
          throw new Error("Media metadata service is not configured.");
        }
        const identity = await dependencies.authenticate(request);
        const response = await dependencies.mediaService.addMedia(
          identity,
          assignmentId,
          await readJson(request),
          requireIdempotencyKey(request, "assignment media metadata")
        );
        return NextResponse.json(response, { status: 201 });
      } catch (error) {
        return routeError(error);
      }
    },

    async submitCompletionChecklist(request: Request, assignmentId: string) {
      try {
        if (!dependencies.completionChecklistService) {
          throw new Error("Completion checklist service is not configured.");
        }
        const identity = await dependencies.authenticate(request);
        const response = await dependencies.completionChecklistService.submitCompletionChecklist(
          identity,
          assignmentId,
          await readJson(request),
          requireIdempotencyKey(request, "assignment completion checklist")
        );
        return NextResponse.json(response, { status: 201 });
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultMechanicOperationsRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  const assignmentMetadataService = new MechanicAssignmentMetadataService(unitOfWork);
  return createMechanicOperationsRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    dashboardService: new MechanicDashboardService(unitOfWork),
    jobListService: new MechanicJobListService(unitOfWork),
    performanceService: new MechanicPerformanceService(unitOfWork),
    etaService: assignmentMetadataService,
    mediaService: assignmentMetadataService,
    completionChecklistService: assignmentMetadataService
  });
}

function queryParams(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
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

function requireIdempotencyKey(request: Request, operationLabel: string): string {
  const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw routeInputError(`X-Idempotency-Key is required for ${operationLabel}.`);
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
  if (isMappedRouteError(error)) {
    return jsonError(error.status, error.errorCode as ApiErrorCode, error.message, {
      details:
        "details" in error && typeof error.details === "object" && error.details !== null
          ? (error.details as Record<string, unknown>)
          : undefined
    });
  }
  return jsonError(500, "INTERNAL_ERROR", "An internal API error occurred.");
}

function isMappedRouteError(
  error: unknown
): error is { status: number; errorCode: string; message: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      "errorCode" in error &&
      "message" in error &&
      typeof error.status === "number" &&
      typeof error.errorCode === "string" &&
      typeof error.message === "string"
  );
}
