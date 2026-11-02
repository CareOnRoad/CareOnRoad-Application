import type {
  CreatePlanSubscription,
  CreatePlanSubscriptionEvent,
  PlanSubscription,
  PlanSubscriptionEvent,
  PlanSubscriptionStatus,
  SubscriptionProvider,
  SubscriptionRepository
} from "../contracts/subscription.repository";

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  constructor(
    private readonly subscriptions: PlanSubscription[],
    private readonly events: PlanSubscriptionEvent[],
    private nextOrderCode = 100000
  ) {}

  async allocateProviderOrderCode(): Promise<number> {
    this.nextOrderCode = this.subscriptions.reduce(
      (maximum, subscription) => Math.max(maximum, subscription.providerOrderCode ?? 0),
      this.nextOrderCode
    ) + 1;
    return this.nextOrderCode;
  }

  async create(input: CreatePlanSubscription): Promise<PlanSubscription> {
    if (
      input.providerOrderCode !== undefined &&
      this.subscriptions.some(
        (subscription) =>
          subscription.provider === (input.provider ?? "payos") &&
          subscription.providerOrderCode === input.providerOrderCode
      )
    ) {
      throw new Error("PLAN_SUBSCRIPTION_PROVIDER_ORDER_EXISTS");
    }
    const subscription: PlanSubscription = {
      ...input,
      provider: input.provider ?? "payos",
      status: input.status ?? "created",
      currency: input.currency ?? "VND"
    };
    this.subscriptions.push(cloneSubscription(subscription));
    return cloneSubscription(subscription);
  }

  async findById(id: string): Promise<PlanSubscription | undefined> {
    const subscription = this.subscriptions.find((item) => item.id === id);
    return subscription ? cloneSubscription(subscription) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<PlanSubscription | undefined> {
    return this.findById(id);
  }

  async findByProviderOrderCode(
    provider: SubscriptionProvider,
    providerOrderCode: number
  ): Promise<PlanSubscription | undefined> {
    const subscription = this.subscriptions.find(
      (item) => item.provider === provider && item.providerOrderCode === providerOrderCode
    );
    return subscription ? cloneSubscription(subscription) : undefined;
  }

  async findByProviderOrderCodeForUpdate(
    provider: SubscriptionProvider,
    providerOrderCode: number
  ): Promise<PlanSubscription | undefined> {
    return this.findByProviderOrderCode(provider, providerOrderCode);
  }

  async listForUser(userId: string, limit: number): Promise<PlanSubscription[]> {
    return this.subscriptions
      .filter((subscription) => subscription.userId === userId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, limit)
      .map(cloneSubscription);
  }

  async listPendingBefore(input: { before: Date; limit: number }): Promise<PlanSubscription[]> {
    return this.subscriptions
      .filter(
        (subscription) =>
          subscription.source === "self_purchase" &&
          ["created", "pending"].includes(subscription.status) &&
          subscription.providerOrderCode !== undefined &&
          subscription.updatedAt.getTime() <= input.before.getTime()
      )
      .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
      .slice(0, input.limit)
      .map(cloneSubscription);
  }

  async updateProviderFields(input: {
    id: string;
    status: PlanSubscriptionStatus;
    providerPaymentLinkId?: string;
    checkoutUrl?: string;
    qrCode?: string;
    updatedAt: Date;
  }): Promise<PlanSubscription | undefined> {
    const subscription = this.subscriptions.find((item) => item.id === input.id);
    if (!subscription) return undefined;
    subscription.status = input.status;
    subscription.providerPaymentLinkId = input.providerPaymentLinkId ?? subscription.providerPaymentLinkId;
    subscription.checkoutUrl = input.checkoutUrl ?? subscription.checkoutUrl;
    subscription.qrCode = input.qrCode ?? subscription.qrCode;
    subscription.updatedAt = input.updatedAt;
    return cloneSubscription(subscription);
  }

  async updateStatus(input: {
    id: string;
    status: PlanSubscriptionStatus;
    updatedAt: Date;
    failureCode?: string;
    startedAt?: Date;
    expiresAt?: Date;
    succeededAt?: Date;
    canceledAt?: Date;
  }): Promise<PlanSubscription | undefined> {
    const subscription = this.subscriptions.find((item) => item.id === input.id);
    if (!subscription) return undefined;
    subscription.status = input.status;
    subscription.updatedAt = input.updatedAt;
    subscription.failureCode = input.failureCode ?? subscription.failureCode;
    subscription.startedAt = input.startedAt ?? subscription.startedAt;
    subscription.expiresAt = input.expiresAt ?? subscription.expiresAt;
    subscription.succeededAt = input.succeededAt ?? subscription.succeededAt;
    subscription.canceledAt =
      input.status === "canceled" ? input.canceledAt ?? subscription.canceledAt : undefined;
    return cloneSubscription(subscription);
  }

  async findEventByDedupeKey(
    provider: SubscriptionProvider,
    eventDedupeKey: string
  ): Promise<PlanSubscriptionEvent | undefined> {
    const event = this.events.find(
      (item) => item.provider === provider && item.eventDedupeKey === eventDedupeKey
    );
    return event ? cloneEvent(event) : undefined;
  }

  async createEvent(input: CreatePlanSubscriptionEvent): Promise<PlanSubscriptionEvent> {
    if (
      this.events.some(
        (event) =>
          event.provider === input.provider && event.eventDedupeKey === input.eventDedupeKey
      )
    ) {
      throw new Error("PLAN_SUBSCRIPTION_EVENT_EXISTS");
    }
    this.events.push(cloneEvent(input));
    return cloneEvent(input);
  }
}

function cloneSubscription(subscription: PlanSubscription): PlanSubscription {
  return {
    ...subscription,
    startedAt: subscription.startedAt ? new Date(subscription.startedAt) : undefined,
    expiresAt: subscription.expiresAt ? new Date(subscription.expiresAt) : undefined,
    createdAt: new Date(subscription.createdAt),
    updatedAt: new Date(subscription.updatedAt),
    succeededAt: subscription.succeededAt ? new Date(subscription.succeededAt) : undefined,
    canceledAt: subscription.canceledAt ? new Date(subscription.canceledAt) : undefined
  };
}

function cloneEvent(event: PlanSubscriptionEvent): PlanSubscriptionEvent {
  return {
    ...event,
    receivedAt: new Date(event.receivedAt)
  };
}
