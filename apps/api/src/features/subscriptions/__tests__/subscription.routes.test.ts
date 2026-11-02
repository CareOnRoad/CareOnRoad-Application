import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";

import { createSubscriptionRouteHandlers } from "../subscription.route-handlers";

const identity: VerifiedSupabaseIdentity = {
  subject: "11111111-1111-4111-8111-111111111111",
  issuer: "https://project.supabase.co/auth/v1",
  audience: ["authenticated"]
};

const orderId = "22222222-2222-4222-8222-222222222222";

describe("subscription routes", () => {
  it("returns the plan catalog for an authenticated rider", async () => {
    const handlers = createSubscriptionRouteHandlers({
      authenticate: async () => identity,
      subscriptionService: {
        listCatalog: async () => ({
          plans: [
            {
              code: "advance",
              name: "Advance",
              tagline: "",
              price: 10000,
              currency: "VND",
              period_days: 30,
              purchasable: true,
              features: []
            }
          ],
          non_refundable: true,
          non_refundable_notice: "Không được hoàn tiền."
        }),
        getMySubscription: async () => ({
          current_plan: "free",
          history: []
        }),
        createSubscriptionOrder: async () => orderResponse(),
        getSubscriptionOrder: async () => orderResponse(),
        cancelSubscriptionOrder: async () => orderResponse()
      }
    });

    const response = await handlers.listPlans(new Request("http://localhost/api/v1/plans"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ non_refundable: true });
  });

  it("requires an idempotency key when creating an order", async () => {
    const handlers = createSubscriptionRouteHandlers({
      authenticate: async () => identity,
      subscriptionService: {
        listCatalog: async () => ({ plans: [], non_refundable: true, non_refundable_notice: "" }),
        getMySubscription: async () => ({ current_plan: "free", history: [] }),
        createSubscriptionOrder: async () => orderResponse(),
        getSubscriptionOrder: async () => orderResponse(),
        cancelSubscriptionOrder: async () => orderResponse()
      }
    });

    const response = await handlers.createSubscriptionOrder(
      new Request("http://localhost/api/v1/subscription/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan_code: "advance", non_refundable_acknowledged: true })
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error_code: "INVALID_INPUT" });
  });

  it("forwards the order creation and returns 201", async () => {
    let captured: { plan: unknown; key: string } | undefined;
    const handlers = createSubscriptionRouteHandlers({
      authenticate: async () => identity,
      subscriptionService: {
        listCatalog: async () => ({ plans: [], non_refundable: true, non_refundable_notice: "" }),
        getMySubscription: async () => ({ current_plan: "free", history: [] }),
        createSubscriptionOrder: async (_actor, input, key) => {
          captured = { plan: input, key };
          return orderResponse();
        },
        getSubscriptionOrder: async () => orderResponse(),
        cancelSubscriptionOrder: async () => orderResponse()
      }
    });

    const response = await handlers.createSubscriptionOrder(
      new Request("http://localhost/api/v1/subscription/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "plan-order-key" },
        body: JSON.stringify({ plan_code: "advance", non_refundable_acknowledged: true })
      })
    );
    expect(response.status).toBe(201);
    expect(captured?.key).toBe("plan-order-key");
    expect(captured?.plan).toEqual({ plan_code: "advance", non_refundable_acknowledged: true });
  });

  it("forwards the deep-link return/cancel URLs from the request body", async () => {
    let captured: { plan: unknown; key: string } | undefined;
    const handlers = createSubscriptionRouteHandlers({
      authenticate: async () => identity,
      subscriptionService: {
        listCatalog: async () => ({ plans: [], non_refundable: true, non_refundable_notice: "" }),
        getMySubscription: async () => ({ current_plan: "free", history: [] }),
        createSubscriptionOrder: async (_actor, input, key) => {
          captured = { plan: input, key };
          return orderResponse();
        },
        getSubscriptionOrder: async () => orderResponse(),
        cancelSubscriptionOrder: async () => orderResponse()
      }
    });

    const response = await handlers.createSubscriptionOrder(
      new Request("http://localhost/api/v1/subscription/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "plan-order-key" },
        body: JSON.stringify({
          plan_code: "advance",
          non_refundable_acknowledged: true,
          return_url: "careonroad://rider/plans",
          cancel_url: "careonroad://rider/plans"
        })
      })
    );
    expect(response.status).toBe(201);
    expect(captured?.plan).toEqual({
      plan_code: "advance",
      non_refundable_acknowledged: true,
      return_url: "careonroad://rider/plans",
      cancel_url: "careonroad://rider/plans"
    });
  });

  it("maps a downgrade conflict to 409 with the downgrade reason", async () => {
    const handlers = createSubscriptionRouteHandlers({
      authenticate: async () => identity,
      subscriptionService: {
        listCatalog: async () => ({ plans: [], non_refundable: true, non_refundable_notice: "" }),
        getMySubscription: async () => ({ current_plan: "free", history: [] }),
        createSubscriptionOrder: async () => {
          const error = new Error("blocked") as Error & {
            status: number;
            errorCode: string;
            details?: Record<string, unknown>;
          };
          error.status = 409;
          error.errorCode = "CONFLICT";
          error.details = { reason: "downgrade_blocked" };
          throw error;
        },
        getSubscriptionOrder: async () => orderResponse(),
        cancelSubscriptionOrder: async () => orderResponse()
      }
    });

    const response = await handlers.createSubscriptionOrder(
      new Request("http://localhost/api/v1/subscription/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "plan-order-key" },
        body: JSON.stringify({ plan_code: "advance", non_refundable_acknowledged: true })
      })
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error_code: "CONFLICT",
      details: { reason: "downgrade_blocked" }
    });
  });

  it("reads and cancels an order by id", async () => {
    const seen: string[] = [];
    const handlers = createSubscriptionRouteHandlers({
      authenticate: async () => identity,
      subscriptionService: {
        listCatalog: async () => ({ plans: [], non_refundable: true, non_refundable_notice: "" }),
        getMySubscription: async () => ({ current_plan: "free", history: [] }),
        createSubscriptionOrder: async () => orderResponse(),
        getSubscriptionOrder: async (_actor, id) => {
          seen.push(id);
          return orderResponse();
        },
        cancelSubscriptionOrder: async (_actor, id) => {
          seen.push(id);
          return orderResponse();
        }
      }
    });

    const read = await handlers.getSubscriptionOrder(
      new Request(`http://localhost/api/v1/subscription/orders/${orderId}`),
      orderId
    );
    expect(read.status).toBe(200);
    const canceled = await handlers.cancelSubscriptionOrder(
      new Request(`http://localhost/api/v1/subscription/orders/${orderId}/cancel`, { method: "POST" }),
      orderId
    );
    expect(canceled.status).toBe(200);
    expect(seen).toEqual([orderId, orderId]);
  });
});

function orderResponse() {
  return {
    id: orderId,
    user_id: identity.subject,
    plan_code: "advance" as const,
    source: "self_purchase" as const,
    status: "pending" as const,
    currency: "VND" as const,
    amount: 10000,
    period_days: 30,
    provider_order_code: 100001,
    checkout_url: "https://pay.payos.vn/web/link-100001",
    qr_code: "qr-100001",
    created_at: "2026-11-01T02:00:00.000Z",
    updated_at: "2026-11-01T02:00:00.000Z"
  };
}
