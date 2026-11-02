import { randomUUID } from "node:crypto";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { loadActiveActor } from "@/features/assignments/assignment.service";
import { persistNotification } from "@/features/notifications/notification.service";
import {
  comparePlans,
  effectivePlan,
  planExpiryAfterPurchase,
  type PaidPlanCode,
  type PlanCode
} from "@/features/plans/plan";
import {
  getPlanCatalog,
  getPlanEntry,
  isPurchasablePlan,
  NON_REFUNDABLE_NOTICE
} from "@/features/plans/plan-catalog";
import { prepareIdempotency } from "@/lib/idempotency";
import type { ApiErrorCode } from "@/lib/api-error";
import type { PlanSubscription } from "@/server/repositories/contracts/subscription.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import type { ApplicationActor } from "@/server/repositories/contracts/user.repository";

import type {
  PaymentProviderClient,
  ProviderPaymentStatus,
  VerifiedPaymentEvent
} from "@/features/payments/payment-provider";

import {
  createSubscriptionOrderSchema,
  subscriptionOrderIdParamSchema
} from "./subscription.schemas";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SUBSCRIPTION_EXPIRY_MS = 30 * 60 * 1000;
const HISTORY_LIMIT = 20;
/**
 * Khoảng cách tối thiểu giữa 2 lần hỏi payOS về cùng một đơn (ms).
 *
 * Màn hình QR poll `GET /subscription/orders/{id}` mỗi 4s; nếu mỗi lần poll
 * đều gọi payOS thì dễ bị chặn rate-limit. 30s đủ để phản hồi nhanh mà
 * vẫn giảm tải provider.
 */
const PROVIDER_STATUS_THROTTLE_MS = 30_000;
/** Đơn cũ hơn mốc này mới được worker quét lại (giống luồng repair payment). */
const RECONCILE_STALE_MS = 2 * 60 * 1000;
/** Số đơn tối đa một lượt worker được xử lý. */
const RECONCILE_MAX_LIMIT = 50;
/** Số đơn chờ tối đa được đồng bộ khi đọc `/subscription` (lazy sync). */
const MAX_LAZY_SYNC_ORDERS = 5;

/**
 * Cache throttle theo `providerOrderCode` (module-level).
 *
 * Dùng Map thay vì field trên service để mọi instance service trong cùng
 * process dùng chung nhịp throttle (route handler + worker có thể tạo service
 * riêng). Map được cắt bỏ khi quá lớn để không rò rỉ bộ nhớ.
 */
const providerStatusThrottle = new Map<number, number>();

/**
 * Xoá cache throttle (chỉ dùng trong test).
 *
 * Map là module-level nên các test dùng lại cùng `providerOrderCode` sẽ bị
 * throttle của test trước. Hàm này giữ test độc lập với nhau.
 */
export function resetSubscriptionProviderStatusThrottle(): void {
  providerStatusThrottle.clear();
}

export type PlanCatalogResponse = {
  plans: {
    code: PlanCode;
    name: string;
    tagline: string;
    price: number;
    currency: "VND";
    period_days: number;
    purchasable: boolean;
    features: string[];
    note?: string;
  }[];
  non_refundable: true;
  non_refundable_notice: string;
};

export type SubscriptionOrderResponse = {
  id: string;
  user_id: string;
  plan_code: PaidPlanCode;
  source: "self_purchase";
  status: PlanSubscription["status"];
  currency: "VND";
  amount: number;
  period_days: number;
  provider_order_code?: number;
  checkout_url?: string;
  qr_code?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  succeeded_at?: string;
  canceled_at?: string;
};

export type SubscriptionSummaryResponse = {
  current_plan: PlanCode;
  plan_expires_at?: string;
  active_subscription?: SubscriptionOrderResponse;
  history: SubscriptionOrderResponse[];
};

export type SubscriptionReconcileResult = {
  claimed: number;
  succeeded: number;
  still_pending: number;
  failed: number;
};

export type SubscriptionServiceOptions = {
  now?: () => Date;
  createId?: () => string;
  providerFactory: () => PaymentProviderClient;
  returnUrl: () => string;
  cancelUrl: () => string;
};

