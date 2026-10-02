import type { TransactionSql } from "postgres";

import { ACTIVE_ASSIGNMENT_STATUSES } from "../contracts/assignment.repository";
import type { Assignment, AssignmentStatus } from "../contracts/assignment.repository";
import type {
  AssignmentCompletionChecklist,
  AssignmentEtaMetadata,
  AssignmentMediaMetadata,
  AssignmentMediaPurpose,
  AssignmentSafetyChecklist,
  CreateAssignmentCompletionChecklist,
  CreateAssignmentEtaMetadata,
  CreateAssignmentMediaMetadata,
  MechanicDashboardReadModel,
  MechanicJobListInput,
  MechanicJobPage,
  MechanicJobSummary,
  MechanicOperationsRepository,
  MechanicPerformanceInput,
  MechanicPerformanceReadModel
} from "../contracts/mechanic-operations.repository";
import type { MechanicProfile, MechanicProfileStatus } from "../contracts/mechanic.repository";
import type { QuoteStatus } from "../contracts/quote.repository";
import type { RequestPriority, RequestStatus } from "../contracts/service-request.repository";
import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";

type ProfileRow = {
  user_id: string;
  profile_status: MechanicProfileStatus;
  is_available: boolean;
  service_radius_km: string;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: Date | null;
  availability_updated_at: Date;
  rating_avg: string;
  rating_count: number;
  service_types: ServiceType[];
  created_at: Date;
  updated_at: Date;
};

type JobRow = {
  id: string;
  request_id: string;
  assignment_status: AssignmentStatus;
  accepted_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  canceled_at: Date | null;
  created_at: Date;
  updated_at: Date;
  request_code: string;
  service_type: ServiceType;
  request_status: RequestStatus;
  priority: RequestPriority;
  request_created_at: Date;
  scheduled_start_at: Date | null;
  latest_quote_status: QuoteStatus | null;
};

