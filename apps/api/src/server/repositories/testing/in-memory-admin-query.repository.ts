import type { AdminInternalNote } from "../contracts/admin-internal-note.repository";
import type { OperationalSummary, OperationalWindow, StuckFinding } from "../contracts/admin-query.repository";
import type { InMemoryFoundationState } from "./in-memory-unit-of-work";
import { filterPage } from "@/lib/list-pagination";
import { findingId, ASSIGNMENT_STALE_MINUTES, APPOINTMENT_GRACE_MINUTES, REMINDER_FAILURE_THRESHOLD, WORKER_STALE_MINUTES, COMMITMENT_STALE_MINUTES } from "@/features/admin/admin-operational-policy";
import type {
  AdminQueryPage,
  AdminInternalNoteQuery,
  AdminQueryRepository,
  AdminRequestAssignmentSummary,
  AdminRequestCursor,
  AdminRequestMediaSummary,
  AdminRequestQuoteSummary,
  AdminRequestTimelineCursor,
  AdminRequestTimelineItem,
  AdminServiceRequestDetail,
  AdminServiceRequestQuery,
  AdminServiceRequestSummary
} from "../contracts/admin-query.repository";
import type { Assignment } from "../contracts/assignment.repository";
import type {
  DispatchCandidate,
  DispatchRound
} from "../contracts/dispatch.repository";
import type { Quote } from "../contracts/quote.repository";
import type { RequestMediaMetadata } from "../contracts/request-media.repository";
import type {
  RequestStatusHistory,
  ServiceRequest
} from "../contracts/service-request.repository";
import { cloneAdminInternalNote } from "./in-memory-admin-internal-note.repository";

type InMemoryAdminQueryState = Partial<Pick<InMemoryFoundationState, "users" | "mechanicProfiles" | "notifications" | "outboxEvents" | "reminderRules" | "reminderOccurrences" | "paymentOrders" | "workerRuns">> & {
  notes: AdminInternalNote[];
  requests: ServiceRequest[];
  requestHistory: RequestStatusHistory[];
  media: RequestMediaMetadata[];
  rounds: DispatchRound[];
  candidates: DispatchCandidate[];
  assignments: Assignment[];
  quotes: Quote[];
};

export class InMemoryAdminQueryRepository implements AdminQueryRepository {
  constructor(private readonly state: InMemoryAdminQueryState) {}

  async operationalSummary(input: OperationalWindow): Promise<OperationalSummary> {
    const count = <T extends { createdAt: Date }>(rows: T[] | undefined, bucket: (row: T) => string) => {
      const counts: Record<string, number> = {};
      for (const row of rows ?? []) if (row.createdAt >= input.from && row.createdAt <= input.to) { const key = bucket(row); counts[key] = (counts[key] ?? 0) + 1; }
      return counts;
    };
    return { users: count(this.state.users, row => row.status), mechanics: count(this.state.mechanicProfiles, row => row.profileStatus), availability: count(this.state.mechanicProfiles, row => String(row.isAvailable)),
      requests: count(this.state.requests, row => row.status), assignments: count(this.state.assignments, row => row.status),
      assignment_slots: count(this.state.assignments, row => ["completed", "canceled", "recovery_canceled"].includes(row.status) ? "closed" : row.scheduledStartAt && !row.activatedAt ? "future_reservation" : "current"),
      dispatch_rounds: count(this.state.rounds.map(row => ({ ...row, createdAt: row.startedAt })), row => row.status), dispatch_candidates: count(this.state.candidates, row => row.status),
      quotes: count(this.state.quotes, row => row.status), payments: count(this.state.paymentOrders, row => row.status), notifications: count(this.state.notifications, row => row.status),
      outbox: count(this.state.outboxEvents, row => row.status), reminders: count(this.state.reminderRules, row => String(row.enabled)), occurrences: count(this.state.reminderOccurrences, row => row.status), workers: count(this.state.workerRuns, row => `${row.workerName}:${row.status}`) };
  }

