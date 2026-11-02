import type { TransactionSql } from "postgres";

import type {
  CreatePlanSubscription,
  CreatePlanSubscriptionEvent,
  PlanSubscription,
  PlanSubscriptionEvent,
  PlanSubscriptionStatus,
  SubscriptionProvider,
  SubscriptionRepository
} from "../contracts/subscription.repository";

type PlanSubscriptionRow = {
  id: string;
  user_id: string;
  plan_code: PlanSubscription["planCode"];
  source: PlanSubscription["source"];
  provider: SubscriptionProvider;
  provider_order_code: string | null;
  provider_payment_link_id: string | null;
  status: PlanSubscriptionStatus;
  currency: "VND";
  amount: string;
  period_days: number;
  non_refundable_acknowledged: boolean;
  checkout_url: string | null;
  qr_code: string | null;
  failure_code: string | null;
  started_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  succeeded_at: Date | null;
  canceled_at: Date | null;
};

type PlanSubscriptionEventRow = {
  id: string;
  provider: SubscriptionProvider;
  event_dedupe_key: string;
  subscription_id: string | null;
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

export class PostgresSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly sql: TransactionSql) {}

  async allocateProviderOrderCode(): Promise<number> {
    const rows = await this.sql<{ value: string }[]>`
      select nextval('payment_order_code_seq')::text as value
    `;
    return Number(rows[0]!.value);
  }

  async create(input: CreatePlanSubscription): Promise<PlanSubscription> {
    const rows = await this.sql<PlanSubscriptionRow[]>`
      insert into plan_subscriptions (
        id, user_id, plan_code, source, provider, provider_order_code, status,
        currency, amount, period_days, non_refundable_acknowledged,
        started_at, expires_at, succeeded_at, created_at, updated_at
      )
      values (
        ${input.id}, ${input.userId}, ${input.planCode}, ${input.source},
        ${input.provider ?? "payos"}, ${input.providerOrderCode ?? null},
        ${input.status ?? "created"}, ${input.currency ?? "VND"}, ${input.amount},
        ${input.periodDays}, ${input.nonRefundableAcknowledged},
        ${input.startedAt ?? null}, ${input.expiresAt ?? null}, ${input.succeededAt ?? null},
        ${input.createdAt}, ${input.updatedAt}
      )
      returning *
    `;
    return mapSubscription(rows[0]!);
  }

  async findById(id: string): Promise<PlanSubscription | undefined> {
    const rows = await this.sql<PlanSubscriptionRow[]>`
      select * from plan_subscriptions where id = ${id} limit 1
    `;
    return rows[0] ? mapSubscription(rows[0]) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<PlanSubscription | undefined> {
    const rows = await this.sql<PlanSubscriptionRow[]>`
      select * from plan_subscriptions where id = ${id} for update limit 1
    `;
    return rows[0] ? mapSubscription(rows[0]) : undefined;
  }

  async findByProviderOrderCode(
    provider: SubscriptionProvider,
    providerOrderCode: number
  ): Promise<PlanSubscription | undefined> {
    const rows = await this.sql<PlanSubscriptionRow[]>`
      select * from plan_subscriptions
      where provider = ${provider} and provider_order_code = ${providerOrderCode}
      limit 1
    `;
    return rows[0] ? mapSubscription(rows[0]) : undefined;
  }

  async findByProviderOrderCodeForUpdate(
    provider: SubscriptionProvider,
    providerOrderCode: number
  ): Promise<PlanSubscription | undefined> {
    const rows = await this.sql<PlanSubscriptionRow[]>`
      select * from plan_subscriptions
      where provider = ${provider} and provider_order_code = ${providerOrderCode}
      for update
      limit 1
    `;
    return rows[0] ? mapSubscription(rows[0]) : undefined;
  }

  async listForUser(userId: string, limit: number): Promise<PlanSubscription[]> {
    const rows = await this.sql<PlanSubscriptionRow[]>`
      select * from plan_subscriptions
      where user_id = ${userId}
      order by created_at desc, id desc
      limit ${limit}
    `;
    return rows.map(mapSubscription);
  }

  async listPendingBefore(input: { before: Date; limit: number }): Promise<PlanSubscription[]> {
    const rows = await this.sql<PlanSubscriptionRow[]>`
      select * from plan_subscriptions
      where source = 'self_purchase'
        and status in ('created', 'pending')
        and provider_order_code is not null
        and updated_at <= ${input.before}
      order by updated_at asc, id
      limit ${input.limit}
    `;
    return rows.map(mapSubscription);
  }

  async updateProviderFields(input: {
    id: string;
    status: PlanSubscriptionStatus;
    providerPaymentLinkId?: string;
    checkoutUrl?: string;
    qrCode?: string;
    updatedAt: Date;
  }): Promise<PlanSubscription | undefined> {
    const rows = await this.sql<PlanSubscriptionRow[]>`
      update plan_subscriptions
      set status = ${input.status},
          provider_payment_link_id = coalesce(${input.providerPaymentLinkId ?? null}, provider_payment_link_id),
          checkout_url = coalesce(${input.checkoutUrl ?? null}, checkout_url),
          qr_code = coalesce(${input.qrCode ?? null}, qr_code),
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapSubscription(rows[0]) : undefined;
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
    const rows = await this.sql<PlanSubscriptionRow[]>`
      update plan_subscriptions
      set status = ${input.status},
          failure_code = coalesce(${input.failureCode ?? null}, failure_code),
          started_at = coalesce(${input.startedAt ?? null}, started_at),
          expires_at = coalesce(${input.expiresAt ?? null}, expires_at),
          succeeded_at = coalesce(${input.succeededAt ?? null}, succeeded_at),
          canceled_at = case when ${input.status} = 'canceled' then coalesce(${input.canceledAt ?? null}, canceled_at) else null end,
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapSubscription(rows[0]) : undefined;
  }

  async findEventByDedupeKey(
    provider: SubscriptionProvider,
    eventDedupeKey: string
  ): Promise<PlanSubscriptionEvent | undefined> {
    const rows = await this.sql<PlanSubscriptionEventRow[]>`
      select * from plan_subscription_events
      where provider = ${provider} and event_dedupe_key = ${eventDedupeKey}
      limit 1
    `;
    return rows[0] ? mapEvent(rows[0]) : undefined;
  }

  async createEvent(input: CreatePlanSubscriptionEvent): Promise<PlanSubscriptionEvent> {
    const rows = await this.sql<PlanSubscriptionEventRow[]>`
      insert into plan_subscription_events (
        id, provider, event_dedupe_key, subscription_id, provider_order_code,
        provider_payment_link_id, provider_reference, event_type, amount,
        currency, status, signature_valid, received_at
      )
      values (
        ${input.id}, ${input.provider}, ${input.eventDedupeKey},
        ${input.subscriptionId ?? null}, ${input.providerOrderCode ?? null},
        ${input.providerPaymentLinkId ?? null}, ${input.providerReference ?? null},
        ${input.eventType}, ${input.amount ?? null}, ${input.currency ?? null},
        ${input.status ?? null}, ${input.signatureValid}, ${input.receivedAt}
      )
      on conflict (provider, event_dedupe_key) do nothing
      returning *
    `;
    if (rows[0]) return mapEvent(rows[0]);
    const existing = await this.findEventByDedupeKey(input.provider, input.eventDedupeKey);
    if (!existing) throw new Error("Plan subscription event deduplication failed.");
    return existing;
  }
}

function mapSubscription(row: PlanSubscriptionRow): PlanSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    planCode: row.plan_code,
    source: row.source,
    provider: row.provider,
    providerOrderCode: row.provider_order_code ? Number(row.provider_order_code) : undefined,
    providerPaymentLinkId: row.provider_payment_link_id ?? undefined,
    status: row.status,
    currency: row.currency,
    amount: Number(row.amount),
    periodDays: row.period_days,
    nonRefundableAcknowledged: row.non_refundable_acknowledged,
    checkoutUrl: row.checkout_url ?? undefined,
    qrCode: row.qr_code ?? undefined,
    failureCode: row.failure_code ?? undefined,
    startedAt: row.started_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    succeededAt: row.succeeded_at ?? undefined,
    canceledAt: row.canceled_at ?? undefined
  };
}

function mapEvent(row: PlanSubscriptionEventRow): PlanSubscriptionEvent {
  return {
    id: row.id,
    provider: row.provider,
    eventDedupeKey: row.event_dedupe_key,
    subscriptionId: row.subscription_id ?? undefined,
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