type AssignmentRow = {
  id: string;
  request_id: string;
  mechanic_id: string;
  accepted_candidate_id: string | null;
  source: Assignment["source"];
  supersedes_assignment_id: string | null;
  dispatch_distance_m: number | null;
  maintenance_labor_quote_id: string | null;
  status: AssignmentStatus;
  accepted_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  canceled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type AssignmentEtaMetadataRow = {
  id: string;
  assignment_id: string;
  request_id: string;
  mechanic_id: string;
  eta_at: Date | null;
  delay_reason: string | null;
  created_by: string;
  created_at: Date;
};

type AssignmentMediaMetadataRow = {
  id: string;
  assignment_id: string;
  request_id: string;
  mechanic_id: string;
  purpose: AssignmentMediaPurpose;
  media_reference: string;
  content_type: string;
  size_bytes: string;
  checksum: string | null;
  created_by: string;
  created_at: Date;
};

type AssignmentCompletionChecklistRow = {
  id: string;
  assignment_id: string;
  request_id: string;
  mechanic_id: string;
  revision: number;
  approved_quote_id: string | null;
  work_summary: string;
  safety_checklist: AssignmentSafetyChecklistJson;
  notes: string | null;
  created_by: string;
  created_at: Date;
};

type AssignmentSafetyChecklistJson = {
  test_ride_completed: boolean;
  tools_removed: boolean;
  area_safe: boolean;
  rider_briefed: boolean;
  no_fluid_leak: boolean;
};

type DashboardRow = {
  open_offers_count: number;
  today_accepted_jobs: number;
  today_completed_jobs: number;
  today_canceled_jobs: number;
  seven_day_completed_jobs: number;
  seven_day_canceled_jobs: number;
  seven_day_accepted_offers: number;
  seven_day_declined_offers: number;
  seven_day_decided_quotes: number;
  seven_day_approved_quotes: number;
};

type PerformanceRow = {
  completed_jobs: number;
  canceled_jobs: number;
  accepted_offers: number;
  declined_offers: number;
  average_accept_time_seconds: string | null;
  average_workflow_duration_seconds: string | null;
  decided_quotes: number;
  approved_quotes: number;
  rating_avg: string;
  rating_count: number;
};

export class PostgresMechanicOperationsRepository implements MechanicOperationsRepository {
  constructor(private readonly sql: TransactionSql) {}

  async getDashboard(input: {
    mechanicId: string;
    now: Date;
    todayStart: Date;
    sevenDaysStart: Date;
  }): Promise<MechanicDashboardReadModel | undefined> {
    const profile = await this.findProfile(input.mechanicId);
    if (!profile) return undefined;
    const [activeAssignment, rows] = await Promise.all([
      this.findActiveAssignment(input.mechanicId),
      this.sql<DashboardRow[]>`
        select
          (
            select count(*)::integer
            from dispatch_candidates candidate
            where candidate.mechanic_id = ${input.mechanicId}
              and candidate.status = 'offered'
              and candidate.expires_at > ${input.now}
          ) as open_offers_count,
          (
            select count(*)::integer
            from assignments assignment
            where assignment.mechanic_id = ${input.mechanicId}
              and assignment.accepted_at >= ${input.todayStart}
          ) as today_accepted_jobs,
          (
            select count(*)::integer
            from assignments assignment
            where assignment.mechanic_id = ${input.mechanicId}
              and assignment.status = 'completed'
              and assignment.completed_at >= ${input.todayStart}
          ) as today_completed_jobs,
          (
            select count(*)::integer
            from assignments assignment
            where assignment.mechanic_id = ${input.mechanicId}
              and assignment.status = 'canceled'
              and assignment.canceled_at >= ${input.todayStart}
          ) as today_canceled_jobs,
          (
            select count(*)::integer
            from assignments assignment
            where assignment.mechanic_id = ${input.mechanicId}
              and assignment.status = 'completed'
              and assignment.completed_at >= ${input.sevenDaysStart}
          ) as seven_day_completed_jobs,
          (
            select count(*)::integer
            from assignments assignment
            where assignment.mechanic_id = ${input.mechanicId}
              and assignment.status = 'canceled'
              and assignment.canceled_at >= ${input.sevenDaysStart}
          ) as seven_day_canceled_jobs,
          (
            select count(*)::integer
            from dispatch_candidates candidate
            where candidate.mechanic_id = ${input.mechanicId}
              and candidate.status = 'accepted'
              and candidate.created_at >= ${input.sevenDaysStart}
          ) as seven_day_accepted_offers,
          (
            select count(*)::integer
            from dispatch_candidates candidate
            where candidate.mechanic_id = ${input.mechanicId}
              and candidate.status = 'rejected'
              and candidate.created_at >= ${input.sevenDaysStart}
          ) as seven_day_declined_offers,
          (
            select count(*)::integer
            from quotes quote
            join assignments assignment on assignment.id = quote.assignment_id
            where assignment.mechanic_id = ${input.mechanicId}
              and quote.status <> 'pending'
              and quote.created_at >= ${input.sevenDaysStart}
          ) as seven_day_decided_quotes,
          (
            select count(*)::integer
            from quotes quote
            join assignments assignment on assignment.id = quote.assignment_id
            where assignment.mechanic_id = ${input.mechanicId}
              and quote.status = 'approved'
              and quote.created_at >= ${input.sevenDaysStart}
          ) as seven_day_approved_quotes
      `
    ]);
    const row = rows[0]!;
    return {
      profile,
      openOffersCount: row.open_offers_count,
      activeAssignment,
      today: {
        acceptedJobs: row.today_accepted_jobs,
        completedJobs: row.today_completed_jobs,
        canceledJobs: row.today_canceled_jobs
      },
      sevenDays: {
        completedJobs: row.seven_day_completed_jobs,
        canceledJobs: row.seven_day_canceled_jobs,
        acceptedOffers: row.seven_day_accepted_offers,
        declinedOffers: row.seven_day_declined_offers,
        decidedQuotes: row.seven_day_decided_quotes,
        approvedQuotes: row.seven_day_approved_quotes
      }
    };
  }

  async listJobs(input: MechanicJobListInput): Promise<MechanicJobPage> {
    const rows = await this.sql<JobRow[]>`
      select
        assignment.id,
        assignment.request_id,
        assignment.status as assignment_status,
        assignment.accepted_at,
        assignment.started_at,
        assignment.completed_at,
        assignment.canceled_at,
        assignment.created_at,
        assignment.updated_at,
        request.request_code,
        request.service_type,
        request.status as request_status,
        request.priority,
        request.created_at as request_created_at,
        request.scheduled_start_at,
        latest_quote.status as latest_quote_status
      from assignments assignment
      join service_requests request on request.id = assignment.request_id
      left join lateral (
        select quote.status
        from quotes quote
        where quote.request_id = request.id
        order by quote.version desc
        limit 1
      ) latest_quote on true
      where assignment.mechanic_id = ${input.mechanicId}
        and (
          ${input.status ?? null}::assignment_status is null
          or assignment.status = ${input.status ?? null}
        )
        and (
          ${input.activeOnly ?? false}::boolean = false
          or assignment.status in ${this.sql([...ACTIVE_ASSIGNMENT_STATUSES])}
        )
        and (
          ${input.dateFrom ?? null}::timestamptz is null
          or assignment.created_at >= ${input.dateFrom ?? null}
        )
        and (
          ${input.dateTo ?? null}::timestamptz is null
          or assignment.created_at <= ${input.dateTo ?? null}
        )
        and (
          ${input.cursor?.timestamp ?? null}::timestamptz is null
          or (assignment.created_at, assignment.id) <
             (${input.cursor?.timestamp ?? null}, ${input.cursor?.id ?? null}::uuid)
        )
      order by assignment.created_at desc, assignment.id desc
      limit ${input.limit + 1}
    `;
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map(mapJob),
      ...(rows.length > input.limit && last
        ? { nextCursor: { timestamp: last.created_at, id: last.id } }
        : {})
    };
  }

  async getPerformance(
    input: MechanicPerformanceInput
  ): Promise<MechanicPerformanceReadModel | undefined> {
    const rows = await this.sql<PerformanceRow[]>`
      select
        count(assignment.id) filter (
          where assignment.status = 'completed'
        )::integer as completed_jobs,
        count(assignment.id) filter (
          where assignment.status = 'canceled'
        )::integer as canceled_jobs,
        (
          select count(*)::integer
          from dispatch_candidates candidate
          where candidate.mechanic_id = ${input.mechanicId}
            and candidate.status = 'accepted'
            and (${input.dateFrom ?? null}::timestamptz is null or candidate.created_at >= ${input.dateFrom ?? null})
            and (${input.dateTo ?? null}::timestamptz is null or candidate.created_at <= ${input.dateTo ?? null})
        ) as accepted_offers,
        (
          select count(*)::integer
          from dispatch_candidates candidate
          where candidate.mechanic_id = ${input.mechanicId}
            and candidate.status = 'rejected'
            and (${input.dateFrom ?? null}::timestamptz is null or candidate.created_at >= ${input.dateFrom ?? null})
            and (${input.dateTo ?? null}::timestamptz is null or candidate.created_at <= ${input.dateTo ?? null})
        ) as declined_offers,
        (
          select round(avg(extract(epoch from (candidate.responded_at - candidate.offered_at))))::text
          from dispatch_candidates candidate
          where candidate.mechanic_id = ${input.mechanicId}
            and candidate.status = 'accepted'
            and candidate.offered_at is not null
            and candidate.responded_at is not null
            and (${input.dateFrom ?? null}::timestamptz is null or candidate.created_at >= ${input.dateFrom ?? null})
            and (${input.dateTo ?? null}::timestamptz is null or candidate.created_at <= ${input.dateTo ?? null})
        ) as average_accept_time_seconds,
        round(avg(extract(epoch from (assignment.completed_at - assignment.accepted_at))) filter (
            where assignment.status = 'completed'
              and assignment.completed_at is not null
          ))::text as average_workflow_duration_seconds,
        (
          select count(*)::integer
          from quotes quote
          join assignments quoted_assignment on quoted_assignment.id = quote.assignment_id
          where quoted_assignment.mechanic_id = ${input.mechanicId}
            and quote.status <> 'pending'
            and (${input.dateFrom ?? null}::timestamptz is null or quote.created_at >= ${input.dateFrom ?? null})
            and (${input.dateTo ?? null}::timestamptz is null or quote.created_at <= ${input.dateTo ?? null})
        ) as decided_quotes,
        (
          select count(*)::integer
          from quotes quote
          join assignments quoted_assignment on quoted_assignment.id = quote.assignment_id
          where quoted_assignment.mechanic_id = ${input.mechanicId}
            and quote.status = 'approved'
            and (${input.dateFrom ?? null}::timestamptz is null or quote.created_at >= ${input.dateFrom ?? null})
            and (${input.dateTo ?? null}::timestamptz is null or quote.created_at <= ${input.dateTo ?? null})
        ) as approved_quotes,
        profile.rating_avg::text,
        profile.rating_count
      from mechanic_profiles profile
      left join assignments assignment on assignment.mechanic_id = profile.user_id
        and (${input.dateFrom ?? null}::timestamptz is null or assignment.created_at >= ${input.dateFrom ?? null})
        and (${input.dateTo ?? null}::timestamptz is null or assignment.created_at <= ${input.dateTo ?? null})
      where profile.user_id = ${input.mechanicId}
      group by profile.user_id
    `;
    const row = rows[0];
    return row
      ? {
          completedJobs: row.completed_jobs,
          canceledJobs: row.canceled_jobs,
          acceptedOffers: row.accepted_offers,
          declinedOffers: row.declined_offers,
          averageAcceptTimeSeconds: row.average_accept_time_seconds
            ? Number(row.average_accept_time_seconds)
            : undefined,
          averageWorkflowDurationSeconds: row.average_workflow_duration_seconds
            ? Number(row.average_workflow_duration_seconds)
            : undefined,
          decidedQuotes: row.decided_quotes,
          approvedQuotes: row.approved_quotes,
          ratingAvg: Number(row.rating_avg),
          ratingCount: row.rating_count
        }
      : undefined;
  }

  async findOwnedAssignmentForUpdate(input: {
    assignmentId: string;
    mechanicId: string;
  }): Promise<Assignment | undefined> {
    const rows = await this.sql<AssignmentRow[]>`
      select *
      from assignments
      where id = ${input.assignmentId}
        and mechanic_id = ${input.mechanicId}
      for update
      limit 1
    `;
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async createAssignmentEtaMetadata(
    input: CreateAssignmentEtaMetadata
  ): Promise<AssignmentEtaMetadata> {
    const rows = await this.sql<AssignmentEtaMetadataRow[]>`
      insert into assignment_eta_metadata (
        id, assignment_id, request_id, mechanic_id, eta_at,
        delay_reason, created_by, created_at
      )
      values (
        ${input.id}, ${input.assignmentId}, ${input.requestId}, ${input.mechanicId},
        ${input.etaAt ?? null}, ${input.delayReason ?? null}, ${input.createdBy},
        ${input.createdAt}
      )
      returning *
    `;
    return mapAssignmentEtaMetadata(rows[0]!);
  }

  async listAssignmentEtaMetadata(assignmentId: string): Promise<AssignmentEtaMetadata[]> {
    const rows = await this.sql<AssignmentEtaMetadataRow[]>`
      select *
      from assignment_eta_metadata
      where assignment_id = ${assignmentId}
      order by created_at desc, id desc
    `;
    return rows.map(mapAssignmentEtaMetadata);
  }

  async createAssignmentMediaMetadata(
    input: CreateAssignmentMediaMetadata
  ): Promise<AssignmentMediaMetadata> {
    const rows = await this.sql<AssignmentMediaMetadataRow[]>`
      insert into assignment_media_metadata (
        id, assignment_id, request_id, mechanic_id, purpose,
        media_reference, content_type, size_bytes, checksum, created_by, created_at
      )
      values (
        ${input.id}, ${input.assignmentId}, ${input.requestId}, ${input.mechanicId},
        ${input.purpose}, ${input.mediaReference}, ${input.contentType}, ${input.sizeBytes},
        ${input.checksum ?? null}, ${input.createdBy}, ${input.createdAt}
      )
      returning *
    `;
    return mapAssignmentMediaMetadata(rows[0]!);
  }

  async listAssignmentMediaMetadata(assignmentId: string): Promise<AssignmentMediaMetadata[]> {
    const rows = await this.sql<AssignmentMediaMetadataRow[]>`
      select *
      from assignment_media_metadata
      where assignment_id = ${assignmentId}
      order by created_at desc, id desc
    `;
    return rows.map(mapAssignmentMediaMetadata);
  }

  async createAssignmentCompletionChecklist(
    input: CreateAssignmentCompletionChecklist
  ): Promise<AssignmentCompletionChecklist> {
    const rows = await this.sql<AssignmentCompletionChecklistRow[]>`
      insert into assignment_completion_checklists (
        id, assignment_id, request_id, mechanic_id, revision, work_summary,
        safety_checklist, notes, created_by, created_at
        ${input.approvedQuoteId ? this.sql`, approved_quote_id` : this.sql``}
      )
      values (
        ${input.id}, ${input.assignmentId}, ${input.requestId}, ${input.mechanicId},
        (
          select coalesce(max(existing.revision), 0) + 1
          from assignment_completion_checklists existing
          where existing.assignment_id = ${input.assignmentId}
        ),
        ${input.workSummary}, ${this.sql.json(toSafetyChecklistJson(input.safetyChecklist))},
        ${input.notes ?? null}, ${input.createdBy}, ${input.createdAt}
        ${input.approvedQuoteId ? this.sql`, ${input.approvedQuoteId}` : this.sql``}
      )
      returning *
    `;
    return mapAssignmentCompletionChecklist(rows[0]!);
  }

  async getLatestAssignmentCompletionChecklist(
    assignmentId: string
  ): Promise<AssignmentCompletionChecklist | undefined> {
    const rows = await this.sql<AssignmentCompletionChecklistRow[]>`
      select *
      from assignment_completion_checklists
      where assignment_id = ${assignmentId}
      order by revision desc, created_at desc, id desc
      limit 1
    `;
    return rows[0] ? mapAssignmentCompletionChecklist(rows[0]) : undefined;
  }

  private async findProfile(mechanicId: string): Promise<MechanicProfile | undefined> {
    const rows = await this.sql<ProfileRow[]>`
      select
        profile.user_id,
        profile.profile_status,
        profile.is_available,
        profile.service_radius_km::text,
        case when profile.latest_location is null then null else ST_Y(profile.latest_location::geometry) end as latitude,
        case when profile.latest_location is null then null else ST_X(profile.latest_location::geometry) end as longitude,
        profile.location_updated_at,
        profile.availability_updated_at,
        profile.rating_avg::text,
        profile.rating_count,
        coalesce(
          array_agg(skills.service_type::text order by skills.service_type)
            filter (where skills.service_type is not null),
          array[]::text[]
        ) as service_types,
        profile.created_at,
        profile.updated_at
      from mechanic_profiles profile
      left join mechanic_skills skills on skills.mechanic_id = profile.user_id
      where profile.user_id = ${mechanicId}
      group by profile.user_id
      limit 1
    `;
    return rows[0] ? mapProfile(rows[0]) : undefined;
  }

  private async findActiveAssignment(
    mechanicId: string
  ): Promise<MechanicJobSummary | undefined> {
    const rows = await this.sql<JobRow[]>`
      select
        assignment.id,
        assignment.request_id,
        assignment.status as assignment_status,
        assignment.accepted_at,
        assignment.started_at,
        assignment.completed_at,
        assignment.canceled_at,
        assignment.created_at,
        assignment.updated_at,
        request.request_code,
        request.service_type,
        request.status as request_status,
        request.priority,
        request.created_at as request_created_at,
        request.scheduled_start_at,
        latest_quote.status as latest_quote_status
      from assignments assignment
      join service_requests request on request.id = assignment.request_id
      left join lateral (
        select quote.status
        from quotes quote
        where quote.request_id = request.id
        order by quote.version desc
        limit 1
      ) latest_quote on true
      where assignment.mechanic_id = ${mechanicId}
        and assignment.status in ${this.sql([...ACTIVE_ASSIGNMENT_STATUSES])}
        and (assignment.scheduled_start_at is null or assignment.activated_at is not null)
      order by assignment.created_at desc, assignment.id desc
      limit 1
    `;
    return rows[0] ? mapJob(rows[0]) : undefined;
  }
}

function mapAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    requestId: row.request_id,
    mechanicId: row.mechanic_id,
    acceptedCandidateId: row.accepted_candidate_id ?? undefined,
    source: row.source,
    supersedesAssignmentId: row.supersedes_assignment_id ?? undefined,
    dispatchDistanceMeters: row.dispatch_distance_m ?? undefined,
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

function mapAssignmentEtaMetadata(row: AssignmentEtaMetadataRow): AssignmentEtaMetadata {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    requestId: row.request_id,
    mechanicId: row.mechanic_id,
    etaAt: row.eta_at ?? undefined,
    delayReason: row.delay_reason ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function mapAssignmentMediaMetadata(row: AssignmentMediaMetadataRow): AssignmentMediaMetadata {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    requestId: row.request_id,
    mechanicId: row.mechanic_id,
    purpose: row.purpose,
    mediaReference: row.media_reference,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    checksum: row.checksum ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function mapAssignmentCompletionChecklist(
  row: AssignmentCompletionChecklistRow
): AssignmentCompletionChecklist {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    requestId: row.request_id,
    mechanicId: row.mechanic_id,
    revision: row.revision,
    approvedQuoteId: row.approved_quote_id ?? undefined,
    workSummary: row.work_summary,
    safetyChecklist: fromSafetyChecklistJson(row.safety_checklist),
    notes: row.notes ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function toSafetyChecklistJson(
  checklist: AssignmentSafetyChecklist
): AssignmentSafetyChecklistJson {
  return {
    test_ride_completed: checklist.testRideCompleted,
    tools_removed: checklist.toolsRemoved,
    area_safe: checklist.areaSafe,
    rider_briefed: checklist.riderBriefed,
    no_fluid_leak: checklist.noFluidLeak
  };
}

function fromSafetyChecklistJson(
  checklist: AssignmentSafetyChecklistJson
): AssignmentSafetyChecklist {
  return {
    testRideCompleted: checklist.test_ride_completed,
    toolsRemoved: checklist.tools_removed,
    areaSafe: checklist.area_safe,
    riderBriefed: checklist.rider_briefed,
    noFluidLeak: checklist.no_fluid_leak
  };
}

function mapProfile(row: ProfileRow): MechanicProfile {
  return {
    userId: row.user_id,
    profileStatus: row.profile_status,
    isAvailable: row.is_available,
    serviceRadiusKm: Number(row.service_radius_km),
    latestLocation:
      row.latitude === null || row.longitude === null
        ? undefined
        : { latitude: row.latitude, longitude: row.longitude },
    locationUpdatedAt: row.location_updated_at ?? undefined,
    availabilityUpdatedAt: row.availability_updated_at,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count,
    serviceTypes: row.service_types,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapJob(row: JobRow): MechanicJobSummary {
  return {
    id: row.id,
    requestId: row.request_id,
    status: row.assignment_status,
    acceptedAt: row.accepted_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    canceledAt: row.canceled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    request: {
      id: row.request_id,
      requestCode: row.request_code,
      serviceType: row.service_type,
      status: row.request_status,
      priority: row.priority,
      createdAt: row.request_created_at,
      scheduledStartAt: row.scheduled_start_at ?? undefined
    },
    latestQuoteStatus: row.latest_quote_status ?? undefined
  };
}
