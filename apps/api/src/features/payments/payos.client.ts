import { createPayosSignature, verifyPayosSignature } from "./payos-signature";
import type {
  CreateProviderPaymentInput,
  PaymentProviderClient,
  ProviderPaymentLink,
  ProviderPaymentStatus,
  VerifiedPaymentEvent
} from "./payment-provider";

type PayosEnvironment = Record<string, string | undefined>;

export class PayosConfigurationError extends Error {
  readonly status = 409;
  readonly errorCode = "CONFLICT" as const;

  constructor(message = "payOS payment provider is not configured.") {
    super(message);
    this.name = "PayosConfigurationError";
  }
}

export class PayosProviderError extends Error {
  readonly status = 409;
  readonly errorCode = "CONFLICT" as const;

  constructor(message = "payOS payment provider rejected the request.") {
    super(message);
    this.name = "PayosProviderError";
  }
}

export class PayosClient implements PaymentProviderClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly apiKey: string;
  private readonly checksumKey: string;

  constructor(
    environment: PayosEnvironment = process.env,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (environment.PAYMENTS_ENABLED !== "true") {
      throw new PayosConfigurationError("Payments are disabled.");
    }
    this.baseUrl = environment.PAYOS_BASE_URL?.trim() || "https://api-merchant.payos.vn";
    this.clientId = requireEnv(environment, "PAYOS_CLIENT_ID");
    this.apiKey = requireEnv(environment, "PAYOS_API_KEY");
    this.checksumKey = requireEnv(environment, "PAYOS_CHECKSUM_KEY");
  }

  async createPaymentLink(input: CreateProviderPaymentInput): Promise<ProviderPaymentLink> {
    const body = {
      orderCode: input.orderCode,
      amount: input.amount,
      description: input.description,
      cancelUrl: input.cancelUrl,
      returnUrl: input.returnUrl,
      ...(input.expiredAt ? { expiredAt: input.expiredAt } : {})
    };
    let response;
    try {
      response = await this.request("/v2/payment-requests", {
        method: "POST",
        body: {
          ...body,
          signature: createPayosSignature({ amount: input.amount, cancelUrl: input.cancelUrl, description: input.description, orderCode: input.orderCode, returnUrl: input.returnUrl }, this.checksumKey)
        }
      });
    } catch (creationError) {
      // A timeout or duplicate order code can mean payOS already created the link.
      let existing: ProviderPaymentStatus;
      try { existing = await this.getPaymentStatus(input.orderCode); }
      catch { throw creationError; }
      if (existing.orderCode !== input.orderCode || existing.amount !== input.amount || !existing.paymentLinkId) {
        throw new PayosProviderError("Existing payOS order does not match the payment.");
      }
      return { paymentLinkId: existing.paymentLinkId,
        checkoutUrl: `https://pay.payos.vn/web/${encodeURIComponent(existing.paymentLinkId)}`,
        status: existing.status };
    }
    const data = asRecord(response.data);
    return {
      paymentLinkId: requireString(data.paymentLinkId, "paymentLinkId"),
      checkoutUrl: requireString(data.checkoutUrl, "checkoutUrl"),
      qrCode: requireString(data.qrCode, "qrCode"),
      status: normalizeProviderStatus(data.status)
    };
  }

  async cancelPaymentLink(input: {
    orderCode: number;
    cancellationReason: string;
  }): Promise<ProviderPaymentStatus> {
    const response = await this.request(`/v2/payment-requests/${input.orderCode}/cancel`, {
      method: "POST",
      body: { cancellationReason: input.cancellationReason }
    });
    return toProviderStatus(asRecord(response.data));
  }

  async getPaymentStatus(orderCode: number): Promise<ProviderPaymentStatus> {
    const response = await this.request(`/v2/payment-requests/${orderCode}`, {
      method: "GET"
    });
    return toProviderStatus(asRecord(response.data));
  }

  verifyWebhookPayload(payload: unknown): VerifiedPaymentEvent {
    const envelope = asRecord(payload);
    const data = asRecord(envelope.data);
    const signature = typeof envelope.signature === "string" ? envelope.signature : "";
    if (!signature || !verifyPayosSignature({ data, signature, checksumKey: this.checksumKey })) {
      return { kind: "invalid", reason: "invalid_signature" };
    }
    const orderCode = Number(data.orderCode);
    const amount = Number(data.amount);
    const currency = data.currency;
    if (!Number.isSafeInteger(orderCode) || !Number.isSafeInteger(amount) || currency !== "VND") {
      return { kind: "invalid", reason: "invalid_payload" };
    }
    const providerReference =
      typeof data.reference === "string" && data.reference.trim()
        ? data.reference.trim()
        : undefined;
    const paymentLinkId =
      typeof data.paymentLinkId === "string" && data.paymentLinkId.trim()
        ? data.paymentLinkId.trim()
        : undefined;
    return {
      kind: "valid",
      eventDedupeKey:
        providerReference ?? paymentLinkId ?? `payos:${orderCode}:${amount}:${String(data.code)}`,
      success: envelope.success === true && data.code === "00",
      orderCode,
      amount,
      currency,
      paymentLinkId,
      providerReference,
      status: typeof data.code === "string" ? data.code : "unknown"
    };
  }

  private async request(
    path: string,
    input: { method: "GET" | "POST"; body?: Record<string, unknown> }
  ): Promise<{ code: string; desc: string; data?: unknown }> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: input.method,
      headers: {
        "content-type": "application/json",
        "x-client-id": this.clientId,
        "x-api-key": this.apiKey
      },
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      signal: AbortSignal.timeout(10_000)
    });
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
      desc?: string;
      data?: unknown;
    };
    if (!response.ok || body.code !== "00") {
      throw new PayosProviderError("payOS request failed.");
    }
    return {
      code: body.code,
      desc: body.desc ?? "success",
      data: body.data
    };
  }
}

export function payosReturnUrl(environment: PayosEnvironment = process.env): string {
  return requireEnv(environment, "PAYOS_RETURN_URL");
}

export function payosCancelUrl(environment: PayosEnvironment = process.env): string {
  return requireEnv(environment, "PAYOS_CANCEL_URL");
}

function requireEnv(environment: PayosEnvironment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new PayosConfigurationError(`Missing ${name}.`);
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PayosProviderError(`payOS response is missing ${field}.`);
  }
  return value;
}

function normalizeProviderStatus(value: unknown): ProviderPaymentStatus["status"] {
  switch (value) {
    case "PAID":
    case "CANCELLED":
    case "EXPIRED":
    case "FAILED":
      return value;
    default:
      return "PENDING";
  }
}

function toProviderStatus(data: Record<string, unknown>): ProviderPaymentStatus {
  const orderCode = Number(data.orderCode);
  const amount = Number(data.amount);
  if (!Number.isSafeInteger(orderCode) || !Number.isSafeInteger(amount)) {
    throw new PayosProviderError("payOS status response is invalid.");
  }
  return {
    orderCode,
    amount,
    amountPaid: Number.isSafeInteger(Number(data.amountPaid))
      ? Number(data.amountPaid)
      : undefined,
    currency: "VND",
    status: normalizeProviderStatus(data.status),
    paymentLinkId:
      typeof data.id === "string" && data.id.trim() ? data.id.trim() : undefined
  };
}
