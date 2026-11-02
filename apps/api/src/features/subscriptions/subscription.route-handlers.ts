import { NextResponse } from "next/server";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import {
  PayosClient,
  payosSubscriptionCancelUrl,
  payosSubscriptionReturnUrl
} from "@/features/payments/payos.client";

import {
  SubscriptionService,
  type PlanCatalogResponse,
  type SubscriptionOrderResponse,
  type SubscriptionSummaryResponse
} from "./subscription.service";

export type SubscriptionRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  subscriptionService: {
    listCatalog(identity: VerifiedSupabaseIdentity): Promise<PlanCatalogResponse>;
    getMySubscription(identity: VerifiedSupabaseIdentity): Promise<SubscriptionSummaryResponse>;
    createSubscriptionOrder(
      identity: VerifiedSupabaseIdentity,
      input: unknown,
      idempotencyKey: string
    ): Promise<SubscriptionOrderResponse>;
    getSubscriptionOrder(
      identity: VerifiedSupabaseIdentity,
      subscriptionOrderId: string
    ): Promise<SubscriptionOrderResponse>;
    cancelSubscriptionOrder(
      identity: VerifiedSupabaseIdentity,
      subscriptionOrderId: string
    ): Promise<SubscriptionOrderResponse>;
  };
};

export function createSubscriptionRouteHandlers(dependencies: SubscriptionRouteDependencies) {
  return {
    async listPlans(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.subscriptionService.listCatalog(identity));
      } catch (error) {
        return routeError(error);
      }
    },

    async getMySubscription(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.subscriptionService.getMySubscription(identity)
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async createSubscriptionOrder(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        const response = await dependencies.subscriptionService.createSubscriptionOrder(
          identity,
          await readJson(request),
          requireIdempotencyKey(request, "subscription order creation")
        );
        return NextResponse.json(response, { status: 201 });
      } catch (error) {
        return routeError(error);
      }
    },

    async getSubscriptionOrder(request: Request, subscriptionOrderId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.subscriptionService.getSubscriptionOrder(identity, subscriptionOrderId)
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async cancelSubscriptionOrder(request: Request, subscriptionOrderId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.subscriptionService.cancelSubscriptionOrder(
            identity,
            subscriptionOrderId
          )
        );
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultSubscriptionRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createSubscriptionRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    subscriptionService: new SubscriptionService(unitOfWork, {
      providerFactory: () => new PayosClient(),
      returnUrl: () => payosSubscriptionReturnUrl(),
      cancelUrl: () => payosSubscriptionCancelUrl()
    })
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
