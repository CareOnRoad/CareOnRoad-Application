import type { TransactionSql } from "postgres";

import type { AdminInternalNote } from "../contracts/admin-internal-note.repository";
import type {
  AdminQueryPage,
  AdminInternalNoteQuery,
  AdminQueryRepository,
  AdminRequestAssignmentSummary,
  AdminRequestCursor,
  AdminRequestDispatchSummary,
  AdminRequestMediaSummary,
  AdminRequestQuoteSummary,
  AdminRequestTimelineCursor,
  AdminRequestTimelineItem,
  AdminServiceRequestDetail,
  AdminServiceRequestQuery,
  AdminServiceRequestSummary
} from "../contracts/admin-query.repository";
import type { AssignmentStatus } from "../contracts/assignment.repository";
import type { DispatchRoundStatus } from "../contracts/dispatch.repository";
import type { QuoteStatus } from "../contracts/quote.repository";
import type {
  FulfillmentMode,
  RequestPriority,
  RequestStatus
} from "../contracts/service-request.repository";
import { mapAdminInternalNote } from "./admin-internal-note.repository";
import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";

type AdminInternalNoteRow = {
  id: string;
  admin_id: string;
  service_request_id: string | null;
  assignment_id: string | null;
  note_text: string;
  created_at: Date;
};