  async stuckWorkflows(input: Parameters<AdminQueryRepository["stuckWorkflows"]>[0]) {
    const rows: StuckFinding[] = [], now = input.now.getTime();
    const add = (category: StuckFinding["category"], targetId: string, createdAt: Date, details: Partial<StuckFinding> = {}) => rows.push({ id: findingId(category, targetId), category, targetId, createdAt, activeLease: false, ...details });
    for (const round of this.state.rounds) if (round.status === "active" && round.expiresAt <= input.now) add("dispatch_overdue", round.id, round.expiresAt, { requestId: round.requestId, activeLease: Boolean(round.leaseExpiresAt && round.leaseExpiresAt > input.now) });
    for (const request of this.state.requests) if (request.status === "manual_escalation" || (request.status === "offered" && !this.state.candidates.some(candidate => candidate.requestId === request.id && candidate.status === "offered" && candidate.expiresAt && candidate.expiresAt > input.now && this.state.rounds.some(round => round.id === candidate.roundId && round.status === "active")))) add("dispatch_attention", request.id, request.updatedAt, { requestId: request.id });
    for (const assignment of this.state.assignments) {
      if (["completed", "canceled", "recovery_canceled"].includes(assignment.status)) continue;
      const future = assignment.scheduledStartAt && !assignment.activatedAt;
      const basis = future ? assignment.scheduledStartAt! : assignment.updatedAt;
      const threshold = future ? APPOINTMENT_GRACE_MINUTES : ASSIGNMENT_STALE_MINUTES[assignment.status as keyof typeof ASSIGNMENT_STALE_MINUTES] ?? 180;
      if (basis.getTime() <= now - threshold * 60_000) add("assignment_stalled", assignment.id, basis, { requestId: assignment.requestId, assignmentId: assignment.id });
      const expected = assignment.status === "accepted" ? "assigned" : assignment.status === "en_route" ? "mechanic_en_route" : assignment.status === "quoted" ? "awaiting_quote_approval" : assignment.status === "awaiting_payment" ? "awaiting_payment" : "in_service";
      const request = this.state.requests.find(row => row.id === assignment.requestId);
      if (request && request.status !== expected) add("state_divergence", assignment.id, assignment.updatedAt, { requestId: assignment.requestId, assignmentId: assignment.id });
    }
    for (const event of this.state.outboxEvents ?? []) {
      const activeLease = Boolean(event.leaseExpiresAt && event.leaseExpiresAt > input.now);
      if (event.status === "dead_letter") add("outbox_dead_letter", event.id, event.createdAt, { activeLease });
      if (event.status === "pending" && event.nextAttemptAt <= input.now && event.createdAt.getTime() <= now - WORKER_STALE_MINUTES * 60_000 && !(this.state.workerRuns ?? []).some(run => run.workerName === "outbox" && run.status === "succeeded" && run.completedAt.getTime() > now - WORKER_STALE_MINUTES * 60_000)) add("worker_missing_progress", event.id, event.createdAt, { activeLease });
    }
    for (const rule of this.state.reminderRules ?? []) if (rule.enabled && rule.failureCount >= REMINDER_FAILURE_THRESHOLD && (rule.snoozedUntil ?? rule.nextDueAt) <= input.now && (!rule.lastCompletedAt || rule.lastCompletedAt < rule.updatedAt)) add("reminder_failures", rule.id, rule.updatedAt, { failureCount: rule.failureCount, activeLease: Boolean(rule.leaseExpiresAt && rule.leaseExpiresAt > input.now) });
    for (const quote of this.state.quotes) if (quote.status === "pending" && ((quote.expiresAt && quote.expiresAt <= input.now) || quote.createdAt.getTime() <= now - COMMITMENT_STALE_MINUTES * 60_000) && !this.state.quotes.some(latest => latest.requestId === quote.requestId && latest.version > quote.version)) add("quote_pending", quote.id, quote.createdAt, { requestId: quote.requestId, assignmentId: quote.assignmentId });
    for (const payment of this.state.paymentOrders ?? []) if (["pending", "created", "needs_review"].includes(payment.status) && payment.updatedAt.getTime() <= now - COMMITMENT_STALE_MINUTES * 60_000) add("payment_pending", payment.id, payment.updatedAt, { requestId: payment.requestId, assignmentId: payment.assignmentId });
    return filterPage(rows.filter(row => !input.category || row.category === input.category), { ...input, date_from: input.from.toISOString(), date_to: input.to.toISOString() });
  }

