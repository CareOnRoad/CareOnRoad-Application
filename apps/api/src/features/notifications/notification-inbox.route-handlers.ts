import { NextResponse } from "next/server";

import type { ApiErrorCode } from "@/lib/api-error";
import { databaseJsonError, jsonError } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import { NotificationInboxService } from "./notification-inbox.service";

export type NotificationInboxRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  service: {
    list(identity: VerifiedSupabaseIdentity, input: unknown): Promise<unknown>;
    unreadCount(identity: VerifiedSupabaseIdentity): Promise<unknown>;
    markRead(identity: VerifiedSupabaseIdentity, notificationId: string): Promise<unknown>;
    markAllRead(identity: VerifiedSupabaseIdentity): Promise<unknown>;
  };
};

export function createNotificationInboxRouteHandlers(
  dependencies: NotificationInboxRouteDependencies
) {
  return {
    async list(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        const query = Object.fromEntries(new URL(request.url).searchParams.entries());
        return NextResponse.json(await dependencies.service.list(identity, query));
      } catch (error) {
        return routeError(error);
      }
    },
    async unreadCount(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.service.unreadCount(identity));
      } catch (error) {
        return routeError(error);
      }
    },
    async markRead(request: Request, notificationId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.service.markRead(identity, notificationId)
        );
      } catch (error) {
        return routeError(error);
      }
    },
    async markAllRead(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.service.markAllRead(identity));
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultNotificationInboxRouteHandlers() {
  return createNotificationInboxRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    service: new NotificationInboxService(
      new PostgresUnitOfWork(getPostgresClient())
    )
  });
}

function routeError(error: unknown) {
  if (error instanceof DatabaseError) return databaseJsonError(error);
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
    return jsonError(error.status, error.errorCode as ApiErrorCode, error.message);
  }
  return jsonError(500, "INTERNAL_ERROR", "An internal API error occurred.");
}
