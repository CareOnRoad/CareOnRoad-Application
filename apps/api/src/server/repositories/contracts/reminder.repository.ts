import type { ListFilter } from "@/lib/list-pagination";
export type ReminderAdminFilter = ListFilter & { riderId?: string; enabled?: boolean; ruleId?: string; status?: ReminderOccurrenceStatus };
export type ReminderOccurrenceStatus = "due" | "queued" | "sent" | "dismissed" | "failed";

export type ReminderRule = {
  id: string;
  riderId: string;
  motorcycleId: string;
  title: string;
  intervalDays?: number;
  nextDueAt: Date;
  snoozedUntil?: Date;
  enabled: boolean;
  lastCompletedAt?: Date;
  leaseOwner?: string;
  leaseExpiresAt?: Date;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ReminderOccurrence = {
  id: string;
  ruleId: string;
  riderId: string;
  motorcycleId: string;
  dueAt: Date;
  status: ReminderOccurrenceStatus;
  notificationId?: string;
  retryCount: number;
  lastErrorCode?: string;
  createdAt: Date;
  processedAt?: Date;
};

export type CreateReminderRule = Omit<
  ReminderRule,
  "snoozedUntil" | "lastCompletedAt" | "leaseOwner" | "leaseExpiresAt" | "failureCount"
>;

export type UpdateReminderRule = {
  id: string;
  title: string;
  intervalDays?: number;
  nextDueAt: Date;
  enabled: boolean;
  updatedAt: Date;
};

export type CreateReminderOccurrence = Pick<
  ReminderOccurrence,
  "id" | "ruleId" | "riderId" | "motorcycleId" | "dueAt" | "createdAt"
> &
  Partial<Pick<ReminderOccurrence, "status" | "notificationId" | "retryCount" | "lastErrorCode">>;

export type ClaimDueReminderRulesInput = {
  now: Date;
  leaseOwner: string;
  leaseUntil: Date;
  limit: number;
};

export interface ReminderRepository {
  listRulesAdmin(input: ReminderAdminFilter): Promise<ReminderRule[]>;
  listOccurrencesAdmin(input: ReminderAdminFilter): Promise<ReminderOccurrence[]>;
  createRule(input: CreateReminderRule): Promise<ReminderRule>;
  listRulesByRider(riderId: string): Promise<ReminderRule[]>;
  findRuleById(id: string): Promise<ReminderRule | undefined>;
  findRuleByIdForUpdate(id: string): Promise<ReminderRule | undefined>;
  updateRule(input: UpdateReminderRule): Promise<ReminderRule | undefined>;
  snoozeRule(input: { id: string; snoozedUntil: Date; updatedAt: Date }): Promise<ReminderRule | undefined>;
  disableRule(input: { id: string; updatedAt: Date }): Promise<ReminderRule | undefined>;
  claimDueRules(input: ClaimDueReminderRulesInput): Promise<ReminderRule[]>;
  completeRuleClaim(input: {
    id: string;
    nextDueAt?: Date;
    enabled?: boolean;
    lastCompletedAt: Date;
    updatedAt: Date;
  }): Promise<ReminderRule | undefined>;
  failRuleClaim(input: { id: string; updatedAt: Date }): Promise<ReminderRule | undefined>;
  createOccurrenceIfNotExists(
    input: CreateReminderOccurrence
  ): Promise<{ occurrence: ReminderOccurrence; created: boolean }>;
  findOccurrenceById(id: string): Promise<ReminderOccurrence | undefined>;
  findOccurrenceByIdForUpdate(id: string): Promise<ReminderOccurrence | undefined>;
  updateOccurrenceStatus(input: {
    id: string;
    status: ReminderOccurrenceStatus;
    notificationId?: string;
    processedAt?: Date;
    retryCount?: number;
    lastErrorCode?: string;
  }): Promise<ReminderOccurrence | undefined>;
}
