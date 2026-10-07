import type { TransactionSql } from "postgres";
import type { ListFilter } from "@/lib/list-pagination";

import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";
import { getPostgresErrorCode } from "@/server/db/database-errors";
import type { JsonObject } from "../contracts/idempotency.repository";
import type { GeoPoint } from "../contracts/mechanic.repository";
import type {
  CreateRequestStatusHistory,
  CreateServiceRequest,
  RequestPriority,
  RequestStatus,
  RequestStatusHistory,
  ServiceRequest,
  ServiceRequestRepository
} from "../contracts/service-request.repository";

type ServiceRequestRow = {
  id: string;
  request_code: string;
  rider_id: string;
  motorcycle_id: string;
  service_type: ServiceType;
  fulfillment_mode: ServiceRequest["fulfillmentMode"] | null;
  problem_description: string;
  status: RequestStatus;
  priority: RequestPriority;
  latitude: number | null;
  longitude: number | null;
  address_text: string | null;
  scheduled_start_at: Date | null;
  safety_answers: JsonObject | null;
  maintenance_notes: string | null;
  manual_escalation_reason: string | null;
  dispatch_episode_start_round: number;
  dispatch_retry_count: number;
  canceled_reason: string | null;
  reminder_id: string | null;
  reminder_context_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type RequestStatusHistoryRow = {
  id: string;
  request_id: string;
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  actor_id: string | null;
  reason: string | null;
  created_at: Date;
};

export class PostgresServiceRequestRepository implements ServiceRequestRepository {
  constructor(private readonly sql: TransactionSql) {}

  async startDispatchEpisode(input: { id: string; startRound: number; updatedAt: Date }): Promise<ServiceRequest> {
    const rows = await this.sql<ServiceRequestRow[]>`update service_requests
      set dispatch_episode_start_round = ${input.startRound}, dispatch_retry_count = dispatch_retry_count + 1,
        updated_at = ${input.updatedAt}
      where id = ${input.id} and dispatch_retry_count < 3 returning ${this.selection()}`;
    if (!rows[0]) throw new Error("DISPATCH_RETRY_LIMIT_REACHED");
    return mapRequest(rows[0]);
  }

  async updateAppointment(input: Parameters<ServiceRequestRepository["updateAppointment"]>[0]) {
    const rows = await this.sql<ServiceRequestRow[]>`update service_requests
      set service_location = ST_SetSRID(ST_MakePoint(${input.location.longitude}, ${input.location.latitude}), 4326)::geography,
        address_text = ${input.addressText ?? null}, scheduled_start_at = ${input.scheduledStartAt ?? null},
        updated_at = ${input.updatedAt} where id = ${input.id} returning ${this.selection()}`;
    return mapRequest(rows[0]!);
  }

  async create(input: CreateServiceRequest): Promise<ServiceRequest> {
    try {
      const rows = await this.sql<ServiceRequestRow[]>`
        insert into service_requests (
          id, request_code, rider_id, motorcycle_id, service_type, fulfillment_mode,
          problem_description, status, priority, service_location, address_text,
          scheduled_start_at, safety_answers, maintenance_notes,
          manual_escalation_reason, canceled_reason, reminder_id, reminder_context_id,
          created_at, updated_at
        )
        values (
          ${input.id}, ${input.requestCode}, ${input.riderId}, ${input.motorcycleId},
          ${input.serviceType}, ${input.fulfillmentMode ?? null}, ${input.problemDescription},
          ${input.status ?? "submitted"}, ${input.priority ?? "normal"},
          ${
            input.serviceLocation
              ? this.sql`ST_SetSRID(ST_MakePoint(${input.serviceLocation.longitude}, ${input.serviceLocation.latitude}), 4326)::geography`
              : null
          },
          ${input.addressText ?? null}, ${input.scheduledStartAt ?? null},
          ${
            input.safetyAnswers
              ? this.sql.json(input.safetyAnswers as Parameters<TransactionSql["json"]>[0])
              : null
          },
          ${input.maintenanceNotes ?? null}, ${input.manualEscalationReason ?? null},
          ${input.canceledReason ?? null}, ${input.reminderId ?? null},
          ${input.reminderContextId ?? null}, ${input.createdAt}, ${input.updatedAt}
        )
        returning ${this.selection()}
      `;
      return mapRequest(rows[0]!);
    } catch (error) {
      if (isRequestCodeUniqueConflict(error)) {
        throw new Error("SERVICE_REQUEST_CODE_EXISTS");
      }
      throw error;
    }
  }

  async listByRider(riderId: string, input: ListFilter = { limit: 20 }): Promise<ServiceRequest[]> {
    const rows = await this.sql<ServiceRequestRow[]>`
      select ${this.selection()}
      from service_requests
      where rider_id = ${riderId}
        and (${input.status ?? null}::text is null or status::text = ${input.status ?? null})
        and (${input.date_from ?? null}::timestamptz is null or created_at >= ${input.date_from ?? null}::timestamptz)
        and (${input.date_to ?? null}::timestamptz is null or created_at <= ${input.date_to ?? null}::timestamptz)
        and (${input.cursor?.timestamp ?? null}::timestamptz is null or
          (date_trunc('milliseconds', created_at), id) < (${input.cursor?.timestamp ?? null}::timestamptz, ${input.cursor?.id ?? null}::uuid))
      order by date_trunc('milliseconds', created_at) desc, id desc
      limit ${input.limit + 1}
    `;
    return rows.map(mapRequest);
  }

  async findById(id: string): Promise<ServiceRequest | undefined> {
    const rows = await this.sql<ServiceRequestRow[]>`
      select ${this.selection()}
      from service_requests
      where id = ${id}
      limit 1
    `;
    return rows[0] ? mapRequest(rows[0]) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<ServiceRequest | undefined> {
    const rows = await this.sql<ServiceRequestRow[]>`
      select ${this.selection()}
      from service_requests
      where id = ${id}
      for update
      limit 1
    `;
    return rows[0] ? mapRequest(rows[0]) : undefined;
  }

  async updateStatus(input: {
    id: string;
    status: RequestStatus;
    updatedAt: Date;
    canceledReason?: string;
    manualEscalationReason?: string;
  }): Promise<ServiceRequest | undefined> {
    const rows = await this.sql<ServiceRequestRow[]>`
      update service_requests
      set status = ${input.status},
          canceled_reason = ${input.canceledReason ?? null},
          manual_escalation_reason = ${input.manualEscalationReason ?? null},
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning ${this.selection()}
    `;
    return rows[0] ? mapRequest(rows[0]) : undefined;
  }

  async appendStatusHistory(input: CreateRequestStatusHistory): Promise<RequestStatusHistory> {
    const rows = await this.sql<RequestStatusHistoryRow[]>`
      insert into request_status_history (
        id, request_id, from_status, to_status, actor_id, reason, created_at
      )
      values (
        ${input.id}, ${input.requestId}, ${input.fromStatus ?? null},
        ${input.toStatus}, ${input.actorId ?? null}, ${input.reason ?? null},
        ${input.createdAt ?? new Date()}
      )
      returning *
    `;
    return mapHistory(rows[0]!);
  }

  async listStatusHistory(requestId: string): Promise<RequestStatusHistory[]> {
    const rows = await this.sql<RequestStatusHistoryRow[]>`
      select *
      from request_status_history
      where request_id = ${requestId}
      order by created_at desc, id desc
    `;
    return rows.map(mapHistory);
  }

  async listCompletedLastUpdatedByMotorcycles(input: {
    motorcycleIds: string[];
  }): Promise<Map<string, Date>> {
    const result = new Map<string, Date>();
    if (input.motorcycleIds.length === 0) {
      return result;
    }
    // Lấy ngày thực sự hoàn thành (timestamp chuyển status sang 'completed')
    // từ request_status_history, không dùng service_requests.updated_at vì
    // updated_at bị đụng bởi nhiều thao tác khác sau completion.
    const rows = await this.sql<{ motorcycle_id: string; last_at: Date }[]>`
      select sr.motorcycle_id, max(rsh.created_at) as last_at
      from service_requests sr
      join request_status_history rsh
        on rsh.request_id = sr.id
       and rsh.to_status = 'completed'
      where sr.motorcycle_id = any(${this.sql.array(input.motorcycleIds)}::uuid[])
      group by sr.motorcycle_id
    `;
    for (const row of rows) {
      result.set(row.motorcycle_id, row.last_at);
    }
    return result;
  }

  async listUpcomingMaintenanceByMotorcycles(input: {
    motorcycleIds: string[];
    activeStatuses: readonly RequestStatus[];
    now: Date;
  }): Promise<Map<string, Date>> {
    const result = new Map<string, Date>();
    if (input.motorcycleIds.length === 0) {
      return result;
    }
    const rows = await this.sql<{ motorcycle_id: string; earliest: Date }[]>`
      select motorcycle_id, min(scheduled_start_at) as earliest
      from service_requests
      where motorcycle_id = any(${this.sql.array(input.motorcycleIds)}::uuid[])
        and service_type = 'periodic_maintenance'
        and status::text = any(${this.sql.array([...input.activeStatuses])}::text[])
        and scheduled_start_at is not null
        and scheduled_start_at > ${input.now}
      group by motorcycle_id
    `;
    for (const row of rows) {
      result.set(row.motorcycle_id, row.earliest);
    }
    return result;
  }

  private selection() {
    return this.sql`
      id,
      request_code,
      rider_id,
      motorcycle_id,
      service_type,
      fulfillment_mode,
      problem_description,
      status,
      priority,
      case when service_location is null then null else ST_Y(service_location::geometry) end as latitude,
      case when service_location is null then null else ST_X(service_location::geometry) end as longitude,
      address_text,
      scheduled_start_at,
      safety_answers,
      maintenance_notes,
      manual_escalation_reason,
      dispatch_episode_start_round,
      dispatch_retry_count,
      canceled_reason,
      reminder_id,
      reminder_context_id,
      created_at,
      updated_at
    `;
  }
}

function isRequestCodeUniqueConflict(error: unknown): boolean {
  if (getPostgresErrorCode(error) !== "23505" || !error || typeof error !== "object") {
    return false;
  }
  const constraint = "constraint_name" in error ? String(error.constraint_name) : "";
  const message = "message" in error ? String(error.message) : "";
  return constraint.includes("request_code") || message.includes("request_code");
}

function mapRequest(row: ServiceRequestRow): ServiceRequest {
  const serviceLocation: GeoPoint | undefined =
    row.latitude === null || row.longitude === null
      ? undefined
      : { latitude: row.latitude, longitude: row.longitude };
  return {
    dispatchEpisodeStartRound: row.dispatch_episode_start_round,
    dispatchRetryCount: row.dispatch_retry_count,
    id: row.id,
    requestCode: row.request_code,
    riderId: row.rider_id,
    motorcycleId: row.motorcycle_id,
    serviceType: row.service_type,
    fulfillmentMode: row.fulfillment_mode ?? undefined,
    problemDescription: row.problem_description,
    status: row.status,
    priority: row.priority,
    serviceLocation,
    addressText: row.address_text ?? undefined,
    scheduledStartAt: row.scheduled_start_at ?? undefined,
    safetyAnswers: row.safety_answers ?? undefined,
    maintenanceNotes: row.maintenance_notes ?? undefined,
    manualEscalationReason: row.manual_escalation_reason ?? undefined,
    canceledReason: row.canceled_reason ?? undefined,
    reminderId: row.reminder_id ?? undefined,
    reminderContextId: row.reminder_context_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapHistory(row: RequestStatusHistoryRow): RequestStatusHistory {
  return {
    id: row.id,
    requestId: row.request_id,
    fromStatus: row.from_status ?? undefined,
    toStatus: row.to_status,
    actorId: row.actor_id ?? undefined,
    reason: row.reason ?? undefined,
    createdAt: row.created_at
  };
}
