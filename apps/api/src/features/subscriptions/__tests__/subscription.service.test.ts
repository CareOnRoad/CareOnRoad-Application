import { beforeEach, describe, expect, it } from "vitest";

import type { UserRole } from "@/features/auth/auth.types";
import type {
  CreateProviderPaymentInput,
  PaymentProviderClient,
  ProviderPaymentLink,
  ProviderPaymentStatus,
  VerifiedPaymentEvent
} from "@/features/payments/payment-provider";
import {
  type InMemoryFoundationState,
  InMemoryUnitOfWork
} from "@/server/repositories/testing/in-memory-unit-of-work";

import { SubscriptionService, resetSubscriptionProviderStatusThrottle } from "../subscription.service";

const RIDER_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_RIDER_ID = "22222222-2222-4222-8222-222222222222";
const MECHANIC_USER_ID = "33333333-3333-4333-8333-333333333333";
const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-01T02:00:00.000Z");

describe("SubscriptionService", () => {
  beforeEach(() => {
    // Throttle provider là module-level; reset để mỗi test độc lập.
    resetSubscriptionProviderStatusThrottle();
  });

  it("lists the three plan tiers with prices, features and the non-refundable notice", async () => {
    const service = createService(createUnitOfWork());
    const catalog = await service.listCatalog(identity(RIDER_USER_ID));

    expect(catalog.plans.map((plan) => plan.code)).toEqual(["free", "advance", "vip"]);
    expect(catalog.plans.map((plan) => plan.price)).toEqual([0, 10000, 50000]);
    expect(catalog.plans.every((plan) => plan.period_days === 30)).toBe(true);
    expect(catalog.plans.find((plan) => plan.code === "free")?.purchasable).toBe(false);
    expect(catalog.plans.find((plan) => plan.code === "advance")?.purchasable).toBe(true);
    expect(catalog.plans.find((plan) => plan.code === "vip")?.purchasable).toBe(true);
    expect(catalog.non_refundable).toBe(true);
    expect(catalog.non_refundable_notice).toContain("không được hoàn tiền");
  });

  it("requires the non-refundable acknowledgement before creating an order", async () => {
    const service = createService(createUnitOfWork());
    await expect(
      service.createSubscriptionOrder(
        identity(RIDER_USER_ID),
        { plan_code: "advance", non_refundable_acknowledged: false },
        "plan-ack-key"
      )
    ).rejects.toMatchObject({ errorCode: "INVALID_INPUT", status: 400 });
  });

  it("rejects purchasing the free plan", async () => {
    const service = createService(createUnitOfWork());
    await expect(
      service.createSubscriptionOrder(
        identity(RIDER_USER_ID),
        { plan_code: "free", non_refundable_acknowledged: true },
        "plan-free-key"
      )
    ).rejects.toMatchObject({ errorCode: "INVALID_INPUT", status: 400 });
  });

  it("creates a pending order with a payOS link and replays the same idempotency key", async () => {
    const unitOfWork = createUnitOfWork();
    const provider = new FakeProvider();
    const service = createService(unitOfWork, provider);

    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-create-key"
    );
    expect(order).toMatchObject({
      plan_code: "advance",
      status: "pending",
      amount: 10000,
      period_days: 30,
      source: "self_purchase"
    });
    expect(order.checkout_url).toContain("pay.payos.vn");
    expect(order.qr_code).toBeTruthy();

    const replayed = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-create-key"
    );
    expect(replayed.id).toBe(order.id);
    expect(unitOfWork.snapshot().planSubscriptions).toHaveLength(1);
    expect(provider.createdLinks).toHaveLength(1);
  });

  it("replays the payOS checkout link, not the pre-provider snapshot", async () => {
    const unitOfWork = createUnitOfWork();
    const provider = new FakeProvider();
    const service = createService(unitOfWork, provider);

    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-replay-link-key"
    );
    // Link payOS được ghi sau khi idempotency đã lưu body.
    expect(order.checkout_url).toBeTruthy();

    const replayed = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-replay-link-key"
    );
    // Replay phải đọc lại từ DB để vẫn có link thanh toán.
    expect(replayed.checkout_url).toBe(order.checkout_url);
    expect(replayed.qr_code).toBe(order.qr_code);
    expect(replayed.status).toBe("pending");
  });

  it("rejects a different payload replayed with the same idempotency key", async () => {
    const service = createService(createUnitOfWork());
    await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-conflict-key"
    );
    await expect(
      service.createSubscriptionOrder(
        identity(RIDER_USER_ID),
        { plan_code: "vip", non_refundable_acknowledged: true },
        "plan-conflict-key"
      )
    ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });
  });

  it("blocks buying a plan lower than the active one", async () => {
    const unitOfWork = createUnitOfWork({
      planCode: "vip",
      planExpiresAt: new Date(now.getTime() + 10 * DAY_MS)
    });
    const service = createService(unitOfWork);
    await expect(
      service.createSubscriptionOrder(
        identity(RIDER_USER_ID),
        { plan_code: "advance", non_refundable_acknowledged: true },
        "plan-downgrade-key"
      )
    ).rejects.toMatchObject({
      errorCode: "CONFLICT",
      status: 409,
      details: { reason: "downgrade_blocked", current_plan: "vip", requested_plan: "advance" }
    });
  });

  it("allows upgrading and carries the remaining days over the new 30-day period", async () => {
    const unitOfWork = createUnitOfWork({
      planCode: "advance",
      planExpiresAt: new Date(now.getTime() + 10 * DAY_MS)
    });
    const service = createService(unitOfWork);
    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "vip", non_refundable_acknowledged: true },
      "plan-upgrade-key"
    );
    expect(order.plan_code).toBe("vip");

    const applied = await service.applyVerifiedProviderEvent({
      kind: "valid",
      eventDedupeKey: "payos-upgrade-event",
      success: true,
      orderCode: order.provider_order_code!,
      amount: 50000,
      currency: "VND",
      paymentLinkId: `link-${order.provider_order_code}`,
      status: "00"
    });
    expect(applied).toMatchObject({ matched: true, status: "succeeded" });

    const actor = unitOfWork.snapshot().users.find((user) => user.id === RIDER_USER_ID);
    // max(current expiry, now) + 30 days = now + 10 days + 30 days.
    expect(actor?.planCode).toBe("vip");
    expect(actor?.planExpiresAt?.toISOString()).toBe(
      new Date(now.getTime() + 40 * DAY_MS).toISOString()
    );
    expect(unitOfWork.snapshot().auditLogs.some((log) => log.action === "subscription.activated")).toBe(true);
    expect(unitOfWork.snapshot().notifications.some((item) => item.type === "subscription.activated")).toBe(true);
  });

  it("starts the new period from now when the previous plan already expired", async () => {
    const unitOfWork = createUnitOfWork({
      planCode: "advance",
      planExpiresAt: new Date(now.getTime() - DAY_MS)
    });
    const service = createService(unitOfWork);
    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "vip", non_refundable_acknowledged: true },
      "plan-renew-key"
    );
    await service.applyVerifiedProviderEvent({
      kind: "valid",
      eventDedupeKey: "payos-renew-event",
      success: true,
      orderCode: order.provider_order_code!,
      amount: 50000,
      currency: "VND",
      status: "00"
    });
    const actor = unitOfWork.snapshot().users.find((user) => user.id === RIDER_USER_ID);
    expect(actor?.planExpiresAt?.toISOString()).toBe(
      new Date(now.getTime() + 30 * DAY_MS).toISOString()
    );
  });

  it("deduplicates repeated webhook deliveries", async () => {
    const unitOfWork = createUnitOfWork();
    const service = createService(unitOfWork);
    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-dedupe-key"
    );
    const event = {
      kind: "valid" as const,
      eventDedupeKey: "payos-dedupe-event",
      success: true,
      orderCode: order.provider_order_code!,
      amount: 10000,
      currency: "VND",
      status: "00"
    };
    await expect(service.applyVerifiedProviderEvent(event)).resolves.toMatchObject({
      status: "succeeded"
    });
    await expect(service.applyVerifiedProviderEvent(event)).resolves.toMatchObject({
      status: "duplicate"
    });
    expect(unitOfWork.snapshot().planSubscriptionEvents).toHaveLength(1);
  });

  it("ignores a webhook that does not match any subscription", async () => {
    const unitOfWork = createUnitOfWork();
    const service = createService(unitOfWork);
    await expect(
      service.applyVerifiedProviderEvent({
        kind: "valid",
        eventDedupeKey: "payos-unknown-event",
        success: true,
        orderCode: 987654,
        amount: 10000,
        currency: "VND",
        status: "00"
      })
    ).resolves.toMatchObject({ matched: false, status: "ignored" });
  });

  it("does not activate a plan when the paid amount does not match", async () => {
    const unitOfWork = createUnitOfWork();
    const service = createService(unitOfWork);
    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-amount-key"
    );
    await expect(
      service.applyVerifiedProviderEvent({
        kind: "valid",
        eventDedupeKey: "payos-amount-event",
        success: true,
        orderCode: order.provider_order_code!,
        amount: 999999,
        currency: "VND",
        status: "00"
      })
    ).resolves.toMatchObject({ status: "failed" });
    const actor = unitOfWork.snapshot().users.find((user) => user.id === RIDER_USER_ID);
    expect(actor?.planCode).toBeUndefined();
  });

  it("returns the current plan and the purchase history", async () => {
    const unitOfWork = createUnitOfWork();
    const service = createService(unitOfWork);
    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-history-key"
    );
    await service.applyVerifiedProviderEvent({
      kind: "valid",
      eventDedupeKey: "payos-history-event",
      success: true,
      orderCode: order.provider_order_code!,
      amount: 10000,
      currency: "VND",
      status: "00"
    });

    const summary = await service.getMySubscription(identity(RIDER_USER_ID));
    expect(summary.current_plan).toBe("advance");
    expect(summary.plan_expires_at).toBe(new Date(now.getTime() + 30 * DAY_MS).toISOString());
    expect(summary.active_subscription?.id).toBe(order.id);
    expect(summary.history).toHaveLength(1);
  });

  it("keeps the order private to its owner", async () => {
    const service = createService(createUnitOfWork());
    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-private-key"
    );
    await expect(
      service.getSubscriptionOrder(identity(OTHER_RIDER_ID), order.id)
    ).rejects.toMatchObject({ errorCode: "FORBIDDEN", status: 403 });
  });

  it("cancels a pending order and rejects cancelling a completed one", async () => {
    const unitOfWork = createUnitOfWork();
    const provider = new FakeProvider();
    const service = createService(unitOfWork, provider);

    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-cancel-key"
    );
    const canceled = await service.cancelSubscriptionOrder(identity(RIDER_USER_ID), order.id);
    expect(canceled.status).toBe("canceled");
    expect(provider.canceledOrderCodes).toContain(order.provider_order_code);

    const second = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-cancel-second-key"
    );
    await service.applyVerifiedProviderEvent({
      kind: "valid",
      eventDedupeKey: "payos-cancel-event",
      success: true,
      orderCode: second.provider_order_code!,
      amount: 10000,
      currency: "VND",
      status: "00"
    });
    await expect(
      service.cancelSubscriptionOrder(identity(RIDER_USER_ID), second.id)
    ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });
  });

  it("forbids non-riders from purchasing a plan", async () => {
    const service = createService(createUnitOfWork());
    await expect(
      service.createSubscriptionOrder(
        identity(MECHANIC_USER_ID),
        { plan_code: "advance", non_refundable_acknowledged: true },
        "plan-mechanic-key"
      )
    ).rejects.toMatchObject({ errorCode: "FORBIDDEN", status: 403 });
  });

  it("passes the client deep-link return/cancel URLs to the payment provider", async () => {
    const unitOfWork = createUnitOfWork();
    const provider = new FakeProvider();
    const service = createService(unitOfWork, provider);

    await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      {
        plan_code: "advance",
        non_refundable_acknowledged: true,
        return_url: "careonroad://rider/plans",
        cancel_url: "exp://127.0.0.1:8081/--/rider/plans"
      },
      "plan-deeplink-key"
    );

    expect(provider.createdLinks).toHaveLength(1);
    expect(provider.createdLinks[0]?.returnUrl).toBe("careonroad://rider/plans");
    expect(provider.createdLinks[0]?.cancelUrl).toBe("exp://127.0.0.1:8081/--/rider/plans");
  });

  it("rejects a return URL that does not use an allowed deep-link scheme", async () => {
    const service = createService(createUnitOfWork());
    await expect(
      service.createSubscriptionOrder(
        identity(RIDER_USER_ID),
        {
          plan_code: "advance",
          non_refundable_acknowledged: true,
          return_url: "https://example.test/plans"
        },
        "plan-bad-url-key"
      )
    ).rejects.toMatchObject({ errorCode: "INVALID_INPUT", status: 400 });
  });

  it("falls back to the configured return URL when the client sends none", async () => {
    const provider = new FakeProvider();
    const service = createService(createUnitOfWork(), provider);

    await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-no-url-key"
    );

    expect(provider.createdLinks[0]?.returnUrl).toBe("https://example.test/plans/return");
    expect(provider.createdLinks[0]?.cancelUrl).toBe("https://example.test/plans/cancel");
  });

  it("retries with the configured URL when the provider rejects the deep link", async () => {
    const provider = new FakeProvider();
    // payOS có thể chỉ nhận http/https → lần đầu với deep-link bị từ chối.
    provider.rejectDeepLink = true;
    const service = createService(createUnitOfWork(), provider);

    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      {
        plan_code: "advance",
        non_refundable_acknowledged: true,
        return_url: "exp://127.0.0.1:8081/--/rider/plans",
        cancel_url: "exp://127.0.0.1:8081/--/rider/plans"
      },
      "plan-deep-link-fallback-key"
    );

    expect(order.status).toBe("pending");
    expect(provider.createdLinks).toHaveLength(2);
    expect(provider.createdLinks[0]?.returnUrl).toBe("exp://127.0.0.1:8081/--/rider/plans");
    expect(provider.createdLinks[1]?.returnUrl).toBe("https://example.test/plans/return");
    expect(provider.createdLinks[1]?.cancelUrl).toBe("https://example.test/plans/cancel");
  });

  it("marks the order failed when the provider rejects every URL", async () => {
    const unitOfWork = createUnitOfWork();
    const provider = new FakeProvider();
    provider.failAlways = true;
    const service = createService(unitOfWork, provider);

    await expect(
      service.createSubscriptionOrder(
        identity(RIDER_USER_ID),
        {
          plan_code: "advance",
          non_refundable_acknowledged: true,
          return_url: "exp://127.0.0.1:8081/--/rider/plans"
        },
        "plan-provider-fail-key"
      )
    ).rejects.toThrow();

    const subscription = unitOfWork.snapshot().planSubscriptions[0];
    expect(subscription?.status).toBe("failed");
    expect(subscription?.failureCode).toBe("provider_error");
  });

  it("activates the plan when reading an order that payOS already marked as paid", async () => {
    const unitOfWork = createUnitOfWork();
    const provider = new FakeProvider();
    const service = createService(unitOfWork, provider);

    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-lazy-sync-key"
    );
    provider.markPaid(order.provider_order_code!, 10000);

    // Webhook không tới được backend (LAN) → lệnh đọc đơn phải tự hỏi payOS.
    const refreshed = await service.getSubscriptionOrder(identity(RIDER_USER_ID), order.id);
    expect(refreshed.status).toBe("succeeded");

    const actor = unitOfWork.snapshot().users.find((user) => user.id === RIDER_USER_ID);
    expect(actor?.planCode).toBe("advance");
    expect(actor?.planExpiresAt?.toISOString()).toBe(
      new Date(now.getTime() + 30 * DAY_MS).toISOString()
    );
  });

  it("keeps the order pending when the provider still reports it as pending", async () => {
    const unitOfWork = createUnitOfWork();
    const provider = new FakeProvider();
    const service = createService(unitOfWork, provider);

    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-still-pending-key"
    );

    const refreshed = await service.getSubscriptionOrder(identity(RIDER_USER_ID), order.id);
    expect(refreshed.status).toBe("pending");
    const actor = unitOfWork.snapshot().users.find((user) => user.id === RIDER_USER_ID);
    expect(actor?.planCode).toBeUndefined();
  });

  it("reconciles stale pending orders in the worker batch", async () => {
    const unitOfWork = createUnitOfWork();
    const provider = new FakeProvider();
    const service = createService(unitOfWork, provider);

    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "vip", non_refundable_acknowledged: true },
      "plan-worker-reconcile-key"
    );
    provider.markPaid(order.provider_order_code!, 50000);

    // Worker chạy sau khi đơn đã cũ hơn 2 phút.
    const later = new Date(now.getTime() + 10 * 60 * 1000);
    const worker = new SubscriptionService(unitOfWork, {
      now: () => later,
      createId: createIdFactory(),
      providerFactory: () => provider,
      returnUrl: () => "https://example.test/plans/return",
      cancelUrl: () => "https://example.test/plans/cancel"
    });

    const result = await worker.reconcilePendingSubscriptions(10);
    expect(result).toMatchObject({ claimed: 1, succeeded: 1, still_pending: 0, failed: 0 });

    const actor = unitOfWork.snapshot().users.find((user) => user.id === RIDER_USER_ID);
    expect(actor?.planCode).toBe("vip");
  });

  it("ignores a late provider event for an order the rider already canceled", async () => {
    const unitOfWork = createUnitOfWork();
    const provider = new FakeProvider();
    const service = createService(unitOfWork, provider);

    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-canceled-late-key"
    );
    await service.cancelSubscriptionOrder(identity(RIDER_USER_ID), order.id);

    const applied = await service.applyVerifiedProviderEvent({
      kind: "valid",
      eventDedupeKey: "payos-late-event",
      success: true,
      orderCode: order.provider_order_code!,
      amount: 10000,
      currency: "VND",
      status: "00"
    });
    expect(applied).toMatchObject({ matched: true, status: "ignored" });

    const actor = unitOfWork.snapshot().users.find((user) => user.id === RIDER_USER_ID);
    expect(actor?.planCode).toBeUndefined();
  });

  it("locks the user row before computing the carried-over expiry", async () => {
    const unitOfWork = createUnitOfWork();
    const provider = new FakeProvider();
    const service = createService(unitOfWork, provider);

    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-lock-user-row-key"
    );
    provider.markPaid(order.provider_order_code!, 10000);

    // Khoá row user là bắt buộc: nếu chỉ đọc (không `for update`) thì 2 đơn
    // kích hoạt đồng thời sẽ cùng đọc một `plan_expires_at` cũ và mất số ngày
    // cộng dồn của nhau.
    const locked = await unitOfWork.execute((repositories) =>
      repositories.users.findActorForUpdate(RIDER_USER_ID)
    );
    expect(locked?.id).toBe(RIDER_USER_ID);

    const refreshed = await service.getSubscriptionOrder(identity(RIDER_USER_ID), order.id);
    expect(refreshed.status).toBe("succeeded");
  });

  it("reports the activated order when the provider event was already recorded", async () => {
    const unitOfWork = createUnitOfWork();
    const provider = new FakeProvider();
    const service = createService(unitOfWork, provider);

    const order = await service.createSubscriptionOrder(
      identity(RIDER_USER_ID),
      { plan_code: "advance", non_refundable_acknowledged: true },
      "plan-duplicate-event-key"
    );
    provider.markPaid(order.provider_order_code!, 10000);

    // Lần đọc đầu kích hoạt gói (ghi event provider).
    const first = await service.getSubscriptionOrder(identity(RIDER_USER_ID), order.id);
    expect(first.status).toBe("succeeded");

    // Lần đọc sau: event của provider đã có trong DB → service phải đọc lại
    // đơn từ DB, không trả lại snapshot `pending` cũ.
    const second = await service.getSubscriptionOrder(identity(RIDER_USER_ID), order.id);
    expect(second.status).toBe("succeeded");
  });
});

