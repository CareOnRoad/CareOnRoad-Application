import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";

import { createPaymentRouteHandlers } from "../payment.route-handlers";

const identity: VerifiedSupabaseIdentity = {
  subject: "11111111-1111-4111-8111-111111111111",
  issuer: "https://careonroad.supabase.co/auth/v1",
  audience: ["authenticated"]
};

describe("payment route handlers", () => {
  it("requires an idempotency key before resolving payment review", async () => {
    let called = false;
    const handlers = createPaymentRouteHandlers({ authenticate: async () => identity, authenticateWorker: () => ({ workerId: "worker" }),
      paymentService: { ...paymentService(), async resolvePaymentReview() { called = true; return {}; } } });
    const response = await handlers.resolvePaymentReview(new Request("http://localhost/api/v1/admin/payments/orders/id/resolve", {
      method: "POST", body: JSON.stringify({ action: "confirm_received", reason: "Verified provider receipt" })
    }), "77777777-7777-4777-8777-777777777777");
    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });
  it("requires idempotency for payment order creation", async () => {
    const handlers = createPaymentRouteHandlers({
      authenticate: async () => identity,
      authenticateWorker: () => ({ workerId: "worker" }),
      paymentService: paymentService()
    });

    const response = await handlers.createPaymentOrder(
      new Request("http://localhost/api/v1/payments/orders", {
        method: "POST",
        body: JSON.stringify({ quote_id: "77777777-7777-4777-8777-777777777777" })
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      error_code: "INVALID_INPUT"
    });
    expect(response.status).toBe(400);
  });

  it("maps invalid payOS webhook signature to unauthorized", async () => {
    const handlers = createPaymentRouteHandlers({
      authenticate: async () => identity,
      authenticateWorker: () => ({ workerId: "worker" }),
      paymentService: {
        ...paymentService(),
        async handlePayosWebhook() {
          const error = new Error("Payment webhook signature is invalid.") as Error & {
            status: number;
            errorCode: "UNAUTHORIZED";
          };
          error.status = 401;
          error.errorCode = "UNAUTHORIZED";
          throw error;
        }
      }
    });

    const response = await handlers.handlePayosWebhook(
      new Request("http://localhost/api/v1/payments/webhooks/payos", {
        method: "POST",
        body: JSON.stringify({ data: {}, signature: "bad" })
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      error_code: "UNAUTHORIZED"
    });
    expect(response.status).toBe(401);
  });
});

function paymentService() {
  return {
    async createPaymentOrder() {
      throw new Error("should not execute");
    },
    async getPaymentOrder() {
      throw new Error("should not execute");
    },
    async cancelPaymentOrder() {
      throw new Error("should not execute");
    },
    async handlePayosWebhook() {
      return { received: true as const, matched: false, status: "ignored" as const };
    },
    async reconcilePendingPayments() {
      return { claimed: 0, succeeded: 0, needs_review: 0, still_pending: 0 };
    }
  };
}
