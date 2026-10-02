import { filterPage } from "@/lib/list-pagination";
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

export class InMemoryReminderRepository implements ReminderRepository {
  constructor(
    private readonly rules: ReminderRule[],
    private readonly occurrences: ReminderOccurrence[]
  ) {}

  async listRulesAdmin(input: Parameters<ReminderRepository["listRulesAdmin"]>[0]) {
    return filterPage(this.rules.filter(row => (!input.riderId || row.riderId === input.riderId) && (input.enabled === undefined || row.enabled === input.enabled)), input).map(cloneRule);
  }
  async listOccurrencesAdmin(input: Parameters<ReminderRepository["listOccurrencesAdmin"]>[0]) {
    return filterPage(this.occurrences.filter(row => (!input.riderId || row.riderId === input.riderId) && (!input.ruleId || row.ruleId === input.ruleId)), input).map(cloneOccurrence);
  }

  async createRule(input: CreateReminderRule): Promise<ReminderRule> {
    const rule: ReminderRule = {
      ...input,
      failureCount: 0
    };
    this.rules.push(rule);
    return cloneRule(rule);
  }

  async listRulesByRider(riderId: string): Promise<ReminderRule[]> {
    return this.rules
      .filter((rule) => rule.riderId === riderId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map(cloneRule);
  }

  async findRuleById(id: string): Promise<ReminderRule | undefined> {
    const rule = this.rules.find((candidate) => candidate.id === id);
    return rule ? cloneRule(rule) : undefined;
  }

  async findRuleByIdForUpdate(id: string): Promise<ReminderRule | undefined> {
    return this.findRuleById(id);
  }

  async updateRule(input: UpdateReminderRule): Promise<ReminderRule | undefined> {
    const rule = this.rules.find((candidate) => candidate.id === input.id);
    if (!rule) {
      return undefined;
    }
    rule.title = input.title;
    rule.intervalDays = input.intervalDays;
    rule.nextDueAt = input.nextDueAt;
    rule.snoozedUntil = undefined;
    rule.enabled = input.enabled;
    rule.updatedAt = input.updatedAt;
    return cloneRule(rule);
  }

  async snoozeRule(input: {
    id: string;
    snoozedUntil: Date;
    updatedAt: Date;
  }): Promise<ReminderRule | undefined> {
    const rule = this.rules.find((candidate) => candidate.id === input.id);
    if (!rule) {
      return undefined;
    }
    rule.snoozedUntil = input.snoozedUntil;
    rule.updatedAt = input.updatedAt;
    return cloneRule(rule);
  }

  async disableRule(input: { id: string; updatedAt: Date }): Promise<ReminderRule | undefined> {
    const rule = this.rules.find((candidate) => candidate.id === input.id);
    if (!rule) {
      return undefined;
    }
    rule.enabled = false;
    rule.updatedAt = input.updatedAt;
    return cloneRule(rule);
  }

  async claimDueRules(input: ClaimDueReminderRulesInput): Promise<ReminderRule[]> {
    const claimed: ReminderRule[] = [];
    const candidates = this.rules
      .filter((rule) => {
        const dueAt = effectiveDueAt(rule);
        const leaseExpired = !rule.leaseExpiresAt || rule.leaseExpiresAt.getTime() <= input.now.getTime();
        return rule.enabled && dueAt.getTime() <= input.now.getTime() && leaseExpired;
      })
      .sort((left, right) => effectiveDueAt(left).getTime() - effectiveDueAt(right).getTime())
      .slice(0, input.limit);

    for (const rule of candidates) {
      rule.leaseOwner = input.leaseOwner;
      rule.leaseExpiresAt = input.leaseUntil;
      rule.updatedAt = input.now;
      claimed.push(cloneRule(rule));
    }
    return claimed;
  }

  async completeRuleClaim(input: {
    id: string;
    nextDueAt?: Date;
    enabled?: boolean;
    lastCompletedAt: Date;
    updatedAt: Date;
  }): Promise<ReminderRule | undefined> {
    const rule = this.rules.find((candidate) => candidate.id === input.id);
    if (!rule) {
      return undefined;
    }
    if (input.nextDueAt) {
      rule.nextDueAt = input.nextDueAt;
    }
    if (input.enabled !== undefined) {
      rule.enabled = input.enabled;
    }
    rule.snoozedUntil = undefined;
    rule.leaseOwner = undefined;
    rule.leaseExpiresAt = undefined;
    rule.lastCompletedAt = input.lastCompletedAt;
    rule.updatedAt = input.updatedAt;
    return cloneRule(rule);
  }

  async failRuleClaim(input: { id: string; updatedAt: Date }): Promise<ReminderRule | undefined> {
    const rule = this.rules.find((candidate) => candidate.id === input.id);
    if (!rule) {
      return undefined;
    }
    rule.failureCount += 1;
    rule.leaseOwner = undefined;
    rule.leaseExpiresAt = undefined;
    rule.updatedAt = input.updatedAt;
    return cloneRule(rule);
  }

  async createOccurrenceIfNotExists(
    input: CreateReminderOccurrence
  ): Promise<{ occurrence: ReminderOccurrence; created: boolean }> {
    const existing = this.occurrences.find(
      (occurrence) =>
        occurrence.ruleId === input.ruleId && occurrence.dueAt.getTime() === input.dueAt.getTime()
    );
    if (existing) {
      return { occurrence: cloneOccurrence(existing), created: false };
    }
    const occurrence: ReminderOccurrence = {
      ...input,
      status: input.status ?? "due",
      retryCount: input.retryCount ?? 0
    };
    this.occurrences.push(occurrence);
    return { occurrence: cloneOccurrence(occurrence), created: true };
  }

  async findOccurrenceById(id: string): Promise<ReminderOccurrence | undefined> {
    const occurrence = this.occurrences.find((candidate) => candidate.id === id);
    return occurrence ? cloneOccurrence(occurrence) : undefined;
  }

  async findOccurrenceByIdForUpdate(id: string): Promise<ReminderOccurrence | undefined> {
    return this.findOccurrenceById(id);
  }

  async updateOccurrenceStatus(input: {
    id: string;
    status: ReminderOccurrenceStatus;
    notificationId?: string;
    processedAt?: Date;
    retryCount?: number;
    lastErrorCode?: string;
  }): Promise<ReminderOccurrence | undefined> {
    const occurrence = this.occurrences.find((candidate) => candidate.id === input.id);
    if (!occurrence) {
      return undefined;
    }
    occurrence.status = input.status;
    occurrence.notificationId = input.notificationId ?? occurrence.notificationId;
    occurrence.processedAt = input.processedAt;
    occurrence.retryCount = input.retryCount ?? occurrence.retryCount;
    occurrence.lastErrorCode = input.lastErrorCode;
    return cloneOccurrence(occurrence);
  }
}

function effectiveDueAt(rule: ReminderRule): Date {
  return rule.snoozedUntil ?? rule.nextDueAt;
}

function cloneRule(rule: ReminderRule): ReminderRule {
  return {
    ...rule,
    nextDueAt: new Date(rule.nextDueAt),
    snoozedUntil: rule.snoozedUntil ? new Date(rule.snoozedUntil) : undefined,
    lastCompletedAt: rule.lastCompletedAt ? new Date(rule.lastCompletedAt) : undefined,
    leaseExpiresAt: rule.leaseExpiresAt ? new Date(rule.leaseExpiresAt) : undefined,
    createdAt: new Date(rule.createdAt),
    updatedAt: new Date(rule.updatedAt)
  };
}

function cloneOccurrence(occurrence: ReminderOccurrence): ReminderOccurrence {
  return {
    ...occurrence,
    dueAt: new Date(occurrence.dueAt),
    createdAt: new Date(occurrence.createdAt),
    processedAt: occurrence.processedAt ? new Date(occurrence.processedAt) : undefined
  };
}