  async listInternalNotes(input: AdminInternalNoteQuery): Promise<AdminInternalNote[]> {
    const targetNotes = this.state.notes.filter((note) =>
      "serviceRequestId" in input
        ? note.serviceRequestId === input.serviceRequestId
        : note.assignmentId === input.assignmentId
    );

    return targetNotes
      .filter((note) => {
        if (!input.cursor) {
          return true;
        }
        const timeDifference =
          note.createdAt.getTime() - input.cursor.createdAt.getTime();
        return timeDifference < 0 || (timeDifference === 0 && note.id < input.cursor.id);
      })
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id)
      )
      .slice(0, input.limit)
      .map(cloneAdminInternalNote);
  }

  async listServiceRequests(
    input: AdminServiceRequestQuery
  ): Promise<
    AdminQueryPage<AdminServiceRequestSummary, AdminRequestCursor>
  > {
    const rows = this.state.requests
      .filter((request) => !input.status || request.status === input.status)
      .filter(
        (request) => !input.serviceType || request.serviceType === input.serviceType
      )
      .filter(
        (request) => !input.priority || request.priority === input.priority
      )
      .filter((request) => !input.riderId || request.riderId === input.riderId)
      .filter(
        (request) =>
          !input.mechanicId ||
          this.state.assignments.some(
            (assignment) =>
              assignment.requestId === request.id &&
              assignment.mechanicId === input.mechanicId
          )
      )
      .filter(
        (request) =>
          !input.requestCode || request.requestCode === input.requestCode
      )
      .filter(
        (request) =>
          !input.from || request.createdAt.getTime() >= input.from.getTime()
      )
      .filter(
        (request) => !input.to || request.createdAt.getTime() <= input.to.getTime()
      )
      .filter((request) =>
        beforeCursor(request.updatedAt, request.id, input.cursor)
      )
      .sort(
        (left, right) =>
          right.updatedAt.getTime() - left.updatedAt.getTime() ||
          right.id.localeCompare(left.id)
      );
    return page(
      rows,
      input.limit,
      (request) => toRequestSummary(request, latestAssignment(this.state, request.id)),
      (request) => ({ timestamp: new Date(request.updatedAt), id: request.id })
    );
  }

  async getServiceRequestDetail(
    requestId: string
  ): Promise<AdminServiceRequestDetail | undefined> {
    const request = this.state.requests.find((item) => item.id === requestId);
    if (!request) {
      return undefined;
    }
    const assignment = latestAssignment(this.state, requestId);
    const dispatch = latestRound(this.state, requestId);
    const quote = latestQuote(this.state, requestId);
    return {
      ...toRequestSummary(request, assignment),
      ...(dispatch
        ? {
            dispatch: {
              roundId: dispatch.id,
              roundNumber: dispatch.roundNumber,
              status: dispatch.status,
              startedAt: new Date(dispatch.startedAt),
              expiresAt: new Date(dispatch.expiresAt),
              ...(dispatch.completedAt
                ? { completedAt: new Date(dispatch.completedAt) }
                : {}),
              openCandidateCount: this.state.candidates.filter(
                (candidate) =>
                  candidate.roundId === dispatch.id &&
                  ["pending", "offered"].includes(candidate.status)
              ).length
            }
          }
        : {}),
      ...(assignment
        ? { assignment: toAssignmentSummary(assignment) }
        : {}),
      ...(quote ? { latestQuote: toQuoteSummary(quote) } : {}),
      ...(request.reminderId
        ? {
            reminder: {
              reminderId: request.reminderId,
              ...(request.reminderContextId
                ? { occurrenceId: request.reminderContextId }
                : {})
            }
          }
        : {})
    };
  }

  async listRequestTimeline(input: {
    requestId: string;
    cursor?: AdminRequestTimelineCursor;
    limit: number;
  }): Promise<
    AdminQueryPage<AdminRequestTimelineItem, AdminRequestTimelineCursor>
  > {
    const history: AdminRequestTimelineItem[] = this.state.requestHistory
      .filter((item) => item.requestId === input.requestId)
      .map((item) => ({
        id: item.id,
        kind: "status",
        fromStatus: item.fromStatus,
        toStatus: item.toStatus,
        actorId: item.actorId,
        reason: item.reason,
        createdAt: new Date(item.createdAt)
      }));
    const notes: AdminRequestTimelineItem[] = this.state.notes
      .filter(
        (note) =>
          "serviceRequestId" in note &&
          note.serviceRequestId === input.requestId
      )
      .map((note) => ({
        id: note.id,
        kind: "internal_note",
        adminId: note.adminId,
        noteText: note.noteText,
        createdAt: new Date(note.createdAt)
      }));
    const rows = [...history, ...notes]
      .filter((item) =>
        beforeTimelineCursor(item.createdAt, item.id, input.cursor)
      )
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id)
      );
    return page(
      rows,
      input.limit,
      (item) => structuredClone(item),
      (item) => ({ createdAt: new Date(item.createdAt), id: item.id })
    );
  }

  async listRequestMedia(input: {
    requestId: string;
    cursor?: AdminRequestCursor;
    limit: number;
  }): Promise<
    AdminQueryPage<AdminRequestMediaSummary, AdminRequestCursor>
  > {
    const rows = this.state.media
      .filter((item) => item.requestId === input.requestId)
      .filter((item) => beforeCursor(item.createdAt, item.id, input.cursor))
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id)
      );
    return page(
      rows,
      input.limit,
      (item) => ({
        id: item.id,
        requestId: item.requestId,
        mediaType: item.mediaType,
        contentType: item.contentType,
        sizeBytes: item.sizeBytes,
        createdBy: item.createdBy,
        createdAt: new Date(item.createdAt)
      }),
      (item) => ({ timestamp: new Date(item.createdAt), id: item.id })
    );
  }

  async getRequestAssignment(
    requestId: string
  ): Promise<AdminRequestAssignmentSummary | undefined> {
    const assignment = latestAssignment(this.state, requestId);
    return assignment ? toAssignmentSummary(assignment) : undefined;
  }

  async listRequestQuotes(input: {
    requestId: string;
    cursor?: AdminRequestCursor;
    limit: number;
  }): Promise<AdminQueryPage<AdminRequestQuoteSummary, AdminRequestCursor>> {
    const rows = this.state.quotes
      .filter((quote) => quote.requestId === input.requestId)
      .filter((quote) => beforeCursor(quote.createdAt, quote.id, input.cursor))
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id)
      );
    return page(
      rows,
      input.limit,
      toQuoteSummary,
      (quote) => ({ timestamp: new Date(quote.createdAt), id: quote.id })
    );
  }
}

