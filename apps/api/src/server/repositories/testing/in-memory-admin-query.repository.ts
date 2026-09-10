import type { AdminInternalNote } from "../contracts/admin-internal-note.repository";
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

type InMemoryAdminQueryState = {
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
