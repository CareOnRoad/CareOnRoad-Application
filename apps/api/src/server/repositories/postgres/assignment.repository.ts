import type { TransactionSql } from "postgres";
import type { ListFilter, PageCursor } from "@/lib/list-pagination";

import type {
  Assignment,
  AssignmentRepository,
  AssignmentStatus,
  AssignmentStatusHistory,
  CreateAssignment,
  CreateAssignmentStatusHistory,
  MechanicActiveWorkload
} from "../contracts/assignment.repository";
import { ACTIVE_ASSIGNMENT_STATUSES } from "../contracts/assignment.repository";
import type { AuditActorRole } from "../contracts/audit.repository";
import type { RescuePaymentTiming } from "../contracts/quote.repository";

type AssignmentRow = {
  id: string;
  request_id: string;
  mechanic_id: string;
  accepted_candidate_id: string | null;
  source: Assignment["source"];
  assigned_by_admin_id: string | null;
  supersedes_assignment_id: string | null;
  dispatch_distance_m: number | null;
  scheduled_start_at: Date | null;
  reservation_start_at: Date | null;
  reservation_end_at: Date | null;
  activated_at: Date | null;
  rescue_labor_quote_id: string | null;
  rescue_payment_timing: RescuePaymentTiming | null;
  maintenance_labor_quote_id: string | null;
  status: AssignmentStatus;
  accepted_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  canceled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type AssignmentStatusHistoryRow = {
  id: string;
  assignment_id: string;
  from_status: AssignmentStatus | null;
  to_status: AssignmentStatus;
  actor_id: string | null;
  actor_role: AuditActorRole | null;
  reason: string | null;
  created_at: Date;
};

type MechanicActiveWorkloadRow = {
  mechanic_id: string;
  active_assignment_count: number;
};

export class PostgresAssignmentRepository implements AssignmentRepository {
  constructor(private readonly sql: TransactionSql) {}

  async listHistory(id: string, limit: number, cursor?: PageCursor): Promise<AssignmentStatusHistory[]> {
    const rows = await this.sql<AssignmentStatusHistoryRow[]>`select * from assignment_status_history where assignment_id = ${id}
      and (${cursor?.timestamp ?? null}::timestamptz is null or (date_trunc('milliseconds', created_at), id) < (${cursor?.timestamp ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
      order by date_trunc('milliseconds', created_at) desc, id desc limit ${limit + 1}`;
    return rows.map(mapHistory);
  }

  async hasAnyByRequest(requestId: string) {
    const rows = await this.sql`select exists(select 1 from assignments where request_id = ${requestId}) as found`;
    return Boolean(rows[0].found);
  }

  async hasTravelHistory(id: string) {
    const rows = await this.sql`select exists(select 1 from assignment_status_history where assignment_id = ${id}
      and to_status in ('en_route', 'on_site', 'diagnosis', 'quoted', 'awaiting_payment', 'in_progress', 'completed')) as found`;
    return Boolean(rows[0].found);
  }

  async setReservation(input: Parameters<AssignmentRepository["setReservation"]>[0]) {
    await this.sql`update assignments set scheduled_start_at = ${input.scheduledStartAt}, reservation_start_at = ${input.start},
      reservation_end_at = ${input.end}, updated_at = ${input.updatedAt} where id = ${input.id}`;
  }

  async activate(input: { id: string; now: Date }) {
    await this.sql`update assignments set activated_at = coalesce(activated_at, ${input.now}) where id = ${input.id}`;
  }

  async findReservationConflict(input: Parameters<AssignmentRepository["findReservationConflict"]>[0]) {
    const rows = await this.sql<AssignmentRow[]>`select * from assignments
      where mechanic_id = ${input.mechanicId} and status in ${this.sql([...ACTIVE_ASSIGNMENT_STATUSES])}
        and (${input.excludeId ?? null}::uuid is null or id <> ${input.excludeId ?? null})
        and coalesce(reservation_start_at, accepted_at) < ${input.end}
        and (reservation_end_at is null or reservation_end_at > ${input.start})
      limit 1`;
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async listScheduledForPreparation(input: { now: Date; limit: number }) {
    const rows = await this.sql<AssignmentRow[]>`select a.* from assignments a
      where a.scheduled_start_at >= ${input.now} and a.reservation_start_at <= ${input.now}
        and a.activated_at is null and a.status in ${this.sql([...ACTIVE_ASSIGNMENT_STATUSES])}
        and not exists (select 1 from notifications n where n.dedupe_key in
          ('maintenance.prepare:' || a.id::text || ':rider', 'appointment.prepare:' || a.id::text || ':rider'))
      order by a.scheduled_start_at, a.id limit ${input.limit}`;
    return rows.map(mapAssignment);
  }

  async listReservationConflictMechanicIds(input: Parameters<AssignmentRepository["listReservationConflictMechanicIds"]>[0]) {
    const mechanicIds = [...new Set(input.mechanicIds)];
    if (!mechanicIds.length) return [];
    const rows = await this.sql<{ mechanic_id: string }[]>`select distinct mechanic_id from assignments
      where mechanic_id in ${this.sql(mechanicIds)} and status in ${this.sql([...ACTIVE_ASSIGNMENT_STATUSES])}
        and coalesce(reservation_start_at, accepted_at) < ${input.end}
        and (reservation_end_at is null or reservation_end_at > ${input.start})`;
    return rows.map((row) => row.mechanic_id);
  }

  async setMaintenanceAgreement(input: { id: string; laborQuoteId: string; updatedAt: Date }): Promise<Assignment | undefined> {
    const rows = await this.sql<AssignmentRow[]>`
      update assignments set maintenance_labor_quote_id = ${input.laborQuoteId}, updated_at = ${input.updatedAt}
      where id = ${input.id} and maintenance_labor_quote_id is null returning *
    `;
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async setRescueAgreement(input: { id: string; laborQuoteId: string; paymentTiming: RescuePaymentTiming; updatedAt: Date }): Promise<Assignment | undefined> {
    const rows = await this.sql<AssignmentRow[]>`
      update assignments set rescue_labor_quote_id = ${input.laborQuoteId},
        rescue_payment_timing = ${input.paymentTiming}, updated_at = ${input.updatedAt}
      where id = ${input.id} and rescue_labor_quote_id is null returning *
    `;
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async create(input: CreateAssignment): Promise<Assignment> {
    const rows = await this.sql<AssignmentRow[]>`
      insert into assignments (
        id, request_id, mechanic_id, accepted_candidate_id, status,
        accepted_at, created_at, updated_at, scheduled_start_at, reservation_start_at, reservation_end_at,
        source, assigned_by_admin_id, supersedes_assignment_id, dispatch_distance_m
      )
      values (
        ${input.id}, ${input.requestId}, ${input.mechanicId},
        ${input.acceptedCandidateId ?? null}, ${input.status ?? "accepted"},
        ${input.acceptedAt}, ${input.createdAt}, ${input.updatedAt}, ${input.scheduledStartAt ?? null},
        ${input.reservationStartAt ?? null}, ${input.reservationEndAt ?? null},
        ${input.source ?? "offer"}, ${input.assignedByAdminId ?? null}, ${input.supersedesAssignmentId ?? null}, ${input.dispatchDistanceMeters ?? null}
      )
      returning *
    `;
    return mapAssignment(rows[0]!);
  }

  async findById(id: string): Promise<Assignment | undefined> {
    const rows = await this.sql<AssignmentRow[]>`
      select *
      from assignments
      where id = ${id}
      limit 1
    `;
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async findCancellationHistory(id: string): Promise<AssignmentStatusHistory | undefined> {
    const rows = await this.sql<AssignmentStatusHistoryRow[]>`select * from assignment_status_history
      where assignment_id = ${id} and to_status = 'canceled' order by created_at desc, id desc limit 1`;
    return rows[0] ? mapHistory(rows[0]) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<Assignment | undefined> {
    const rows = await this.sql<AssignmentRow[]>`
      select *
      from assignments
      where id = ${id}
      for update
      limit 1
    `;
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async findByAcceptedCandidate(candidateId: string): Promise<Assignment | undefined> {
    const rows = await this.sql<AssignmentRow[]>`
      select *
      from assignments
      where accepted_candidate_id = ${candidateId}
      limit 1
    `;
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async findActiveByRequestForUpdate(requestId: string): Promise<Assignment | undefined> {
    const rows = await this.sql<AssignmentRow[]>`
      select *
      from assignments
      where request_id = ${requestId}
        and status in ${this.sql([...ACTIVE_ASSIGNMENT_STATUSES])}
      for update
      limit 1
    `;
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async findActiveByMechanicForUpdate(mechanicId: string): Promise<Assignment | undefined> {
    const rows = await this.sql<AssignmentRow[]>`
      select *
      from assignments
      where mechanic_id = ${mechanicId}
        and (scheduled_start_at is null or activated_at is not null)
        and status in ${this.sql([...ACTIVE_ASSIGNMENT_STATUSES])}
      for update
      limit 1
    `;
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async listActiveWorkloadsByMechanicIds(
    mechanicIds: readonly string[]
  ): Promise<MechanicActiveWorkload[]> {
    const uniqueMechanicIds = [...new Set(mechanicIds)];
    if (uniqueMechanicIds.length === 0) {
      return [];
    }
    const rows = await this.sql<MechanicActiveWorkloadRow[]>`
      select mechanic_id, count(*)::integer as active_assignment_count
      from assignments
      where mechanic_id in ${this.sql(uniqueMechanicIds)}
        and (scheduled_start_at is null or activated_at is not null)
        and status in ${this.sql([...ACTIVE_ASSIGNMENT_STATUSES])}
      group by mechanic_id
      order by mechanic_id
    `;
    return rows.map((row) => ({
      mechanicId: row.mechanic_id,
      activeAssignmentCount: row.active_assignment_count
    }));
  }

  async findUnfinishedByMechanicForUpdate(mechanicId: string): Promise<Assignment | undefined> {
    const rows = await this.sql<AssignmentRow[]>`
      select * from assignments
      where mechanic_id = ${mechanicId} and status in ${this.sql([...ACTIVE_ASSIGNMENT_STATUSES])}
      order by id for update limit 1
    `;
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async listVisibleToActor(actor: {
    id: string;
    roles: AuditActorRole[];
  }, input: ListFilter & { statuses?: readonly AssignmentStatus[] } = { limit: 20 }): Promise<Assignment[]> {
    // Postgres `IN` cho `statuses`. Nếu rỗng (caller không truyền) → truyền null
    // để rơi vào nhánh "không filter" giống `status`.
    const statuses = input.statuses && input.statuses.length > 0 ? input.statuses : null;
    const rows = await this.sql<AssignmentRow[]>`
      select assignment.*
      from assignments assignment
      join service_requests request on request.id = assignment.request_id
      where (${actor.roles.includes("admin")}
        or (${actor.roles.includes("mechanic")} and assignment.mechanic_id = ${actor.id})
        or (${actor.roles.includes("rider")} and request.rider_id = ${actor.id}))
        and (${input.status ?? null}::text is null or assignment.status::text = ${input.status ?? null})
        and (${statuses}::text[] is null or assignment.status::text = any(${statuses}::text[]))
        and (${input.date_from ?? null}::timestamptz is null or assignment.created_at >= ${input.date_from ?? null}::timestamptz)
        and (${input.date_to ?? null}::timestamptz is null or assignment.created_at <= ${input.date_to ?? null}::timestamptz)
        and (${input.cursor?.timestamp ?? null}::timestamptz is null or
          (date_trunc('milliseconds', assignment.created_at), assignment.id) < (${input.cursor?.timestamp ?? null}::timestamptz, ${input.cursor?.id ?? null}::uuid))
      order by date_trunc('milliseconds', assignment.created_at) desc, assignment.id desc
      limit ${input.limit + 1}
    `;
    return rows.map(mapAssignment);
  }

  async hasVisibleByRequest(actor: { id: string; roles: AuditActorRole[] }, requestId: string): Promise<boolean> {
    const rows = await this.sql<{ found: boolean }[]>`select exists (
      select 1 from assignments assignment join service_requests request on request.id = assignment.request_id
      where request.id = ${requestId} and (${actor.roles.includes("admin")}
        or (${actor.roles.includes("mechanic")} and assignment.mechanic_id = ${actor.id})
        or (${actor.roles.includes("rider")} and request.rider_id = ${actor.id}))
    ) as found`;
    return rows[0]!.found;
  }

  async updateStatus(input: {
    id: string;
    status: AssignmentStatus;
    updatedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    canceledAt?: Date;
  }): Promise<Assignment | undefined> {
    const rows = await this.sql<AssignmentRow[]>`
      update assignments
      set status = ${input.status},
          started_at = coalesce(${input.startedAt ?? null}, started_at),
          completed_at = coalesce(${input.completedAt ?? null}, completed_at),
          canceled_at = coalesce(${input.canceledAt ?? null}, canceled_at),
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async appendStatusHistory(
    input: CreateAssignmentStatusHistory
  ): Promise<AssignmentStatusHistory> {
    const rows = await this.sql<AssignmentStatusHistoryRow[]>`
      insert into assignment_status_history (
        id, assignment_id, from_status, to_status, actor_id, actor_role, reason, created_at
      )
      values (
        ${input.id}, ${input.assignmentId}, ${input.fromStatus ?? null},
        ${input.toStatus}, ${input.actorId ?? null}, ${input.actorRole ?? null},
        ${input.reason ?? null}, ${input.createdAt ?? new Date()}
      )
      returning *
    `;
    return mapHistory(rows[0]!);
  }
}

function mapAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    requestId: row.request_id,
    mechanicId: row.mechanic_id,
    acceptedCandidateId: row.accepted_candidate_id ?? undefined,
    source: row.source,
    assignedByAdminId: row.assigned_by_admin_id ?? undefined,
    supersedesAssignmentId: row.supersedes_assignment_id ?? undefined,
    dispatchDistanceMeters: row.dispatch_distance_m ?? undefined,
    scheduledStartAt: row.scheduled_start_at ?? undefined,
    reservationStartAt: row.reservation_start_at ?? undefined,
    reservationEndAt: row.reservation_end_at ?? undefined,
    activatedAt: row.activated_at ?? undefined,
    rescueLaborQuoteId: row.rescue_labor_quote_id ?? undefined,
    rescuePaymentTiming: row.rescue_payment_timing ?? undefined,
    maintenanceLaborQuoteId: row.maintenance_labor_quote_id ?? undefined,
    status: row.status,
    acceptedAt: row.accepted_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    canceledAt: row.canceled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapHistory(row: AssignmentStatusHistoryRow): AssignmentStatusHistory {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    fromStatus: row.from_status ?? undefined,
    toStatus: row.to_status,
    actorId: row.actor_id ?? undefined,
    actorRole: row.actor_role ?? undefined,
    reason: row.reason ?? undefined,
    createdAt: row.created_at
  };
}
