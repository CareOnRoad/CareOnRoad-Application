import { NextResponse } from "next/server";

import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import { AcceptAssignmentService } from "./accept-assignment.service";
import { AssignmentService, type AssignmentResponse } from "./assignment.service";
import {
  AssignmentRecoveryService,
  type AssignmentRecoveryResponse
} from "./assignment-recovery.service";

export type AssignmentRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  acceptService: {
    acceptOffer(identity: VerifiedSupabaseIdentity, offerId: string): Promise<AssignmentResponse>;
  };
  assignmentService: {
    listAssignments(identity: VerifiedSupabaseIdentity): Promise<{ items: AssignmentResponse[] }>;
    transitionAssignment(
      identity: VerifiedSupabaseIdentity,
      assignmentId: string,
      input: unknown
    ): Promise<AssignmentResponse>;
  };
  recoveryService?: {
    recover(
      identity: VerifiedSupabaseIdentity,
      assignmentId: string,
      input: unknown,
      idempotencyKey: string
    ): Promise<AssignmentRecoveryResponse>;
  };
};

export function createAssignmentRouteHandlers(dependencies: AssignmentRouteDependencies) {
  return {
    async acceptOffer(request: Request, offerId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.acceptService.acceptOffer(identity, offerId), {
          status: 201
        });
      } catch (error) {
        return routeError(error);
      }
    },

    async listAssignments(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.assignmentService.listAssignments(identity));
      } catch (error) {
        return routeError(error);
      }
    },

    async transitionAssignment(request: Request, assignmentId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.assignmentService.transitionAssignment(
            identity,
            assignmentId,
            await request.json().catch(() => ({}))
          )
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async recoverAssignment(request: Request, assignmentId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        if (!dependencies.recoveryService) {
          throw new Error("Assignment recovery service is not configured.");
        }
        return NextResponse.json(
          await dependencies.recoveryService.recover(
            identity,
            assignmentId,
            await request.json().catch(() => ({})),
            request.headers.get("x-idempotency-key")?.trim() ?? ""
          )
        );
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultAssignmentRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createAssignmentRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    acceptService: new AcceptAssignmentService(unitOfWork),
    assignmentService: new AssignmentService(unitOfWork),
    recoveryService: new AssignmentRecoveryService(unitOfWork)
  });
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
