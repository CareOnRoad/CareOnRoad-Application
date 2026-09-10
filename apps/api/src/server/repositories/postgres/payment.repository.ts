import type { TransactionSql } from "postgres";

import type {
  CreatePaymentEvent,
  CreatePaymentOrder,
  PaymentEvent,
  PaymentOrder,
  PaymentOrderStatus,
  PaymentProvider,
  PaymentRepository
} from "../contracts/payment.repository";

type PaymentOrderRow = {
  id: string;
  quote_id: string;
  request_id: string;
  assignment_id: string;
  rider_id: string;
  provider: PaymentProvider;
  provider_order_code: string;
  provider_payment_link_id: string | null;
  status: PaymentOrderStatus;
  currency: "VND";
  amount: string;
  checkout_url: string | null;
  qr_code: string | null;
  description: string;
  failure_code: string | null;
  review_reason: string | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date | null;
  succeeded_at: Date | null;
  canceled_at: Date | null;
};

type PaymentEventRow = {
  id: string;
  provider: PaymentProvider;
  event_dedupe_key: string;
  payment_order_id: string | null;
  provider_order_code: string | null;
  provider_payment_link_id: string | null;
  provider_reference: string | null;
  event_type: string;
  amount: string | null;
  currency: "VND" | null;
  status: string | null;
  signature_valid: boolean;
  received_at: Date;
};

export class PostgresPaymentRepository implements PaymentRepository {
  constructor(private readonly sql: TransactionSql) {}

  async allocateProviderOrderCode(): Promise<number> {
    const rows = await this.sql<{ value: string }[]>`
      select nextval('payment_order_code_seq')::text as value
    `;
    return Number(rows[0]!.value);
  }

  async create(input: CreatePaymentOrder): Promise<PaymentOrder> {
    const rows = await this.sql<PaymentOrderRow[]>`
      insert into payment_orders (
        id, quote_id, request_id, assignment_id, rider_id, provider,
        provider_order_code, status, currency, amount, description,
        created_at, updated_at, expires_at
      )
      values (
        ${input.id}, ${input.quoteId}, ${input.requestId}, ${input.assignmentId},
        ${input.riderId}, ${input.provider ?? "payos"}, ${input.providerOrderCode},
        ${input.status ?? "created"}, ${input.currency ?? "VND"}, ${input.amount},
        ${input.description}, ${input.createdAt}, ${input.updatedAt},
        ${input.expiresAt ?? null}
      )
      returning *
    `;
    return mapOrder(rows[0]!);
  }

