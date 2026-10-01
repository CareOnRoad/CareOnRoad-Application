import type { TransactionSql } from "postgres";

import type {
  ClaimDueReminderRulesInput,
  CreateReminderOccurrence,
  CreateReminderRule,
  ReminderOccurrence,
  ReminderOccurrenceStatus,
  ReminderRepository,
  ReminderRule,
  UpdateReminderRule
} from "../contracts/reminder.repository";

type ReminderRuleRow = {
  id: string;
  rider_id: string;
  motorcycle_id: string;
  title: string;
  interval_days: number | null;
  next_due_at: Date;
  snoozed_until: Date | null;
  enabled: boolean;
  last_completed_at: Date | null;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  failure_count: number;
  created_at: Date;
  updated_at: Date;
};

type ReminderOccurrenceRow = {
  id: string;
  rule_id: string;
  rider_id: string;
  motorcycle_id: string;
  due_at: Date;
  status: ReminderOccurrenceStatus;
  notification_id: string | null;
  retry_count: number;
  last_error_code: string | null;
  created_at: Date;
  processed_at: Date | null;
};

export class PostgresReminderRepository implements ReminderRepository {
  constructor(private readonly sql: TransactionSql) {}

  async createRule(input: CreateReminderRule): Promise<ReminderRule> {
    const rows = await this.sql<ReminderRuleRow[]>`
      insert into reminder_rules (
        id, rider_id, motorcycle_id, title, interval_days, next_due_at,
        enabled, created_at, updated_at
      )
      values (
        ${input.id}, ${input.riderId}, ${input.motorcycleId}, ${input.title},
        ${input.intervalDays ?? null}, ${input.nextDueAt}, ${input.enabled},
        ${input.createdAt}, ${input.updatedAt}
      )
      returning *
    `;
    return mapRule(rows[0]!);
  }

  async listRulesByRider(riderId: string): Promise<ReminderRule[]> {
    const rows = await this.sql<ReminderRuleRow[]>`
      select * from reminder_rules
      where rider_id = ${riderId}
      order by created_at desc, id
    `;
    return rows.map(mapRule);
  }

  async findRuleById(id: string): Promise<ReminderRule | undefined> {
    const rows = await this.sql<ReminderRuleRow[]>`
      select * from reminder_rules where id = ${id} limit 1
    `;
    return rows[0] ? mapRule(rows[0]) : undefined;
  }

  async findRuleByIdForUpdate(id: string): Promise<ReminderRule | undefined> {
    const rows = await this.sql<ReminderRuleRow[]>`
      select * from reminder_rules where id = ${id} for update limit 1
    `;
    return rows[0] ? mapRule(rows[0]) : undefined;
  }

  async updateRule(input: UpdateReminderRule): Promise<ReminderRule | undefined> {
    const rows = await this.sql<ReminderRuleRow[]>`
      update reminder_rules
      set title = ${input.title},
          interval_days = ${input.intervalDays ?? null},
          next_due_at = ${input.nextDueAt},
          snoozed_until = null,
          enabled = ${input.enabled},
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapRule(rows[0]) : undefined;
  }

  async snoozeRule(input: {
    id: string;
    snoozedUntil: Date;
    updatedAt: Date;
  }): Promise<ReminderRule | undefined> {
    const rows = await this.sql<ReminderRuleRow[]>`
      update reminder_rules
      set snoozed_until = ${input.snoozedUntil},
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapRule(rows[0]) : undefined;
  }

  async disableRule(input: { id: string; updatedAt: Date }): Promise<ReminderRule | undefined> {
    const rows = await this.sql<ReminderRuleRow[]>`
      update reminder_rules
      set enabled = false,
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapRule(rows[0]) : undefined;
  }

  async claimDueRules(input: ClaimDueReminderRulesInput): Promise<ReminderRule[]> {
    const rows = await this.sql<ReminderRuleRow[]>`
      with due_rules as (
        select id
        from reminder_rules
        where enabled = true
          and coalesce(snoozed_until, next_due_at) <= ${input.now}
          and (lease_expires_at is null or lease_expires_at <= ${input.now})
        order by coalesce(snoozed_until, next_due_at), id
        for update skip locked
        limit ${input.limit}
      )
      update reminder_rules rule
      set lease_owner = ${input.leaseOwner},
          lease_expires_at = ${input.leaseUntil},
          updated_at = ${input.now}
      from due_rules
      where rule.id = due_rules.id
      returning rule.*
    `;
    return rows.map(mapRule);
  }

  async completeRuleClaim(input: {
    id: string;
    nextDueAt?: Date;
    enabled?: boolean;
    lastCompletedAt: Date;
    updatedAt: Date;
  }): Promise<ReminderRule | undefined> {
    const rows = await this.sql<ReminderRuleRow[]>`
      update reminder_rules
      set next_due_at = coalesce(${input.nextDueAt ?? null}, next_due_at),
          enabled = coalesce(${input.enabled ?? null}, enabled),
          snoozed_until = null,
          lease_owner = null,
          lease_expires_at = null,
          last_completed_at = ${input.lastCompletedAt},
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapRule(rows[0]) : undefined;
  }

