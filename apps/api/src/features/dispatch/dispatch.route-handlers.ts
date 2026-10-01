import { NextResponse } from "next/server";

import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { z } from "zod";

import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import {
  DispatchService,
  type DispatchRoundResponse,
  type DispatchCandidateResponse
} from "./dispatch.service";

export type DispatchRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  dispatchService: {
    startDispatch(identity: VerifiedSupabaseIdentity, requestId: string): Promise<DispatchRoundResponse>;
    listMyOffers(identity: VerifiedSupabaseIdentity): Promise<{ items: DispatchCandidateResponse[] }>;
    declineOffer(identity: VerifiedSupabaseIdentity, offerId: string): Promise<void>;
    recallRescueMechanic?(identity: VerifiedSupabaseIdentity, requestId: string, mechanicId: string): Promise<DispatchRoundResponse>;
  };
};

export function createDispatchRouteHandlers(dependencies: DispatchRouteDependencies) {
  return {
    async recallRescueMechanic(request: Request, requestId: string, mechanicId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        if (!z.string().uuid().safeParse(requestId).success || !z.string().uuid().safeParse(mechanicId).success) return jsonError(400, "INVALID_INPUT", "Request and mechanic ids must be UUIDs.");
        if (!dependencies.dispatchService.recallRescueMechanic) throw new Error("Rescue recall is not configured.");
        return NextResponse.json(await dependencies.dispatchService.recallRescueMechanic(identity, requestId, mechanicId), { status: 202 });
      } catch (error) { return routeError(error); }
    },
    async startDispatch(request: Request, requestId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.dispatchService.startDispatch(identity, requestId),
          { status: 202 }
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async listMyOffers(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.dispatchService.listMyOffers(identity));
      } catch (error) {
        return routeError(error);
      }
    },

    async declineOffer(request: Request, offerId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        await dependencies.dispatchService.declineOffer(identity, offerId);
        return new NextResponse(null, { status: 204 });
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultDispatchRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createDispatchRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    dispatchService: new DispatchService(unitOfWork)
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