type AdminServiceRequestRow = {
  id: string;
  request_code: string;
  rider_id: string;
  motorcycle_id: string;
  service_type: ServiceType;
  fulfillment_mode: FulfillmentMode | null;
  status: RequestStatus;
  priority: RequestPriority;
  mechanic_id: string | null;
  reminder_id: string | null;
  reminder_context_id: string | null;
  scheduled_start_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type AdminDispatchSummaryRow = {
  round_id: string;
  round_number: number;
  status: DispatchRoundStatus;
  started_at: Date;
  expires_at: Date;
  completed_at: Date | null;
  open_candidate_count: number;
};

type AdminAssignmentSummaryRow = {
  id: string;
  request_id: string;
  mechanic_id: string;
  status: AssignmentStatus;
  accepted_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  canceled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type AdminQuoteSummaryRow = {
  id: string;
  request_id: string;
  assignment_id: string;
  version: number;
  status: QuoteStatus;
  currency: "VND";
  subtotal_amount: string;
  discount_amount: string;
  total_amount: string;
  expires_at: Date | null;
  created_at: Date;
  responded_at: Date | null;
};

type AdminTimelineRow = {
  id: string;
  kind: "status" | "internal_note";
  from_status: RequestStatus | null;
  to_status: RequestStatus | null;
  actor_id: string | null;
  reason: string | null;
  admin_id: string | null;
  note_text: string | null;
  created_at: Date;
};

type AdminMediaSummaryRow = {
  id: string;
  request_id: string;
  media_type: string;
  content_type: string;
  size_bytes: string | null;
  created_by: string;
  created_at: Date;
};

export class PostgresAdminQueryRepository implements AdminQueryRepository {
  constructor(private readonly sql: TransactionSql) {}

  async listInternalNotes(input: AdminInternalNoteQuery): Promise<AdminInternalNote[]> {
    let rows: AdminInternalNoteRow[];

    if (input.serviceRequestId !== undefined) {
      rows = input.cursor
        ? await this.sql<AdminInternalNoteRow[]>`
            select *
            from admin_internal_notes
            where service_request_id = ${input.serviceRequestId}
              and (created_at, id) < (${input.cursor.createdAt}, ${input.cursor.id})
            order by created_at desc, id desc
            limit ${input.limit}
          `
        : await this.sql<AdminInternalNoteRow[]>`
            select *
            from admin_internal_notes
            where service_request_id = ${input.serviceRequestId}
            order by created_at desc, id desc
            limit ${input.limit}
          `;
    } else {
      rows = input.cursor
        ? await this.sql<AdminInternalNoteRow[]>`
            select *
            from admin_internal_notes
            where assignment_id = ${input.assignmentId}
              and (created_at, id) < (${input.cursor.createdAt}, ${input.cursor.id})
            order by created_at desc, id desc
            limit ${input.limit}
          `
        : await this.sql<AdminInternalNoteRow[]>`
            select *
            from admin_internal_notes
            where assignment_id = ${input.assignmentId}
            order by created_at desc, id desc
            limit ${input.limit}
          `;
    }

    return rows.map(mapAdminInternalNote);
  }

  async listServiceRequests(
    input: AdminServiceRequestQuery
  ): Promise<
    AdminQueryPage<AdminServiceRequestSummary, AdminRequestCursor>
  > {
    const rows = await this.sql<AdminServiceRequestRow[]>`
      select
        request.id,
        request.request_code,
        request.rider_id,
        request.motorcycle_id,
        request.service_type,
        request.fulfillment_mode,
        request.status,
        request.priority,
        relationship.mechanic_id,
        request.reminder_id,
        request.reminder_context_id,
        request.scheduled_start_at,
        request.created_at,
        request.updated_at
      from service_requests request
      left join lateral (
        select assignment.mechanic_id
        from assignments assignment
        where assignment.request_id = request.id
        order by assignment.created_at desc, assignment.id desc
        limit 1
      ) relationship on true
      where (
          ${input.status ?? null}::request_status is null
          or request.status = ${input.status ?? null}
        )
        and (
          ${input.serviceType ?? null}::service_type is null
          or request.service_type = ${input.serviceType ?? null}
        )
        and (
          ${input.priority ?? null}::request_priority is null
          or request.priority = ${input.priority ?? null}
        )
        and (
          ${input.riderId ?? null}::uuid is null
          or request.rider_id = ${input.riderId ?? null}
        )
        and (
          ${input.mechanicId ?? null}::uuid is null
          or exists (
            select 1
            from assignments filtered_assignment
            where filtered_assignment.request_id = request.id
              and filtered_assignment.mechanic_id = ${input.mechanicId ?? null}
          )
        )
        and (
          ${input.requestCode ?? null}::text is null
          or request.request_code = ${input.requestCode ?? null}
        )
        and (
          ${input.from ?? null}::timestamptz is null
          or request.created_at >= ${input.from ?? null}
        )
        and (
          ${input.to ?? null}::timestamptz is null
          or request.created_at <= ${input.to ?? null}
        )
        and (
          ${input.cursor?.timestamp ?? null}::timestamptz is null
          or (request.updated_at, request.id) <
            (${input.cursor?.timestamp ?? null}, ${input.cursor?.id ?? null}::uuid)
        )
      order by request.updated_at desc, request.id desc
      limit ${input.limit + 1}
    `;
    return requestPage(rows, input.limit);
  }

  async getServiceRequestDetail(
    requestId: string
  ): Promise<AdminServiceRequestDetail | undefined> {
    const rows = await this.sql<AdminServiceRequestRow[]>`
      select
        request.id,
        request.request_code,
        request.rider_id,
        request.motorcycle_id,
        request.service_type,
        request.fulfillment_mode,
        request.status,
        request.priority,
        relationship.mechanic_id,
        request.reminder_id,
        request.reminder_context_id,
        request.scheduled_start_at,
        request.created_at,
        request.updated_at
      from service_requests request
      left join lateral (
        select assignment.mechanic_id
        from assignments assignment
        where assignment.request_id = request.id
        order by assignment.created_at desc, assignment.id desc
        limit 1
      ) relationship on true
      where request.id = ${requestId}
      limit 1
    `;
    if (!rows[0]) {
      return undefined;
    }

    const [dispatch, assignment, quote] = await Promise.all([
      this.getDispatchSummary(requestId),
      this.getRequestAssignment(requestId),
      this.getLatestQuote(requestId)
    ]);
    const request = mapRequestSummary(rows[0]);
    return {
      ...request,
      ...(dispatch ? { dispatch } : {}),
      ...(assignment ? { assignment } : {}),
      ...(quote ? { latestQuote: quote } : {}),
      ...(rows[0].reminder_id
        ? {
            reminder: {
              reminderId: rows[0].reminder_id,
              ...(rows[0].reminder_context_id
                ? { occurrenceId: rows[0].reminder_context_id }
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
    const rows = await this.sql<AdminTimelineRow[]>`
      select *
      from (
        select
          history.id,
          'status'::text as kind,
          history.from_status,
          history.to_status,
          history.actor_id,
          history.reason,
          null::uuid as admin_id,
          null::text as note_text,
          history.created_at
        from request_status_history history
        where history.request_id = ${input.requestId}
        union all
        select
          note.id,
          'internal_note'::text as kind,
          null::request_status as from_status,
          null::request_status as to_status,
          null::uuid as actor_id,
          null::text as reason,
          note.admin_id,
          note.note_text,
          note.created_at
        from admin_internal_notes note
        where note.service_request_id = ${input.requestId}
      ) timeline
      where (
        ${input.cursor?.createdAt ?? null}::timestamptz is null
        or (timeline.created_at, timeline.id) <
          (${input.cursor?.createdAt ?? null}, ${input.cursor?.id ?? null}::uuid)
      )
      order by timeline.created_at desc, timeline.id desc
      limit ${input.limit + 1}
    `;
    const hasMore = rows.length > input.limit;
    const selected = rows.slice(0, input.limit);
    const last = selected.at(-1);
    return {
      items: selected.map(mapTimelineItem),
      ...(hasMore && last
        ? { nextCursor: { createdAt: last.created_at, id: last.id } }
        : {})
    };
  }

  async listRequestMedia(input: {
    requestId: string;
    cursor?: AdminRequestCursor;
    limit: number;
  }): Promise<
    AdminQueryPage<AdminRequestMediaSummary, AdminRequestCursor>
  > {
    const rows = await this.sql<AdminMediaSummaryRow[]>`
      select
        id, request_id, media_type, content_type, size_bytes, created_by, created_at
      from request_media_metadata
      where request_id = ${input.requestId}
        and (
          ${input.cursor?.timestamp ?? null}::timestamptz is null
          or (created_at, id) <
            (${input.cursor?.timestamp ?? null}, ${input.cursor?.id ?? null}::uuid)
        )
      order by created_at desc, id desc
      limit ${input.limit + 1}
    `;
    const hasMore = rows.length > input.limit;
    const selected = rows.slice(0, input.limit);
    const last = selected.at(-1);
    return {
      items: selected.map(mapMediaSummary),
      ...(hasMore && last
        ? { nextCursor: { timestamp: last.created_at, id: last.id } }
        : {})
    };
  }

  async getRequestAssignment(
    requestId: string
  ): Promise<AdminRequestAssignmentSummary | undefined> {
    const rows = await this.sql<AdminAssignmentSummaryRow[]>`
      select *
      from assignments
      where request_id = ${requestId}
      order by created_at desc, id desc
      limit 1
    `;
    return rows[0] ? mapAssignmentSummary(rows[0]) : undefined;
  }

  async listRequestQuotes(input: {
    requestId: string;
    cursor?: AdminRequestCursor;
    limit: number;
  }): Promise<AdminQueryPage<AdminRequestQuoteSummary, AdminRequestCursor>> {
    const rows = await this.sql<AdminQuoteSummaryRow[]>`
      select
        id, request_id, assignment_id, version, status, currency,
        subtotal_amount, discount_amount, total_amount, expires_at,
        created_at, responded_at
      from quotes
      where request_id = ${input.requestId}
        and (
          ${input.cursor?.timestamp ?? null}::timestamptz is null
          or (created_at, id) <
            (${input.cursor?.timestamp ?? null}, ${input.cursor?.id ?? null}::uuid)
        )
      order by created_at desc, id desc
      limit ${input.limit + 1}
    `;
    const hasMore = rows.length > input.limit;
    const selected = rows.slice(0, input.limit);
    const last = selected.at(-1);
    return {
      items: selected.map(mapQuoteSummary),
      ...(hasMore && last
        ? { nextCursor: { timestamp: last.created_at, id: last.id } }
        : {})
    };
  }

  private async getDispatchSummary(
    requestId: string
  ): Promise<AdminRequestDispatchSummary | undefined> {
    const rows = await this.sql<AdminDispatchSummaryRow[]>`
      select
        round.id as round_id,
        round.round_number,
        round.status,
        round.started_at,
        round.expires_at,
        round.completed_at,
        count(candidate.id) filter (
          where candidate.status in ('pending', 'offered')
        )::int as open_candidate_count
      from dispatch_rounds round
      left join dispatch_candidates candidate on candidate.round_id = round.id
      where round.request_id = ${requestId}
      group by round.id
      order by round.round_number desc, round.id desc
      limit 1
    `;
    return rows[0] ? mapDispatchSummary(rows[0]) : undefined;
  }

  private async getLatestQuote(
    requestId: string
  ): Promise<AdminRequestQuoteSummary | undefined> {
    const rows = await this.sql<AdminQuoteSummaryRow[]>`
      select
        id, request_id, assignment_id, version, status, currency,
        subtotal_amount, discount_amount, total_amount, expires_at,
        created_at, responded_at
      from quotes
      where request_id = ${requestId}
      order by version desc, id desc
      limit 1
    `;
    return rows[0] ? mapQuoteSummary(rows[0]) : undefined;
  }
}

function requestPage(
  rows: AdminServiceRequestRow[],
  limit: number
): AdminQueryPage<AdminServiceRequestSummary, AdminRequestCursor> {
  const hasMore = rows.length > limit;
  const selected = rows.slice(0, limit);
  const last = selected.at(-1);
  return {
    items: selected.map(mapRequestSummary),
    ...(hasMore && last
      ? { nextCursor: { timestamp: last.updated_at, id: last.id } }
      : {})
  };
}

function mapRequestSummary(row: AdminServiceRequestRow): AdminServiceRequestSummary {
  return {
    id: row.id,
    requestCode: row.request_code,
    riderId: row.rider_id,
    motorcycleId: row.motorcycle_id,
    serviceType: row.service_type,
    fulfillmentMode: row.fulfillment_mode ?? undefined,
    status: row.status,
    priority: row.priority,
    mechanicId: row.mechanic_id ?? undefined,
    scheduledStartAt: row.scheduled_start_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDispatchSummary(
  row: AdminDispatchSummaryRow
): AdminRequestDispatchSummary {
  return {
    roundId: row.round_id,
    roundNumber: row.round_number,
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    completedAt: row.completed_at ?? undefined,
    openCandidateCount: row.open_candidate_count
  };
}

function mapAssignmentSummary(
  row: AdminAssignmentSummaryRow
): AdminRequestAssignmentSummary {
  return {
    id: row.id,
    requestId: row.request_id,
    mechanicId: row.mechanic_id,
    status: row.status,
    acceptedAt: row.accepted_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    canceledAt: row.canceled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapQuoteSummary(row: AdminQuoteSummaryRow): AdminRequestQuoteSummary {
  return {
    id: row.id,
    requestId: row.request_id,
    assignmentId: row.assignment_id,
    version: row.version,
    status: row.status,
    currency: row.currency,
    subtotalAmount: Number(row.subtotal_amount),
    discountAmount: Number(row.discount_amount),
    totalAmount: Number(row.total_amount),
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? undefined
  };
}

function mapTimelineItem(row: AdminTimelineRow): AdminRequestTimelineItem {
  if (row.kind === "internal_note") {
    return {
      id: row.id,
      kind: "internal_note",
      adminId: row.admin_id!,
      noteText: row.note_text!,
      createdAt: row.created_at
    };
  }
  return {
    id: row.id,
    kind: "status",
    fromStatus: row.from_status ?? undefined,
    toStatus: row.to_status!,
    actorId: row.actor_id ?? undefined,
    reason: row.reason ?? undefined,
    createdAt: row.created_at
  };
}

function mapMediaSummary(row: AdminMediaSummaryRow): AdminRequestMediaSummary {
  return {
    id: row.id,
    requestId: row.request_id,
    mediaType: row.media_type,
    contentType: row.content_type,
    sizeBytes: row.size_bytes === null ? undefined : Number(row.size_bytes),
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}