class FakeProvider implements PaymentProviderClient {
  readonly createdLinks: CreateProviderPaymentInput[] = [];
  readonly canceledOrderCodes: number[] = [];
  /** Trạng thái payOS theo order code (mô phỏng provider đã thu tiền). */
  readonly paidOrders = new Map<number, number>();
  /** Chỉ từ chối deep-link (scheme không phải http/https) — mô phỏng payOS. */
  rejectDeepLink = false;
  /** Từ chối mọi lần tạo link. */
  failAlways = false;

  markPaid(orderCode: number, amount: number): void {
    this.paidOrders.set(orderCode, amount);
  }

  async createPaymentLink(input: CreateProviderPaymentInput): Promise<ProviderPaymentLink> {
    this.createdLinks.push(input);
    if (this.failAlways) {
      throw new Error("provider unavailable");
    }
    if (this.rejectDeepLink && !input.returnUrl.startsWith("http")) {
      throw new Error("unsupported return url scheme");
    }
    return {
      paymentLinkId: `link-${input.orderCode}`,
      checkoutUrl: `https://pay.payos.vn/web/link-${input.orderCode}`,
      qrCode: `qr-${input.orderCode}`,
      status: "PENDING"
    };
  }

  async cancelPaymentLink(input: {
    orderCode: number;
    cancellationReason: string;
  }): Promise<ProviderPaymentStatus> {
    this.canceledOrderCodes.push(input.orderCode);
    return {
      orderCode: input.orderCode,
      amount: 0,
      currency: "VND",
      status: "CANCELLED"
    };
  }