function beforeCursor(
  timestamp: Date,
  id: string,
  cursor?: AdminRequestCursor
) {
  if (!cursor) return true;
  const difference = timestamp.getTime() - cursor.timestamp.getTime();
  return difference < 0 || (difference === 0 && id < cursor.id);
}

function beforeTimelineCursor(
  timestamp: Date,
  id: string,
  cursor?: AdminRequestTimelineCursor
) {
  if (!cursor) return true;
  const difference = timestamp.getTime() - cursor.createdAt.getTime();
  return difference < 0 || (difference === 0 && id < cursor.id);
}

function page<T, R, C>(
  rows: T[],
  limit: number,
  map: (row: T) => R,
  cursor: (row: T) => C
): AdminQueryPage<R, C> {
  const hasMore = rows.length > limit;
  const selected = rows.slice(0, limit);
  const last = selected.at(-1);
  return {
    items: selected.map(map),
    ...(hasMore && last ? { nextCursor: cursor(last) } : {})
  };
}

function toRequestSummary(
  request: ServiceRequest,
  assignment?: Assignment
): AdminServiceRequestSummary {
  return {
    id: request.id,
    requestCode: request.requestCode,
    riderId: request.riderId,
    motorcycleId: request.motorcycleId,
    serviceType: request.serviceType,
    fulfillmentMode: request.fulfillmentMode,
    status: request.status,
    priority: request.priority,
    mechanicId: assignment?.mechanicId,
    scheduledStartAt: request.scheduledStartAt
      ? new Date(request.scheduledStartAt)
      : undefined,
    createdAt: new Date(request.createdAt),
    updatedAt: new Date(request.updatedAt)
  };
}

function latestAssignment(
  state: InMemoryAdminQueryState,
  requestId: string
): Assignment | undefined {
  return state.assignments
    .filter((assignment) => assignment.requestId === requestId)
    .sort(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() ||
        right.id.localeCompare(left.id)
    )[0];
}

function latestRound(
  state: InMemoryAdminQueryState,
  requestId: string
): DispatchRound | undefined {
  return state.rounds
    .filter((round) => round.requestId === requestId)
    .sort(
      (left, right) =>
        right.roundNumber - left.roundNumber || right.id.localeCompare(left.id)
    )[0];
}

function latestQuote(
  state: InMemoryAdminQueryState,
  requestId: string
): Quote | undefined {
  return state.quotes
    .filter((quote) => quote.requestId === requestId)
    .sort(
      (left, right) => right.version - left.version || right.id.localeCompare(left.id)
    )[0];
}

function toAssignmentSummary(
  assignment: Assignment
): AdminRequestAssignmentSummary {
  return {
    id: assignment.id,
    requestId: assignment.requestId,
    mechanicId: assignment.mechanicId,
    status: assignment.status,
    acceptedAt: new Date(assignment.acceptedAt),
    startedAt: assignment.startedAt ? new Date(assignment.startedAt) : undefined,
    completedAt: assignment.completedAt
      ? new Date(assignment.completedAt)
      : undefined,
    canceledAt: assignment.canceledAt
      ? new Date(assignment.canceledAt)
      : undefined,
    createdAt: new Date(assignment.createdAt),
    updatedAt: new Date(assignment.updatedAt)
  };
}

function toQuoteSummary(quote: Quote): AdminRequestQuoteSummary {
  return {
    id: quote.id,
    requestId: quote.requestId,
    assignmentId: quote.assignmentId,
    version: quote.version,
    status: quote.status,
    currency: quote.currency,
    subtotalAmount: quote.subtotalAmount,
    discountAmount: quote.discountAmount,
    totalAmount: quote.totalAmount,
    expiresAt: quote.expiresAt ? new Date(quote.expiresAt) : undefined,
    createdAt: new Date(quote.createdAt),
    respondedAt: quote.respondedAt ? new Date(quote.respondedAt) : undefined
  };
}
