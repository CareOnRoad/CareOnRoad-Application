import { NextResponse } from "next/server";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { authenticateWorkerSecret, type WorkerAuthority } from "@/server/auth/worker-secret";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { recordWorkerRun } from "@/server/workers/worker-run-recorder";

import { PayosClient, payosCancelUrl, payosReturnUrl } from "./payos.client";
import {
  PaymentService,
  type PaymentOrderResponse,
  type PaymentReconcileResult,
  type PaymentWebhookResponse
} from "./payment.service";

export type PaymentRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  authenticateWorker(request: Request): WorkerAuthority;
  paymentService: {
    createPaymentOrder(
      identity: VerifiedSupabaseIdentity,
      input: unknown,
      idempotencyKey: string
    ): Promise<PaymentOrderResponse>;
    getPaymentOrder(
      identity: VerifiedSupabaseIdentity,
      paymentOrderId: string
    ): Promise<PaymentOrderResponse>;
    cancelPaymentOrder(
      identity: VerifiedSupabaseIdentity,
      paymentOrderId: string
    ): Promise<PaymentOrderResponse>;
    handlePayosWebhook(payload: unknown): Promise<PaymentWebhookResponse>;
    reconcilePendingPayments(limit?: number): Promise<PaymentReconcileResult>;
  };
  recordReconciliation?<T>(run: () => Promise<T>, summarize: (result: T) => { claimed: number; succeeded: number; failed: number }): Promise<T>;
};

export function createPaymentRouteHandlers(dependencies: PaymentRouteDependencies) {
  return {
    async createPaymentOrder(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        const response = await dependencies.paymentService.createPaymentOrder(
          identity,
          await readJson(request),
          requireIdempotencyKey(request, "payment order creation")
        );
        return NextResponse.json(response, { status: response.status === "pending" ? 201 : 200 });
      } catch (error) {
        return routeError(error);
      }
    },

    async getPaymentOrder(request: Request, paymentOrderId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.paymentService.getPaymentOrder(identity, paymentOrderId)
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async cancelPaymentOrder(request: Request, paymentOrderId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.paymentService.cancelPaymentOrder(identity, paymentOrderId)
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async handlePayosWebhook(request: Request) {
      try {
        return NextResponse.json(
          await dependencies.paymentService.handlePayosWebhook(await readJson(request))
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async reconcilePendingPayments(request: Request) {
      try {
        dependencies.authenticateWorker(request);
        const limit = Number(new URL(request.url).searchParams.get("limit") ?? "20");
        const run = () => dependencies.paymentService.reconcilePendingPayments(limit);
        const summarize = (result: PaymentReconcileResult) => ({ claimed: result.claimed, succeeded: result.succeeded + result.needs_review + result.still_pending, failed: 0 });
        return NextResponse.json(
          dependencies.recordReconciliation ? await dependencies.recordReconciliation(run, summarize) : await run(),
          { status: 202 }
        );
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultPaymentRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createPaymentRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    authenticateWorker: authenticateWorkerSecret,
    paymentService: new PaymentService(unitOfWork, {
      providerFactory: () => new PayosClient(),
      returnUrl: () => payosReturnUrl(),
      cancelUrl: () => payosCancelUrl()
    }),
    recordReconciliation: (run, summarize) => recordWorkerRun({ unitOfWork, workerName: "payments_reconcile", run, summarize })
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