  async failRuleClaim(input: { id: string; updatedAt: Date }): Promise<ReminderRule | undefined> {
    const rows = await this.sql<ReminderRuleRow[]>`
      update reminder_rules
      set lease_owner = null,
          lease_expires_at = null,
          failure_count = failure_count + 1,
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapRule(rows[0]) : undefined;
  }

  async createOccurrenceIfNotExists(
    input: CreateReminderOccurrence
  ): Promise<{ occurrence: ReminderOccurrence; created: boolean }> {
    const inserted = await this.sql<ReminderOccurrenceRow[]>`
      insert into reminder_occurrences (
        id, rule_id, rider_id, motorcycle_id, due_at, status, notification_id,
        retry_count, last_error_code, created_at
      )
      values (
        ${input.id}, ${input.ruleId}, ${input.riderId}, ${input.motorcycleId},
        ${input.dueAt}, ${input.status ?? "due"}, ${input.notificationId ?? null},
        ${input.retryCount ?? 0}, ${input.lastErrorCode ?? null}, ${input.createdAt}
      )
      on conflict (rule_id, due_at) do nothing
      returning *
    `;

    if (inserted[0]) {
      return { occurrence: mapOccurrence(inserted[0]), created: true };
    }

    const existing = await this.sql<ReminderOccurrenceRow[]>`
      select * from reminder_occurrences
      where rule_id = ${input.ruleId} and due_at = ${input.dueAt}
      limit 1
    `;
    return { occurrence: mapOccurrence(existing[0]!), created: false };
  }

  async findOccurrenceById(id: string): Promise<ReminderOccurrence | undefined> {
    const rows = await this.sql<ReminderOccurrenceRow[]>`
      select * from reminder_occurrences where id = ${id} limit 1
    `;
    return rows[0] ? mapOccurrence(rows[0]) : undefined;
  }

  async findOccurrenceByIdForUpdate(id: string): Promise<ReminderOccurrence | undefined> {
    const rows = await this.sql<ReminderOccurrenceRow[]>`
      select * from reminder_occurrences where id = ${id} for update limit 1
    `;
    return rows[0] ? mapOccurrence(rows[0]) : undefined;
  }

  async updateOccurrenceStatus(input: {
    id: string;
    status: ReminderOccurrenceStatus;
    notificationId?: string;
    processedAt?: Date;
    retryCount?: number;
    lastErrorCode?: string;
  }): Promise<ReminderOccurrence | undefined> {
    const rows = await this.sql<ReminderOccurrenceRow[]>`
      update reminder_occurrences
      set status = ${input.status},
          notification_id = coalesce(${input.notificationId ?? null}, notification_id),
          processed_at = ${input.processedAt ?? null},
          retry_count = coalesce(${input.retryCount ?? null}, retry_count),
          last_error_code = ${input.lastErrorCode ?? null}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapOccurrence(rows[0]) : undefined;
  }
}

function mapRule(row: ReminderRuleRow): ReminderRule {
  return {
    id: row.id,
    riderId: row.rider_id,
    motorcycleId: row.motorcycle_id,
    title: row.title,
    intervalDays: row.interval_days ?? undefined,
    nextDueAt: row.next_due_at,
    snoozedUntil: row.snoozed_until ?? undefined,
    enabled: row.enabled,
    lastCompletedAt: row.last_completed_at ?? undefined,
    leaseOwner: row.lease_owner ?? undefined,
    leaseExpiresAt: row.lease_expires_at ?? undefined,
    failureCount: row.failure_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapOccurrence(row: ReminderOccurrenceRow): ReminderOccurrence {
  return {
    id: row.id,
    ruleId: row.rule_id,
    riderId: row.rider_id,
    motorcycleId: row.motorcycle_id,
    dueAt: row.due_at,
    status: row.status,
    notificationId: row.notification_id ?? undefined,
    retryCount: row.retry_count,
    lastErrorCode: row.last_error_code ?? undefined,
    createdAt: row.created_at,
    processedAt: row.processed_at ?? undefined
  };
}
