import { NextResponse } from "next/server";

import { jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import { MechanicProfileService } from "./mechanic-profile.service";
import { MotorcycleService, type MotorcycleResponse } from "./motorcycle.service";

export type MotorcycleRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  motorcycleService: {
    createMotorcycle(identity: VerifiedSupabaseIdentity, input: unknown): Promise<MotorcycleResponse>;
    listMotorcycles(identity: VerifiedSupabaseIdentity): Promise<{ items: MotorcycleResponse[] }>;
    getMotorcycle(identity: VerifiedSupabaseIdentity, motorcycleId: string): Promise<MotorcycleResponse>;
    updateMotorcycle(
      identity: VerifiedSupabaseIdentity,
      motorcycleId: string,
      input: unknown
    ): Promise<MotorcycleResponse>;
    archiveMotorcycle(identity: VerifiedSupabaseIdentity, motorcycleId: string): Promise<void>;
  };
  mechanicProfileService: {
    getMyProfile(identity: VerifiedSupabaseIdentity): Promise<unknown>;
    updateMyProfile(identity: VerifiedSupabaseIdentity, input: unknown): Promise<unknown>;
    updateAvailability(identity: VerifiedSupabaseIdentity, input: unknown): Promise<unknown>;
    updateLocation(identity: VerifiedSupabaseIdentity, input: unknown): Promise<void>;
  };
};

export function createMotorcycleRouteHandlers(dependencies: MotorcycleRouteDependencies) {
  return {
    async listMotorcycles(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.motorcycleService.listMotorcycles(identity));
      } catch (error) {
        return routeError(error);
      }
    },

    async createMotorcycle(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        const body = await readJson(request);
        return NextResponse.json(
          await dependencies.motorcycleService.createMotorcycle(identity, body),
          { status: 201 }
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async getMotorcycle(request: Request, motorcycleId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.motorcycleService.getMotorcycle(identity, motorcycleId)
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async updateMotorcycle(request: Request, motorcycleId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        const body = await readJson(request);
        return NextResponse.json(
          await dependencies.motorcycleService.updateMotorcycle(identity, motorcycleId, body)
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async archiveMotorcycle(request: Request, motorcycleId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        await dependencies.motorcycleService.archiveMotorcycle(identity, motorcycleId);
        return new NextResponse(null, { status: 204 });
      } catch (error) {
        return routeError(error);
      }
    },

    async getMyMechanicProfile(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.mechanicProfileService.getMyProfile(identity));
      } catch (error) {
        return routeError(error);
      }
    },

    async updateMyMechanicProfile(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.mechanicProfileService.updateMyProfile(
            identity,
            await readJson(request)
          )
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async updateMechanicAvailability(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.mechanicProfileService.updateAvailability(
            identity,
            await readJson(request)
          )
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async updateMechanicLocation(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        await dependencies.mechanicProfileService.updateLocation(identity, await readJson(request));
        return new NextResponse(null, { status: 204 });
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultMotorcycleRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createMotorcycleRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    motorcycleService: new MotorcycleService(unitOfWork),
    mechanicProfileService: new MechanicProfileService(unitOfWork)
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
