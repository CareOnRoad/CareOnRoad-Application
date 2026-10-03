export type PaymentProvider = "payos";
export type PaymentOrderStatus =
  | "created"
  | "pending"
  | "succeeded"
  | "failed"
  | "canceled"
  | "needs_review";

export type PaymentOrder = {
  id: string;
  quoteId: string;
  requestId: string;
  assignmentId: string;
  riderId: string;
  provider: PaymentProvider;
  providerOrderCode: number;
  providerPaymentLinkId?: string;
  status: PaymentOrderStatus;
  currency: "VND";
  amount: number;
  checkoutUrl?: string;
  qrCode?: string;
  description: string;
  failureCode?: string;
  reviewReason?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  succeededAt?: Date;
  canceledAt?: Date;
};

export type PaymentEvent = {
  id: string;
  provider: PaymentProvider;
  eventDedupeKey: string;
  paymentOrderId?: string;
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

export type CreatePaymentOrder = Omit<
  PaymentOrder,
  | "status"
  | "provider"
  | "currency"
  | "providerPaymentLinkId"
  | "checkoutUrl"
  | "qrCode"
  | "failureCode"
  | "reviewReason"
  | "succeededAt"
  | "canceledAt"
> & {
  provider?: PaymentProvider;
  currency?: "VND";
  status?: PaymentOrderStatus;
};

export type CreatePaymentEvent = PaymentEvent;

export interface PaymentRepository {
  hasUnresolvedForRequest(input: { requestId: string; assignmentId?: string; quoteId?: string }): Promise<boolean>;
  findByProviderOrderCode(provider: PaymentProvider, providerOrderCode: number): Promise<PaymentOrder | undefined>;
  sumSucceededForAssignment(assignmentId: string): Promise<number>;
  allocateProviderOrderCode(): Promise<number>;
  create(input: CreatePaymentOrder): Promise<PaymentOrder>;
  findById(id: string): Promise<PaymentOrder | undefined>;
  findByIdForUpdate(id: string): Promise<PaymentOrder | undefined>;
  findActiveByQuoteForUpdate(quoteId: string, excludingOrderId?: string): Promise<PaymentOrder | undefined>;
  findByProviderOrderCodeForUpdate(
    provider: PaymentProvider,
    providerOrderCode: number
  ): Promise<PaymentOrder | undefined>;
  hasSucceededForAssignment(input: {
    assignmentId: string;
    requestId: string;
    quoteId?: string;
  }): Promise<boolean>;
  listPendingBefore(input: {
    provider: PaymentProvider;
    before: Date;
    limit: number;
  }): Promise<PaymentOrder[]>;
  updateProviderFields(input: {
    id: string;
    status: PaymentOrderStatus;
    providerPaymentLinkId?: string;
    checkoutUrl?: string;
    qrCode?: string;
    updatedAt: Date;
    expiresAt?: Date;
  }): Promise<PaymentOrder | undefined>;
  updateStatus(input: {
    id: string;
    status: PaymentOrderStatus;
    updatedAt: Date;
    failureCode?: string;
    reviewReason?: string;
    succeededAt?: Date;
    canceledAt?: Date;
  }): Promise<PaymentOrder | undefined>;
  findEventByDedupeKey(
    provider: PaymentProvider,
    eventDedupeKey: string
  ): Promise<PaymentEvent | undefined>;
  createEvent(input: CreatePaymentEvent): Promise<PaymentEvent>;
}