  async findById(id: string): Promise<PaymentOrder | undefined> {
    const rows = await this.sql<PaymentOrderRow[]>`
      select * from payment_orders where id = ${id} limit 1
    `;
    return rows[0] ? mapOrder(rows[0]) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<PaymentOrder | undefined> {
    const rows = await this.sql<PaymentOrderRow[]>`
      select * from payment_orders where id = ${id} for update limit 1
    `;
    return rows[0] ? mapOrder(rows[0]) : undefined;
  }

  async findActiveByQuoteForUpdate(quoteId: string): Promise<PaymentOrder | undefined> {
    const rows = await this.sql<PaymentOrderRow[]>`
      select *
      from payment_orders
      where quote_id = ${quoteId}
        and status in ('created', 'pending', 'failed')
      for update
      limit 1
    `;
    return rows[0] ? mapOrder(rows[0]) : undefined;
  }

  async findByProviderOrderCodeForUpdate(
    provider: PaymentProvider,
    providerOrderCode: number
  ): Promise<PaymentOrder | undefined> {
    const rows = await this.sql<PaymentOrderRow[]>`
      select *
      from payment_orders
      where provider = ${provider}
        and provider_order_code = ${providerOrderCode}
      for update
      limit 1
    `;
    return rows[0] ? mapOrder(rows[0]) : undefined;
  }

  async hasSucceededForAssignment(input: {
    assignmentId: string;
    requestId: string;
    quoteId?: string;
  }): Promise<boolean> {
    const rows = await this.sql<{ exists: boolean }[]>`
      select exists(
        select 1
        from payment_orders
        where assignment_id = ${input.assignmentId}
          and request_id = ${input.requestId}
          and status = 'succeeded'
          ${input.quoteId ? this.sql`and quote_id = ${input.quoteId}` : this.sql``}
      ) as exists
    `;
    return rows[0]?.exists ?? false;
  }

  async listPendingBefore(input: {
    provider: PaymentProvider;
    before: Date;
    limit: number;
  }): Promise<PaymentOrder[]> {
    const rows = await this.sql<PaymentOrderRow[]>`
      select *
      from payment_orders
      where provider = ${input.provider}
        and status = 'pending'
        and updated_at <= ${input.before}
      order by updated_at asc, id
      limit ${input.limit}
    `;
    return rows.map(mapOrder);
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
    const rows = await this.sql<PaymentOrderRow[]>`
      update payment_orders
      set status = ${input.status},
          provider_payment_link_id = coalesce(${input.providerPaymentLinkId ?? null}, provider_payment_link_id),
          checkout_url = coalesce(${input.checkoutUrl ?? null}, checkout_url),
          qr_code = coalesce(${input.qrCode ?? null}, qr_code),
          expires_at = coalesce(${input.expiresAt ?? null}, expires_at),
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapOrder(rows[0]) : undefined;
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
    const rows = await this.sql<PaymentOrderRow[]>`
      update payment_orders
      set status = ${input.status},
          failure_code = coalesce(${input.failureCode ?? null}, failure_code),
          review_reason = coalesce(${input.reviewReason ?? null}, review_reason),
          succeeded_at = coalesce(${input.succeededAt ?? null}, succeeded_at),
          canceled_at = coalesce(${input.canceledAt ?? null}, canceled_at),
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapOrder(rows[0]) : undefined;
  }

  async findEventByDedupeKey(
    provider: PaymentProvider,
    eventDedupeKey: string
  ): Promise<PaymentEvent | undefined> {
    const rows = await this.sql<PaymentEventRow[]>`
      select *
      from payment_events
      where provider = ${provider}
        and event_dedupe_key = ${eventDedupeKey}
      limit 1
    `;
    return rows[0] ? mapEvent(rows[0]) : undefined;
  }

  async createEvent(input: CreatePaymentEvent): Promise<PaymentEvent> {
    const rows = await this.sql<PaymentEventRow[]>`
      insert into payment_events (
        id, provider, event_dedupe_key, payment_order_id, provider_order_code,
        provider_payment_link_id, provider_reference, event_type, amount,
        currency, status, signature_valid, received_at
      )
      values (
        ${input.id}, ${input.provider}, ${input.eventDedupeKey},
        ${input.paymentOrderId ?? null}, ${input.providerOrderCode ?? null},
        ${input.providerPaymentLinkId ?? null}, ${input.providerReference ?? null},
        ${input.eventType}, ${input.amount ?? null}, ${input.currency ?? null},
        ${input.status ?? null}, ${input.signatureValid}, ${input.receivedAt}
      )
      returning *
    `;
    return mapEvent(rows[0]!);
  }
}

function mapOrder(row: PaymentOrderRow): PaymentOrder {
  return {
    id: row.id,
    quoteId: row.quote_id,
    requestId: row.request_id,
    assignmentId: row.assignment_id,
    riderId: row.rider_id,
    provider: row.provider,
    providerOrderCode: Number(row.provider_order_code),
    providerPaymentLinkId: row.provider_payment_link_id ?? undefined,
    status: row.status,
    currency: row.currency,
    amount: Number(row.amount),
    checkoutUrl: row.checkout_url ?? undefined,
    qrCode: row.qr_code ?? undefined,
    description: row.description,
    failureCode: row.failure_code ?? undefined,
    reviewReason: row.review_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at ?? undefined,
    succeededAt: row.succeeded_at ?? undefined,
    canceledAt: row.canceled_at ?? undefined
  };
}

function mapEvent(row: PaymentEventRow): PaymentEvent {
  return {
    id: row.id,
    provider: row.provider,
    eventDedupeKey: row.event_dedupe_key,
    paymentOrderId: row.payment_order_id ?? undefined,
    providerOrderCode: row.provider_order_code ? Number(row.provider_order_code) : undefined,
    providerPaymentLinkId: row.provider_payment_link_id ?? undefined,
    providerReference: row.provider_reference ?? undefined,
    eventType: row.event_type,
    amount: row.amount ? Number(row.amount) : undefined,
    currency: row.currency ?? undefined,
    status: row.status ?? undefined,
    signatureValid: row.signature_valid,
    receivedAt: row.received_at
  };
}
