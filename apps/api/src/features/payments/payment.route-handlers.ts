import { NextResponse } from "next/server";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { authenticateWorkerSecret, type WorkerAuthority } from "@/server/auth/worker-secret";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { recordWorkerRun } from "@/server/workers/worker-run-recorder";

import {
  PayosClient,
  payosCancelUrl,
  payosReturnUrl,
  payosSubscriptionCancelUrl,
  payosSubscriptionReturnUrl
} from "./payos.client";
import { SubscriptionService, type SubscriptionReconcileResult } from "@/features/subscriptions/subscription.service";
import {
  PaymentService,
  type PaymentOrderResponse,
  type PaymentReconcileResult,
  type PaymentWebhookResponse
} from "./payment.service";
import type { PaymentSummaryResponse } from "./payment.service";
export type PaymentRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  authenticateWorker(request: Request): WorkerAuthority;
  paymentService: {
    resolvePaymentReview?(identity: VerifiedSupabaseIdentity, paymentOrderId: string, input: unknown, idempotencyKey: string): Promise<Record<string, unknown>>;
    getPaymentSummary?(identity: VerifiedSupabaseIdentity, requestId: string): Promise<PaymentSummaryResponse>;
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
  /**
   * Reconcile đơn đăng ký gói (plan subscription).
   *
   * Dùng chung route worker `payments/reconcile` vì payOS dùng chung sequence
   * order code cho cả thanh toán sửa chữa lẫn mua gói.
   */
  subscriptionService?: {
    reconcilePendingSubscriptions(limit?: number): Promise<SubscriptionReconcileResult>;
  };
  recordReconciliation?<T>(run: () => Promise<T>, summarize: (result: T) => { claimed: number; succeeded: number; failed: number }): Promise<T>;
};

export function createPaymentRouteHandlers(dependencies: PaymentRouteDependencies) {
  return {
    async resolvePaymentReview(request: Request, paymentOrderId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        if (!dependencies.paymentService.resolvePaymentReview) throw new Error("Payment review is not configured.");
        return NextResponse.json(await dependencies.paymentService.resolvePaymentReview(identity, paymentOrderId,
          await readJson(request), requireIdempotencyKey(request, "payment review resolution")));
      } catch (error) { return routeError(error); }
    },
    async getPaymentSummary(request: Request, requestId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        if (!dependencies.paymentService.getPaymentSummary) throw new Error("Payment summary is not configured.");
        return NextResponse.json(await dependencies.paymentService.getPaymentSummary(identity, requestId));
      } catch (error) { return routeError(error); }
    },
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
        const run = async () => {
          const payments = await dependencies.paymentService.reconcilePendingPayments(limit);
          const subscriptions = dependencies.subscriptionService
            ? await dependencies.subscriptionService.reconcilePendingSubscriptions(limit)
            : undefined;
          return {
            ...payments,
            ...(subscriptions
              ? {
                  subscriptions_claimed: subscriptions.claimed,
                  subscriptions_succeeded: subscriptions.succeeded,
                  subscriptions_still_pending: subscriptions.still_pending,
                  subscriptions_failed: subscriptions.failed
                }
              : {})
          };
        };
        const summarize = (result: ReturnType<typeof run> extends Promise<infer R> ? R : never) => ({
          claimed: result.claimed + (result.subscriptions_claimed ?? 0),
          succeeded:
            result.succeeded +
            result.needs_review +
            result.still_pending +
            (result.subscriptions_succeeded ?? 0) +
            (result.subscriptions_still_pending ?? 0),
          failed: (result.failed ?? 0) + (result.subscriptions_failed ?? 0)
        });
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
  const subscriptionService = new SubscriptionService(unitOfWork, {
    providerFactory: () => new PayosClient(),
    returnUrl: () => payosSubscriptionReturnUrl(),
    cancelUrl: () => payosSubscriptionCancelUrl()
  });
  return createPaymentRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    authenticateWorker: authenticateWorkerSecret,
    paymentService: new PaymentService(unitOfWork, {
      providerFactory: () => new PayosClient(),
      returnUrl: () => payosReturnUrl(),
      cancelUrl: () => payosCancelUrl(),
      subscriptionService
    }),
    subscriptionService,
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
