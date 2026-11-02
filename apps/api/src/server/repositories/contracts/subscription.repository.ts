import type { PlanCode } from "@/features/plans/plan";

export type SubscriptionProvider = "payos";

export type PlanSubscriptionStatus =
  | "created"
  | "pending"
  | "succeeded"
  | "failed"
  | "canceled"
  | "expired";

export type PlanSubscriptionSource = "self_purchase" | "admin_grant";

export type PlanSubscription = {
  id: string;
  userId: string;
  planCode: PlanCode;
  source: PlanSubscriptionSource;
  provider: SubscriptionProvider;
  providerOrderCode?: number;
  providerPaymentLinkId?: string;
  status: PlanSubscriptionStatus;
  currency: "VND";
  amount: number;
  periodDays: number;
  nonRefundableAcknowledged: boolean;
  checkoutUrl?: string;
  qrCode?: string;
  failureCode?: string;
  startedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  succeededAt?: Date;
  canceledAt?: Date;
};

export type PlanSubscriptionEvent = {
  id: string;
  provider: SubscriptionProvider;
  eventDedupeKey: string;
  subscriptionId?: string;
  providerOrderCode?: number;
  providerPaymentLinkId?: string;
  providerReference?: string;
  eventType: string;
  amount?: number;
  currency?: "VND";
  status?: string;
  signatureValid: boolean;
  receivedAt: Date;
};

export type CreatePlanSubscription = Omit<
  PlanSubscription,
  | "status"
  | "provider"
  | "currency"
  | "providerPaymentLinkId"
  | "checkoutUrl"
  | "qrCode"
  | "failureCode"
> & {
  provider?: SubscriptionProvider;
  currency?: "VND";
  status?: PlanSubscriptionStatus;
};

export type CreatePlanSubscriptionEvent = PlanSubscriptionEvent;

export interface SubscriptionRepository {
  /** Cấp mã order code payOS (dùng chung sequence với payment_orders). */
  allocateProviderOrderCode(): Promise<number>;
  create(input: CreatePlanSubscription): Promise<PlanSubscription>;
  findById(id: string): Promise<PlanSubscription | undefined>;
  findByIdForUpdate(id: string): Promise<PlanSubscription | undefined>;
  findByProviderOrderCode(
    provider: SubscriptionProvider,
    providerOrderCode: number
  ): Promise<PlanSubscription | undefined>;
  findByProviderOrderCodeForUpdate(
    provider: SubscriptionProvider,
    providerOrderCode: number
  ): Promise<PlanSubscription | undefined>;
  listForUser(userId: string, limit: number): Promise<PlanSubscription[]>;
  /** Các đơn đang chờ (`created`/`pending`) cũ hơn `before` — dùng để reconcile với provider. */
  listPendingBefore(input: {
    before: Date;
    limit: number;
  }): Promise<PlanSubscription[]>;
  updateProviderFields(input: {
    id: string;
    status: PlanSubscriptionStatus;
    providerPaymentLinkId?: string;
    checkoutUrl?: string;
    qrCode?: string;
    updatedAt: Date;
  }): Promise<PlanSubscription | undefined>;
  updateStatus(input: {
    id: string;
    status: PlanSubscriptionStatus;
    updatedAt: Date;
    failureCode?: string;
    startedAt?: Date;
    expiresAt?: Date;
    succeededAt?: Date;
    canceledAt?: Date;
  }): Promise<PlanSubscription | undefined>;
  findEventByDedupeKey(
    provider: SubscriptionProvider,
    eventDedupeKey: string
  ): Promise<PlanSubscriptionEvent | undefined>;
  createEvent(input: CreatePlanSubscriptionEvent): Promise<PlanSubscriptionEvent>;
}
