import type {
  CreatePaymentEvent,
  CreatePaymentOrder,
  PaymentEvent,
  PaymentOrder,
  PaymentProvider,
  PaymentRepository,
  PaymentOrderStatus
} from "../contracts/payment.repository";

const ACTIVE_PAYMENT_STATUSES = new Set<PaymentOrderStatus>(["created", "pending", "failed"]);

export class InMemoryPaymentRepository implements PaymentRepository {
  async hasUnresolvedForRequest(input: { requestId: string; assignmentId?: string; quoteId?: string }): Promise<boolean> {
    return this.orders.some((order) => order.requestId === input.requestId &&
      (!input.assignmentId || order.assignmentId === input.assignmentId) && (!input.quoteId || order.quoteId === input.quoteId) &&
      ["created", "pending", "succeeded", "needs_review"].includes(order.status));
  }

  async findByProviderOrderCode(provider: PaymentProvider, providerOrderCode: number): Promise<PaymentOrder | undefined> {
    const order = this.orders.find((item) => item.provider === provider && item.providerOrderCode === providerOrderCode);
    return order ? cloneOrder(order) : undefined;
  }
  constructor(
    private readonly orders: PaymentOrder[],
    private readonly events: PaymentEvent[],
    private nextOrderCode = 100000
  ) {}

  async sumSucceededForAssignment(assignmentId: string): Promise<number> {
    return this.orders.filter((order) => order.assignmentId === assignmentId && order.status === "succeeded")
      .reduce((amount, order) => amount + order.amount, 0);
  }

  async allocateProviderOrderCode(): Promise<number> {
    this.nextOrderCode = this.orders.reduce((maximum, order) => Math.max(maximum, order.providerOrderCode), this.nextOrderCode) + 1;
    return this.nextOrderCode;
  }

  async create(input: CreatePaymentOrder): Promise<PaymentOrder> {
    if (
      ACTIVE_PAYMENT_STATUSES.has(input.status ?? "created") &&
      this.orders.some(
        (order) => order.quoteId === input.quoteId && ACTIVE_PAYMENT_STATUSES.has(order.status)
      )
    ) {
      throw new Error("PAYMENT_ACTIVE_QUOTE_EXISTS");
    }
    if (
      this.orders.some(
        (order) =>
          order.provider === (input.provider ?? "payos") &&
          order.providerOrderCode === input.providerOrderCode
      )
    ) {
      throw new Error("PAYMENT_PROVIDER_ORDER_EXISTS");
    }
    const order: PaymentOrder = {
      ...input,
      provider: input.provider ?? "payos",
      status: input.status ?? "created",
      currency: input.currency ?? "VND"
    };
    this.orders.push(cloneOrder(order));
    return cloneOrder(order);
  }

  async findById(id: string): Promise<PaymentOrder | undefined> {
    const order = this.orders.find((item) => item.id === id);
    return order ? cloneOrder(order) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<PaymentOrder | undefined> {
    return this.findById(id);
  }

  async findActiveByQuoteForUpdate(quoteId: string, excludingOrderId?: string): Promise<PaymentOrder | undefined> {
    const order = this.orders.find((item) => item.id !== excludingOrderId && item.quoteId === quoteId && item.status === "needs_review") ?? this.orders.find(
      (item) => item.id !== excludingOrderId && item.quoteId === quoteId && ACTIVE_PAYMENT_STATUSES.has(item.status)
    );
    return order ? cloneOrder(order) : undefined;
  }

  async findByProviderOrderCodeForUpdate(
    provider: PaymentProvider,
    providerOrderCode: number
  ): Promise<PaymentOrder | undefined> {
    const order = this.orders.find(
      (item) => item.provider === provider && item.providerOrderCode === providerOrderCode
    );
    return order ? cloneOrder(order) : undefined;
  }

  async hasSucceededForAssignment(input: {
    assignmentId: string;
    requestId: string;
    quoteId?: string;
  }): Promise<boolean> {
    return this.orders.some(
      (order) =>
        order.assignmentId === input.assignmentId &&
        order.requestId === input.requestId &&
        (!input.quoteId || order.quoteId === input.quoteId) &&
        order.status === "succeeded"
    );
  }

  async listPendingBefore(input: {
    provider: PaymentProvider;
    before: Date;
    limit: number;
  }): Promise<PaymentOrder[]> {
    return this.orders
      .filter(
        (order) =>
          order.provider === input.provider &&
          (order.status === "created" || order.status === "pending") &&
          order.updatedAt.getTime() <= input.before.getTime()
      )
      .slice(0, input.limit)
      .map(cloneOrder);
  }

  async updateProviderFields(input: {
    id: string;
    status: PaymentOrderStatus;
    providerPaymentLinkId?: string;
    checkoutUrl?: string;
    qrCode?: string;
    updatedAt: Date;
    expiresAt?: Date;
  }): Promise<PaymentOrder | undefined> {
    const order = this.orders.find((item) => item.id === input.id);
    if (!order) {
      return undefined;
    }
    order.status = input.status;
    order.providerPaymentLinkId = input.providerPaymentLinkId ?? order.providerPaymentLinkId;
    order.checkoutUrl = input.checkoutUrl ?? order.checkoutUrl;
    order.qrCode = input.qrCode ?? order.qrCode;
    order.updatedAt = input.updatedAt;
    order.expiresAt = input.expiresAt ?? order.expiresAt;
    return cloneOrder(order);
  }

  async updateStatus(input: {
    id: string;
    status: PaymentOrderStatus;
    updatedAt: Date;
    failureCode?: string;
    reviewReason?: string;
    succeededAt?: Date;
    canceledAt?: Date;
  }): Promise<PaymentOrder | undefined> {
    const order = this.orders.find((item) => item.id === input.id);
    if (!order) {
      return undefined;
    }
    order.status = input.status;
    order.updatedAt = input.updatedAt;
    order.failureCode = input.failureCode ?? order.failureCode;
    order.reviewReason = input.reviewReason ?? order.reviewReason;
    order.succeededAt = input.succeededAt ?? order.succeededAt;
    order.canceledAt = input.status === "canceled" ? input.canceledAt ?? order.canceledAt : undefined;
    return cloneOrder(order);
  }

  async findEventByDedupeKey(
    provider: PaymentProvider,
    eventDedupeKey: string
  ): Promise<PaymentEvent | undefined> {
    const event = this.events.find(
      (item) => item.provider === provider && item.eventDedupeKey === eventDedupeKey
    );
    return event ? cloneEvent(event) : undefined;
  }

  async createEvent(input: CreatePaymentEvent): Promise<PaymentEvent> {
    if (
      this.events.some(
        (event) =>
          event.provider === input.provider && event.eventDedupeKey === input.eventDedupeKey
      )
    ) {
      throw new Error("PAYMENT_EVENT_EXISTS");
    }
    this.events.push(cloneEvent(input));
    return cloneEvent(input);
  }
}

function cloneOrder(order: PaymentOrder): PaymentOrder {
  return {
    ...order,
    createdAt: new Date(order.createdAt),
    updatedAt: new Date(order.updatedAt),
    expiresAt: order.expiresAt ? new Date(order.expiresAt) : undefined,
    succeededAt: order.succeededAt ? new Date(order.succeededAt) : undefined,
    canceledAt: order.canceledAt ? new Date(order.canceledAt) : undefined
  };
}

function cloneEvent(event: PaymentEvent): PaymentEvent {
  return {
    ...event,
    receivedAt: new Date(event.receivedAt)
  };
}
