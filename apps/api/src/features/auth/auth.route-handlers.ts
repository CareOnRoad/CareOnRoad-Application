import { NextResponse } from "next/server";

import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

import {
  bootstrapProfileSchema,
  registerDeviceSchema,
  rotatePushTokenSchema,
  type BootstrapProfileInput,
  type UpdateProfileInput,
  updateProfileSchema
} from "./auth.schemas";
import { AuthService } from "./auth.service";
import type {
  RegisteredUserDevice,
  RequestActor,
  VerifiedSupabaseIdentity
} from "./auth.types";

export type AuthRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  authService: {
    getCurrentActor(identity: VerifiedSupabaseIdentity): Promise<RequestActor>;
    bootstrapProfile(
      identity: VerifiedSupabaseIdentity,
      input: BootstrapProfileInput
    ): Promise<RequestActor>;
    updateProfile(
      identity: VerifiedSupabaseIdentity,
      input: UpdateProfileInput
    ): Promise<RequestActor>;
    registerDevice(
      identity: VerifiedSupabaseIdentity,
      input: {
        device_key: string;
        platform: string;
        push_provider?: "fcm" | "apns" | "webpush";
        push_token?: string;
      }
    ): Promise<RegisteredUserDevice>;
    rotatePushToken(
      identity: VerifiedSupabaseIdentity,
      deviceId: string,
      input: { push_provider: "fcm" | "apns" | "webpush"; push_token: string }
    ): Promise<RegisteredUserDevice>;
    revokePushToken(
      identity: VerifiedSupabaseIdentity,
      deviceId: string
    ): Promise<RegisteredUserDevice>;
  };
};

export function createAuthRouteHandlers(dependencies: AuthRouteDependencies) {
  return {
    async getMe(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.authService.getCurrentActor(identity));
      } catch (error) {
        return authRouteError(error);
      }
    },

    async bootstrapProfile(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        const parsed = bootstrapProfileSchema.safeParse(await readOptionalJson(request));
        if (!parsed.success) {
          return jsonError(400, "INVALID_INPUT", "Profile input is invalid.", {
            details: { issues: parsed.error.issues }
          });
        }
        return NextResponse.json(
          await dependencies.authService.bootstrapProfile(identity, parsed.data)
        );
      } catch (error) {
        return authRouteError(error);
      }
    },

    async updateProfile(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        const parsed = updateProfileSchema.safeParse(await readOptionalJson(request));
        if (!parsed.success) {
          return jsonError(400, "INVALID_INPUT", "Profile update is invalid.", {
            details: { issues: parsed.error.issues }
          });
        }
        return NextResponse.json(
          await dependencies.authService.updateProfile(identity, parsed.data)
        );
      } catch (error) {
        return authRouteError(error);
      }
    },

    async registerDevice(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        const parsed = registerDeviceSchema.safeParse(await readOptionalJson(request));
        if (!parsed.success) {
          return jsonError(400, "INVALID_INPUT", "Device input is invalid.", {
            details: { issues: parsed.error.issues }
          });
        }
        return NextResponse.json(
          await dependencies.authService.registerDevice(identity, parsed.data)
        );
      } catch (error) {
        return authRouteError(error);
      }
    },

    async rotatePushToken(request: Request, deviceId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        const parsed = rotatePushTokenSchema.safeParse(await readOptionalJson(request));
        if (!parsed.success) {
          return jsonError(400, "INVALID_INPUT", "Push token input is invalid.", {
            details: { issues: parsed.error.issues }
          });
        }
        return NextResponse.json(
          await dependencies.authService.rotatePushToken(identity, deviceId, parsed.data)
        );
      } catch (error) {
        return authRouteError(error);
      }
    },

    async revokePushToken(request: Request, deviceId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.authService.revokePushToken(identity, deviceId)
        );
      } catch (error) {
        return authRouteError(error);
      }
    }
  };
}

export function createDefaultAuthRouteHandlers() {
  return createAuthRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    authService: new AuthService(new PostgresUnitOfWork(getPostgresClient()))
  });
}

async function readOptionalJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return Symbol("invalid-json");
  }
}

function authRouteError(error: unknown) {
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
    return jsonError(
      error.status,
      error.errorCode as ApiErrorCode,
      error.message
    );
  }
  return jsonError(500, "INTERNAL_ERROR", "An internal authentication error occurred.");
}