export class SubscriptionService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: SubscriptionServiceOptions
  ) {}

  /** Catalog gói + điều khoản không hoàn tiền. */
  async listCatalog(identity: VerifiedSupabaseIdentity): Promise<PlanCatalogResponse> {
    await this.unitOfWork.execute(async (repositories) => {
      await loadActiveActor(repositories, identity.subject);
      return undefined;
    });
    return {
      plans: getPlanCatalog().map((entry) => ({
        code: entry.code,
        name: entry.name,
        tagline: entry.tagline,
        price: entry.price,
        currency: entry.currency,
        period_days: entry.periodDays,
        purchasable: entry.purchasable,
        features: entry.features,
        ...(entry.note ? { note: entry.note } : {})
      })),
      non_refundable: true,
      non_refundable_notice: NON_REFUNDABLE_NOTICE
    };
  }

  /** Trạng thái gói hiện tại + lịch sử mua/được cấp. */
  async getMySubscription(identity: VerifiedSupabaseIdentity): Promise<SubscriptionSummaryResponse> {
    const snapshot = await this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const now = this.now();
      const history = await repositories.subscriptions.listForUser(actor.id, HISTORY_LIMIT);
      const currentPlan = effectivePlan(actor, now);
      const active = history.find(
        (subscription) =>
          subscription.status === "succeeded" &&
          subscription.expiresAt &&
          subscription.expiresAt.getTime() > now.getTime()
      );
      return {
        actor,
        now,
        currentPlan,
        active,
        history
      };
    });

    // Đồng bộ trạng thái thật từ payOS cho các đơn còn chờ (có throttle).
    // Bù cho webhook không tới được backend — người dùng quay lại app sau khi
    // thanh toán vẫn thấy gói đã kích hoạt ngay.
    const refreshedHistory = await this.syncPendingSubscriptions(snapshot.history);
    const refreshedActor =
      refreshedHistory !== snapshot.history
        ? await this.unitOfWork.execute(async (repositories) => {
            const actor = await repositories.users.findActorById(snapshot.actor.id);
            return actor ?? snapshot.actor;
          })
        : snapshot.actor;

    const currentPlan = effectivePlan(refreshedActor, snapshot.now);
    const active = refreshedHistory.find(
      (subscription) =>
        subscription.status === "succeeded" &&
        subscription.expiresAt &&
        subscription.expiresAt.getTime() > snapshot.now.getTime()
    );
    return {
      current_plan: currentPlan,
      ...(refreshedActor.planExpiresAt
        ? { plan_expires_at: refreshedActor.planExpiresAt.toISOString() }
        : {}),
      ...(active ? { active_subscription: toSubscriptionResponse(active) } : {}),
      history: refreshedHistory.map(toSubscriptionResponse)
    };
  }

  /**
   * Đồng bộ trạng thái từ payOS cho tối đa `MAX_LAZY_SYNC_ORDERS` đơn đang chờ.
   *
   * Chỉ đơn `created`/`pending` mới cần hỏi provider; `syncWithProvider` tự
   * throttle 30s/order-code nên an toàn khi mobile gọi `/subscription` thường xuyên.
   */
  private async syncPendingSubscriptions(
    history: PlanSubscription[]
  ): Promise<PlanSubscription[]> {
    const pending = history
      .filter(
        (subscription) =>
          ["created", "pending"].includes(subscription.status) &&
          subscription.providerOrderCode !== undefined
      )
      .slice(0, MAX_LAZY_SYNC_ORDERS);
    if (pending.length === 0) return history;

    const refreshed = new Map<string, PlanSubscription>();
    for (const subscription of pending) {
      try {
        const next = await this.syncWithProvider(subscription);
        refreshed.set(next.id, next);
      } catch {
        refreshed.set(subscription.id, subscription);
      }
    }
    return history.map((subscription) => refreshed.get(subscription.id) ?? subscription);
  }

  /**
   * Tạo đơn đăng ký gói và khởi tạo link thanh toán payOS.
   *
   * - Chặn hạ cấp (mua gói thấp hơn gói đang hiệu lực) → 409.
   * - Bắt buộc xác nhận điều khoản không hoàn tiền.
   * - Idempotent theo `X-Idempotency-Key`.
   */
  async createSubscriptionOrder(
    identity: VerifiedSupabaseIdentity,
    input: unknown,
    idempotencyKey: string
  ): Promise<SubscriptionOrderResponse> {
    const parsed = createSubscriptionOrderSchema.safeParse(input);
    if (!parsed.success) {
      throw new SubscriptionError("INVALID_INPUT", "Subscription order input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }
    const key = normalizeIdempotencyKey(idempotencyKey);
    const plan = parsed.data.plan_code as PaidPlanCode;
    if (!isPurchasablePlan(plan)) {
      throw new SubscriptionError("INVALID_INPUT", "The free plan cannot be purchased.", 400);
    }
    const entry = getPlanEntry(plan);
    if (!entry) {
      throw new SubscriptionError("INVALID_INPUT", "Plan is not available.", 400);
    }

    const scope = "POST /api/v1/subscription/orders";
    const prepared = await this.unitOfWork.execute(
      async (repositories): Promise<
        | { kind: "replay"; response: SubscriptionOrderResponse }
        | { kind: "execute"; actor: ApplicationActor; now: Date }
      > => {
        const actor = await loadActiveActor(repositories, identity.subject);
        if (!actor.roles.includes("rider")) {
          throw new SubscriptionError("FORBIDDEN", "Only riders may purchase plans.", 403);
        }
        const now = this.now();
        const decision = await prepareIdempotency(repositories.idempotency, {
          actorId: actor.id,
          scope,
          idempotencyKey: key,
          request: parsed.data,
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
          id: this.createId()
        });
        if (decision.action === "conflict") {
          throw new SubscriptionError("CONFLICT", "Idempotency key payload mismatch.", 409);
        }
        if (decision.action === "in_progress") {
          throw new SubscriptionError("CONFLICT", "Idempotency key is already in progress.", 409);
        }
        if (decision.action === "replay") {
          // Body đã lưu là snapshot lúc tạo đơn (trước khi có link payOS).
          // Đọc lại từ DB để replay trả về `checkout_url`/`qr_code` và trạng
          // thái mới nhất — nếu không, lần retry sau lỗi mạng sẽ không có QR.
          const subscriptionId = decision.resourceId;
          if (!subscriptionId) {
            return {
              kind: "replay",
              response: decision.responseBody as unknown as SubscriptionOrderResponse
            };
          }
          const stored = await repositories.subscriptions.findById(subscriptionId);
          if (!stored) {
            return {
              kind: "replay",
              response: decision.responseBody as unknown as SubscriptionOrderResponse
            };
          }
          return { kind: "replay", response: toSubscriptionResponse(stored) };
        }
        const currentPlan = effectivePlan(actor, now);
        // Chặn hạ cấp: gói đang hiệu lực cao hơn gói mua mới.
        if (currentPlan !== "free" && comparePlans(plan, currentPlan) < 0) {
          throw new SubscriptionError(
            "CONFLICT",
            "You cannot purchase a plan lower than your current active plan.",
            409,
            { reason: "downgrade_blocked", current_plan: currentPlan, requested_plan: plan }
          );
        }
        return { kind: "execute", actor, now };
      }
    );
    if (prepared.kind === "replay") return prepared.response;

    const { actor, now } = prepared;
    const created = await this.unitOfWork.execute(async (repositories) => {
      const providerOrderCode = await repositories.subscriptions.allocateProviderOrderCode();
      const subscription = await repositories.subscriptions.create({
        id: this.createId(),
        userId: actor.id,
        planCode: plan,
        source: "self_purchase",
        provider: "payos",
        providerOrderCode,
        status: "created",
        currency: "VND",
        amount: entry.price,
        periodDays: entry.periodDays,
        nonRefundableAcknowledged: true,
        createdAt: now,
        updatedAt: now
      });
      await appendSubscriptionAuditOutbox(repositories, {
        action: "subscription.order.created",
        subscription,
        actorId: actor.id,
        actorRole: "rider",
        now,
        createId: () => this.createId()
      });
      await repositories.idempotency.complete({
        actorId: actor.id,
        scope,
        idempotencyKey: key,
        responseStatus: 201,
        responseBody: toSubscriptionResponse(subscription) as unknown as Record<string, unknown>,
        resourceType: "plan_subscription",
        resourceId: subscription.id,
        completedAt: now
      });
      return subscription;
    });

    const provider = this.options.providerFactory();
    // Deep-link do client gửi lên được ưu tiên: payOS sẽ đưa người dùng thẳng
    // về app sau khi thanh toán. Nếu không có thì fallback về URL cấu hình env.
    const fallbackReturnUrl = this.options.returnUrl();
    const fallbackCancelUrl = this.options.cancelUrl();
    const requestedReturnUrl = parsed.data.return_url ?? fallbackReturnUrl;
    const requestedCancelUrl = parsed.data.cancel_url ?? fallbackCancelUrl;
    const expiresAt = new Date(now.getTime() + DEFAULT_SUBSCRIPTION_EXPIRY_MS);
    let link;
    try {
      link = await provider.createPaymentLink({
        orderCode: created.providerOrderCode!,
        amount: created.amount,
        description: createSubscriptionDescription(created.providerOrderCode!),
        returnUrl: requestedReturnUrl,
        cancelUrl: requestedCancelUrl,
        expiredAt: Math.floor(expiresAt.getTime() / 1000)
      });
    } catch (error) {
      // payOS có thể từ chối deep-link (`exp://`, `careonroad://`) vì chỉ nhận
      // http/https. Khi đó thử lại với URL fallback từ env để người dùng vẫn
      // thanh toán được; deep-link chỉ là "đường về app", không phải điều
      // kiện để tạo đơn.
      const canFallback =
        requestedReturnUrl !== fallbackReturnUrl || requestedCancelUrl !== fallbackCancelUrl;
      if (!canFallback) {
        await this.failSubscriptionOrder(created.id, "provider_error");
        throw error;
      }
      try {
        link = await provider.createPaymentLink({
          orderCode: created.providerOrderCode!,
          amount: created.amount,
          description: createSubscriptionDescription(created.providerOrderCode!),
          returnUrl: fallbackReturnUrl,
          cancelUrl: fallbackCancelUrl,
          expiredAt: Math.floor(expiresAt.getTime() / 1000)
        });
      } catch {
        await this.failSubscriptionOrder(created.id, "provider_error");
        throw error;
      }
    }

    const pending = await this.unitOfWork.execute(async (repositories) => {
      const current = await repositories.subscriptions.findByIdForUpdate(created.id);
      if (!current) {
        throw new SubscriptionError("NOT_FOUND", "Subscription order not found.", 404);
      }
      const updated = await repositories.subscriptions.updateProviderFields({
        id: created.id,
        // Một webhook có thể đã kích hoạt gói trong lúc tạo link.
        status: current.status === "created" ? "pending" : current.status,
        providerPaymentLinkId: link.paymentLinkId,
        checkoutUrl: link.checkoutUrl,
        qrCode: link.qrCode,
        updatedAt: this.now()
      });
      if (!updated) {
        throw new SubscriptionError("NOT_FOUND", "Subscription order not found.", 404);
      }
      if (current.status === "created") {
        await appendSubscriptionAuditOutbox(repositories, {
          action: "subscription.order.pending",
          subscription: updated,
          actorId: actor.id,
          actorRole: "rider",
          now: this.now(),
          createId: () => this.createId()
        });
      }
      return toSubscriptionResponse(updated);
    });
    return pending;
  }

  /**
   * Đọc đơn (chỉ chủ sở hữu).
   *
   * Nếu đơn vẫn `pending`/`created`, service hỏi payOS về trạng thái thật
   * (có throttle) rồi áp dụng event đã verify. Cơ chế này bù cho trường hợp
   * webhook payOS không tới được backend (ví dụ backend chạy trong LAN, payOS
   * gọi từ cloud) — đơn vẫn được kích hoạt khi người dùng poll.
   */
  async getSubscriptionOrder(
    identity: VerifiedSupabaseIdentity,
    subscriptionOrderId: string
  ): Promise<SubscriptionOrderResponse> {
    const parsedId = subscriptionOrderIdParamSchema.safeParse(subscriptionOrderId);
    if (!parsedId.success) {
      throw new SubscriptionError("INVALID_INPUT", "Subscription order id must be a valid UUID.", 400);
    }
    const snapshot = await this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const subscription = await repositories.subscriptions.findById(parsedId.data);
      if (!subscription) {
        throw new SubscriptionError("NOT_FOUND", "Subscription order not found.", 404);
      }
      if (subscription.userId !== actor.id) {
        throw new SubscriptionError("FORBIDDEN", "Subscription order access is not allowed.", 403);
      }
      return subscription;
    });

    const refreshed = await this.syncWithProvider(snapshot);
    return toSubscriptionResponse(refreshed);
  }

  /**
   * Hỏi payOS về trạng thái đơn và áp dụng nếu đã thanh toán.
   *
   * - Chỉ hỏi khi đơn còn `created`/`pending` và có `provider_order_code`.
   * - Throttle 30s/mỗi order code để không spam payOS khi mobile poll liên tục.
   * - Lỗi provider (mạng, timeout, 5xx) NUỐT và trả về đơn hiện tại — polling
   *   vẫn phải hoạt động khi payOS tạm thời không sẵn sàng.
   */
  private async syncWithProvider(subscription: PlanSubscription): Promise<PlanSubscription> {
    if (!["created", "pending"].includes(subscription.status)) return subscription;
    const orderCode = subscription.providerOrderCode;
    if (orderCode === undefined) return subscription;

    const now = this.now();
    const lastCheckedAt = providerStatusThrottle.get(orderCode);
    if (lastCheckedAt !== undefined && now.getTime() - lastCheckedAt < PROVIDER_STATUS_THROTTLE_MS) {
      return subscription;
    }
    providerStatusThrottle.set(orderCode, now.getTime());
    if (providerStatusThrottle.size > 500) {
      for (const [code, checkedAt] of providerStatusThrottle) {
        if (now.getTime() - checkedAt > PROVIDER_STATUS_THROTTLE_MS * 4) {
          providerStatusThrottle.delete(code);
        }
      }
    }

    let status: ProviderPaymentStatus;
    try {
      status = await this.options.providerFactory().getPaymentStatus(orderCode);
    } catch {
      // Provider tạm thời không sẵn sàng — giữ nguyên trạng thái hiện tại.
      return subscription;
    }
    if (status.orderCode !== orderCode) return subscription;
    if (status.status === "PENDING" && (status.amountPaid ?? 0) === 0) return subscription;

    const applied = await this.applyVerifiedProviderEvent(providerStatusToEvent(status));
    // `applied.status` có thể là "duplicate" khi event đã được ghi nhận ở
    // lần trước (ví dụ webhook tới trước reconcile). Khi đó vẫn phải đọc lại
    // DB để trả về đơn đã `succeeded` — nếu trả `subscription` cũ, mobile sẽ
    // thấy "đang chờ thanh toán" mãi dù gói đã kích hoạt.
    if (applied.status !== "succeeded" && applied.status !== "duplicate") return subscription;

    const refreshed = await this.unitOfWork.execute(async (repositories) => {
      const current = await repositories.subscriptions.findById(subscription.id);
      return current ?? subscription;
    });
    return refreshed;
  }

  /**
   * Worker: quét các đơn gói đang chờ và đồng bộ trạng thái từ payOS.
   *
   * Bù cho webhook không tới được backend (LAN, firewall, provider retry).
   * Chỉ xét đơn `self_purchase` còn `created`/`pending` và đã cũ hơn 2 phút
   * (để không tranh chấp với luồng tạo đơn).
   */
  async reconcilePendingSubscriptions(limit = 20): Promise<SubscriptionReconcileResult> {
    if (!Number.isInteger(limit) || limit < 1 || limit > RECONCILE_MAX_LIMIT) {
      throw new SubscriptionError(
        "INVALID_INPUT",
        "Reconciliation limit must be between 1 and 50.",
        400
      );
    }
    const now = this.now();
    const staleBefore = new Date(now.getTime() - RECONCILE_STALE_MS);
    const pending = await this.unitOfWork.execute((repositories) =>
      repositories.subscriptions.listPendingBefore({
        before: staleBefore,
        limit: Math.min(limit, RECONCILE_MAX_LIMIT)
      })
    );
    const result: SubscriptionReconcileResult = {
      claimed: pending.length,
      succeeded: 0,
      still_pending: 0,
      failed: 0
    };
    for (const subscription of pending) {
      try {
        // Bỏ qua throttle để worker luôn hỏi provider (throttle chỉ áp dụng cho
        // đường đọc theo yêu cầu của client).
        providerStatusThrottle.delete(subscription.providerOrderCode ?? -1);
        const refreshed = await this.syncWithProvider(subscription);
        if (refreshed.status === "succeeded") {
          result.succeeded += 1;
        } else {
          result.still_pending += 1;
        }
      } catch {
        result.failed += 1;
      }
    }
    return result;
  }

  /** Huỷ đơn đang chờ thanh toán. */
  async cancelSubscriptionOrder(
    identity: VerifiedSupabaseIdentity,
    subscriptionOrderId: string
  ): Promise<SubscriptionOrderResponse> {
    const parsedId = subscriptionOrderIdParamSchema.safeParse(subscriptionOrderId);
    if (!parsedId.success) {
      throw new SubscriptionError("INVALID_INPUT", "Subscription order id must be a valid UUID.", 400);
    }
    const snapshot = await this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const subscription = await repositories.subscriptions.findByIdForUpdate(parsedId.data);
      if (!subscription) {
        throw new SubscriptionError("NOT_FOUND", "Subscription order not found.", 404);
      }
      if (subscription.userId !== actor.id) {
        throw new SubscriptionError("FORBIDDEN", "Subscription order access is not allowed.", 403);
      }
      if (subscription.status === "succeeded") {
        throw new SubscriptionError("CONFLICT", "A completed subscription cannot be canceled.", 409);
      }
      if (["canceled", "failed", "expired"].includes(subscription.status)) {
        return { subscription, actor };
      }
      return { subscription, actor };
    });

    const { subscription, actor } = snapshot;
    if (subscription.status === "pending" && subscription.providerOrderCode) {
      const cancellation = await this.options.providerFactory().cancelPaymentLink({
        orderCode: subscription.providerOrderCode,
        cancellationReason: "rider_cancel"
      });
      if (
        cancellation.orderCode !== subscription.providerOrderCode ||
        cancellation.status !== "CANCELLED" ||
        (cancellation.amountPaid ?? 0) > 0
      ) {
        throw new SubscriptionError(
          "CONFLICT",
          "Subscription cancellation was not confirmed; retry later.",
          409
        );
      }
    }

    return this.unitOfWork.execute(async (repositories) => {
      const now = this.now();
      const updated = await repositories.subscriptions.updateStatus({
        id: subscription.id,
        status: "canceled",
        updatedAt: now,
        canceledAt: now
      });
      if (!updated) {
        throw new SubscriptionError("NOT_FOUND", "Subscription order not found.", 404);
      }
      await appendSubscriptionAuditOutbox(repositories, {
        action: "subscription.order.canceled",
        subscription: updated,
        actorId: actor.id,
        actorRole: "rider",
        now,
        createId: () => this.createId()
      });
      return toSubscriptionResponse(updated);
    });
  }

  /**
   * Xử lý webhook payOS đã verify cho đơn đăng ký gói.
   *
   * - Thành công → kích hoạt gói: `expires = max(current_expiry, now) + 30 ngày`
   *   và cập nhật `app_users.plan_code` / `plan_expires_at`.
   * - Thất bại/huỷ → đánh dấu failed/canceled.
   */
  async applyVerifiedProviderEvent(
    event: Extract<VerifiedPaymentEvent, { kind: "valid" }>
  ): Promise<{
    received: true;
    matched: boolean;
    status: "ignored" | "duplicate" | "succeeded" | "failed";
  }> {
    return this.unitOfWork.execute(async (repositories) => {
      const now = this.now();
      const existingEvent = await repositories.subscriptions.findEventByDedupeKey(
        "payos",
        event.eventDedupeKey
      );
      if (existingEvent) {
        return {
          received: true,
          matched: Boolean(existingEvent.subscriptionId),
          status: "duplicate"
        };
      }
      const snapshot = await repositories.subscriptions.findByProviderOrderCode(
        "payos",
        event.orderCode
      );
      if (!snapshot) {
        await repositories.subscriptions.createEvent(
          toSubscriptionEvent({ event, now, createId: () => this.createId() })
        );
        return { received: true, matched: false, status: "ignored" };
      }
      const subscription = await repositories.subscriptions.findByIdForUpdate(snapshot.id);
      if (!subscription) {
        throw new SubscriptionError("NOT_FOUND", "Subscription order not found.", 404);
      }
      // Another delivery may have committed while this transaction waited for the lock.
      if (await repositories.subscriptions.findEventByDedupeKey("payos", event.eventDedupeKey)) {
        return { received: true, matched: true, status: "duplicate" };
      }
      await repositories.subscriptions.createEvent(
        toSubscriptionEvent({ event, now, createId: () => this.createId(), subscriptionId: subscription.id })
      );

      if (subscription.status === "succeeded") {
        return { received: true, matched: true, status: "duplicate" };
      }
      // Đơn đã huỷ: KHÔNG kích hoạt gói. Người dùng đã chủ động huỷ, nên
      // webhook đến muộn không được làm gói có hiệu lực.
      if (subscription.status === "canceled" || subscription.status === "expired") {
        return { received: true, matched: true, status: "ignored" };
      }
      if (!event.success) {
        const failed = await repositories.subscriptions.updateStatus({
          id: subscription.id,
          status: "failed",
          failureCode: event.status,
          updatedAt: now
        });
        if (failed) {
          await appendSubscriptionAuditOutbox(repositories, {
            action: "subscription.order.failed",
            subscription: failed,
            now,
            createId: () => this.createId()
          });
        }
        return { received: true, matched: true, status: "failed" };
      }
      // Xác minh số tiền khớp đơn trước khi kích hoạt gói.
      if (event.amount !== subscription.amount) {
        const failed = await repositories.subscriptions.updateStatus({
          id: subscription.id,
          status: "failed",
          failureCode: "amount_mismatch",
          updatedAt: now
        });
        if (failed) {
          await appendSubscriptionAuditOutbox(repositories, {
            action: "subscription.order.failed",
            subscription: failed,
            now,
            createId: () => this.createId()
          });
        }
        return { received: true, matched: true, status: "failed" };
      }
      // Chỉ VND mới kích hoạt được gói (mọi gói đều niêm yết bằng VND).
      if (event.currency !== subscription.currency) {
        const failed = await repositories.subscriptions.updateStatus({
          id: subscription.id,
          status: "failed",
          failureCode: "currency_mismatch",
          updatedAt: now
        });
        if (failed) {
          await appendSubscriptionAuditOutbox(repositories, {
            action: "subscription.order.failed",
            subscription: failed,
            now,
            createId: () => this.createId()
          });
        }
        return { received: true, matched: true, status: "failed" };
      }

      // Khoá row user để 2 đơn cùng lúc kích hoạt không làm mất số ngày
      // cộng dồn (`max(current_expiry, now) + 30 ngày` phải đọc trạng thái
      // mới nhất, không phải bản cache trước khi transaction kia commit).
      const actor = await repositories.users.findActorForUpdate(subscription.userId);
      if (!actor) {
        throw new SubscriptionError("NOT_FOUND", "Subscription owner not found.", 404);
      }
      const plan = subscription.planCode as PaidPlanCode;
      const expiresAt = planExpiryAfterPurchase(actor, plan, now);
      await repositories.users.updatePlan(actor.id, plan, expiresAt, now);
      const succeeded = await repositories.subscriptions.updateStatus({
        id: subscription.id,
        status: "succeeded",
        startedAt: now,
        expiresAt,
        succeededAt: now,
        updatedAt: now
      });
      if (!succeeded) {
        throw new SubscriptionError("NOT_FOUND", "Subscription order not found.", 404);
      }
      await appendSubscriptionAuditOutbox(repositories, {
        action: "subscription.activated",
        subscription: succeeded,
        actorId: actor.id,
        actorRole: "rider",
        now,
        createId: () => this.createId()
      });
      await persistNotification(
        repositories,
        {
          userId: actor.id,
          type: "subscription.activated",
          title: `Gói ${getPlanEntry(plan)?.name ?? plan} đã được kích hoạt`,
          body: `Gói mới có hiệu lực đến ${expiresAt.toISOString().slice(0, 10)}.`,
          data: {
            subscription_id: succeeded.id,
            plan_code: plan,
            plan_expires_at: expiresAt.toISOString()
          },
          dedupeKey: `subscription.activated:${succeeded.id}:${actor.id}`,
          actorId: actor.id,
          actorRole: "rider"
        },
        now,
        () => this.createId()
      );
      return { received: true, matched: true, status: "succeeded" };
    });
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  /**
   * Đánh dấu đơn thất bại (không tạo được link thanh toán) + ghi audit/outbox.
   *
   * Tách riêng để nhánh fallback tạo link payOS không lặp lại logic ghi log.
   */
  private async failSubscriptionOrder(
    subscriptionId: string,
    failureCode: string
  ): Promise<void> {
    await this.unitOfWork.execute(async (repositories) => {
      const failed = await repositories.subscriptions.updateStatus({
        id: subscriptionId,
        status: "failed",
        failureCode,
        updatedAt: this.now()
      });
      if (failed) {
        await appendSubscriptionAuditOutbox(repositories, {
          action: "subscription.order.failed",
          subscription: failed,
          now: this.now(),
          createId: () => this.createId()
        });
      }
    });
  }

  private createId(): string {
    return (this.options.createId ?? randomUUID)();
  }
}