  async getPaymentStatus(orderCode: number): Promise<ProviderPaymentStatus> {
    const amountPaid = this.paidOrders.get(orderCode);
    if (amountPaid !== undefined) {
      return {
        orderCode,
        amount: amountPaid,
        amountPaid,
        currency: "VND",
        status: "PAID"
      };
    }
    return { orderCode, amount: 0, currency: "VND", status: "PENDING" };
  }

  verifyWebhookPayload(): VerifiedPaymentEvent {
    return { kind: "invalid", reason: "not_used" };
  }
}

function identity(subject: string) {
  return {
    subject,
    issuer: "https://project.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}

function createService(unitOfWork: InMemoryUnitOfWork, provider: FakeProvider = new FakeProvider()) {
  return new SubscriptionService(unitOfWork, {
    now: () => now,
    createId: createIdFactory(),
    providerFactory: () => provider,
    returnUrl: () => "https://example.test/plans/return",
    cancelUrl: () => "https://example.test/plans/cancel"
  });
}

function createIdFactory() {
  let counter = 0;
  return () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
}

function createUnitOfWork(
  riderOverrides: Partial<InMemoryFoundationState["users"][number]> = {}
) {
  return new InMemoryUnitOfWork({
    users: [
      {
        id: RIDER_USER_ID,
        displayName: "Rider",
        status: "active",
        createdAt: now,
        updatedAt: now,
        ...riderOverrides
      },
      {
        id: OTHER_RIDER_ID,
        displayName: "Other Rider",
        status: "active",
        createdAt: now,
        updatedAt: now
      },
      {
        id: MECHANIC_USER_ID,
        displayName: "Mechanic",
        status: "active",
        createdAt: now,
        updatedAt: now
      }
    ],
    userRoles: [
      { userId: RIDER_USER_ID, role: "rider" },
      { userId: OTHER_RIDER_ID, role: "rider" },
      { userId: MECHANIC_USER_ID, role: "mechanic" }
    ] satisfies { userId: string; role: UserRole }[]
  });
}
