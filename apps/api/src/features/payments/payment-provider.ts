export type CreateProviderPaymentInput = {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  expiredAt?: number;
};

export type ProviderPaymentLink = {
  paymentLinkId: string;
  checkoutUrl: string;
  qrCode: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "FAILED";
};

export type ProviderPaymentStatus = {
  paymentLinkId?: string;
  orderCode: number;
  amount: number;
  amountPaid?: number;
  currency: "VND";
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "FAILED";
};

export type VerifiedPaymentEvent =
  | {
      kind: "invalid";
      reason: string;
    }
  | {
      kind: "valid";
      eventDedupeKey: string;
      success: boolean;
      orderCode: number;
      amount: number;
      currency: "VND";
      paymentLinkId?: string;
      providerReference?: string;
      status: string;
    };

export interface PaymentProviderClient {
  createPaymentLink(input: CreateProviderPaymentInput): Promise<ProviderPaymentLink>;
  cancelPaymentLink(input: {
    orderCode: number;
    cancellationReason: string;
  }): Promise<ProviderPaymentStatus>;
  getPaymentStatus(orderCode: number): Promise<ProviderPaymentStatus>;
  verifyWebhookPayload(payload: unknown): VerifiedPaymentEvent;
}