export class SubscriptionError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT"
    >,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "SubscriptionError";
  }
}

export function toSubscriptionResponse(
  subscription: PlanSubscription
): SubscriptionOrderResponse {
  return {
    id: subscription.id,
    user_id: subscription.userId,
    plan_code: subscription.planCode as PaidPlanCode,
    source: "self_purchase",
    status: subscription.status,
    currency: subscription.currency,
    amount: subscription.amount,
    period_days: subscription.periodDays,
    ...(subscription.providerOrderCode !== undefined
      ? { provider_order_code: subscription.providerOrderCode }
      : {}),
    ...(subscription.checkoutUrl ? { checkout_url: subscription.checkoutUrl } : {}),
    ...(subscription.qrCode ? { qr_code: subscription.qrCode } : {}),
    created_at: subscription.createdAt.toISOString(),
    updated_at: subscription.updatedAt.toISOString(),
    ...(subscription.expiresAt ? { expires_at: subscription.expiresAt.toISOString() } : {}),
    ...(subscription.succeededAt ? { succeeded_at: subscription.succeededAt.toISOString() } : {}),
    ...(subscription.canceledAt ? { canceled_at: subscription.canceledAt.toISOString() } : {})
  };
}

async function appendSubscriptionAuditOutbox(
  repositories: FoundationRepositories,
  input: {
    action: string;
    subscription: PlanSubscription;
    actorId?: string;
    actorRole?: "rider" | "mechanic" | "admin";
    now: Date;
    createId: () => string;
  }
): Promise<void> {
  const payload = {
    subscription_id: input.subscription.id,
    user_id: input.subscription.userId,
    plan_code: input.subscription.planCode,
    source: input.subscription.source,
    provider: input.subscription.provider,
    provider_order_code: input.subscription.providerOrderCode,
    status: input.subscription.status,
    currency: input.subscription.currency,
    amount: input.subscription.amount,
    period_days: input.subscription.periodDays,
    ...(input.subscription.expiresAt
      ? { plan_expires_at: input.subscription.expiresAt.toISOString() }
      : {})
  };
  const occurrenceId = input.createId();
  await repositories.outbox.append({
    id: occurrenceId,
    topic: input.action,
    aggregateType: "plan_subscription",
    aggregateId: input.subscription.id,
    dedupeKey: `${input.action}:${input.subscription.id}:${occurrenceId}`,
    payload,
    createdAt: input.now,
    nextAttemptAt: input.now
  });
  await repositories.audit.append({
    id: input.createId(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: "plan_subscription",
    entityId: input.subscription.id,
    metadata: payload,
    createdAt: input.now
  });
}

function toSubscriptionEvent(input: {
  event: Extract<VerifiedPaymentEvent, { kind: "valid" }>;
  now: Date;
  createId: () => string;
  subscriptionId?: string;
}) {
  return {
    id: input.createId(),
    provider: "payos" as const,
    eventDedupeKey: input.event.eventDedupeKey,
    subscriptionId: input.subscriptionId,
    providerOrderCode: input.event.orderCode,
    providerPaymentLinkId: input.event.paymentLinkId,
    providerReference: input.event.providerReference,
    eventType: input.event.success ? "payment.succeeded" : "payment.failed",
    amount: input.event.amount,
    currency: "VND" as const,
    status: input.event.status,
    signatureValid: true,
    receivedAt: input.now
  };
}

function normalizeIdempotencyKey(idempotencyKey: string): string {
  const normalized = idempotencyKey.trim();
  if (normalized.length < 8 || normalized.length > 200) {
    throw new SubscriptionError(
      "INVALID_INPUT",
      "X-Idempotency-Key is required for subscription order creation.",
      400
    );
  }
  return normalized;
}

function createSubscriptionDescription(orderCode: number): string {
  return `GOP${String(orderCode).slice(-8)}`;
}

/**
 * Chuyển trạng thái từ payOS thành event đã verify (dùng cho reconcile).
 *
 * `eventDedupeKey` có tiền tố `reconcile:` để không đụng với event webhook
 * cùng nội dung — cả hai đều hợp lệ và đều idempotent.
 */
function providerStatusToEvent(
  status: ProviderPaymentStatus
): Extract<VerifiedPaymentEvent, { kind: "valid" }> {
  return {
    kind: "valid",
    eventDedupeKey: `reconcile:${status.orderCode}:${status.status}:${status.amountPaid ?? 0}`,
    success: status.status === "PAID" || (status.amountPaid ?? 0) > 0,
    orderCode: status.orderCode,
    amount: status.amountPaid ?? status.amount,
    currency: status.currency,
    paymentLinkId: status.paymentLinkId,
    status: status.status
  };
}
