import type { TransactionSql } from "postgres";
import type {
  AppendWorkerRun, DeadLetterItem, NeedsReviewPaymentItem, OperationalMonitoringRepository,
  OperationalPageInput, StuckDispatchItem, WorkerRunRecord, WorkerRunStatus
} from "../contracts/operational-monitoring.repository";

export class PostgresOperationalMonitoringRepository implements OperationalMonitoringRepository {
  constructor(private readonly sql: TransactionSql) {}

  async listDeadLetters(input: OperationalPageInput): Promise<DeadLetterItem[]> {
    const rows = await this.sql<DeadLetterRow[]>`
      select id, topic, aggregate_type, aggregate_id, attempt_count, last_error_code, created_at
      from outbox_events where status = 'dead_letter'
        and (${input.cursor?.createdAt ?? null}::timestamptz is null or (created_at, id) < (${input.cursor?.createdAt ?? null}, ${input.cursor?.id ?? null}::uuid))
      order by created_at desc, id desc limit ${input.limit}
    `;
    return rows.map((r) => ({ id:r.id, topic:r.topic, aggregateType:r.aggregate_type, aggregateId:r.aggregate_id,
      attemptCount:r.attempt_count, ...(r.last_error_code ? {lastErrorCode:r.last_error_code}:{}), createdAt:r.created_at }));
  }

  async listNeedsReviewPayments(input: OperationalPageInput): Promise<NeedsReviewPaymentItem[]> {
    const rows = await this.sql<NeedsReviewPaymentRow[]>`
      select id, request_id, assignment_id, updated_at from payment_orders where status = 'needs_review'
        and (${input.cursor?.createdAt ?? null}::timestamptz is null or (updated_at, id) < (${input.cursor?.createdAt ?? null}, ${input.cursor?.id ?? null}::uuid))
      order by updated_at desc, id desc limit ${input.limit}
    `;
    return rows.map((r) => ({ id:r.id, requestId:r.request_id, assignmentId:r.assignment_id, status:"needs_review", updatedAt:r.updated_at }));
  }

  async listStuckDispatch(input: OperationalPageInput & { staleBefore: Date; now: Date }): Promise<StuckDispatchItem[]> {
    const rows = await this.sql<StuckDispatchRow[]>`
      select request.id, request.request_code, request.status, request.updated_at,
        case when request.service_location is null then 'missing_location' else null end as reason_code
      from service_requests request
      where ((request.status in ('dispatching', 'offered') and request.updated_at < ${input.staleBefore})
        or (request.status = 'submitted' and request.service_type = 'periodic_maintenance' and request.service_location is null))
        and not exists (select 1 from dispatch_rounds round where round.request_id=request.id and round.status='active' and round.expires_at > ${input.now})
        and (${input.cursor?.createdAt ?? null}::timestamptz is null or (request.updated_at, request.id) < (${input.cursor?.createdAt ?? null}, ${input.cursor?.id ?? null}::uuid))
      order by request.updated_at desc, request.id desc limit ${input.limit}
    `;
    return rows.map((r) => ({ id:r.id, requestCode:r.request_code, status:r.status, updatedAt:r.updated_at,
      ...(r.reason_code ? { reasonCode: r.reason_code } : {}) }));
  }

  async listWorkerRuns(input: OperationalPageInput & { workerName?: string }): Promise<WorkerRunRecord[]> {
    const rows = await this.sql<WorkerRunRow[]>`
      select * from worker_run_records
      where (${input.cursor?.createdAt ?? null}::timestamptz is null or (date_trunc('milliseconds',completed_at), id) < (${input.cursor?.createdAt ?? null}, ${input.cursor?.id ?? null}::uuid))
        and (${input.workerName ?? null}::text is null or worker_name = ${input.workerName ?? null})
      order by date_trunc('milliseconds',completed_at) desc, id desc limit ${input.limit}
    `;
    return rows.map(mapRun);
  }

  async appendWorkerRun(input: AppendWorkerRun): Promise<WorkerRunRecord> {
    const rows = await this.sql<WorkerRunRow[]>`
      insert into worker_run_records (id, worker_name, status, error_code, items_claimed, items_succeeded, items_failed, started_at, completed_at, created_at)
      values (${input.id}, ${input.workerName}, ${input.status}, ${input.errorCode ?? null}, ${input.itemsClaimed}, ${input.itemsSucceeded}, ${input.itemsFailed}, ${input.startedAt}, ${input.completedAt}, ${input.createdAt ?? input.completedAt}) returning *
    `;
    return mapRun(rows[0]);
  }
}

type DeadLetterRow = { id: string; topic: string; aggregate_type: string; aggregate_id: string; attempt_count: number; last_error_code: string | null; created_at: Date };
type NeedsReviewPaymentRow = { id: string; request_id: string; assignment_id: string; updated_at: Date };
type StuckDispatchRow = { id: string; request_code: string; status: StuckDispatchItem["status"]; updated_at: Date; reason_code: "missing_location" | null };
type WorkerRunRow = { id: string; worker_name: string; status: WorkerRunStatus; error_code: string | null; items_claimed: number; items_succeeded: number; items_failed: number; started_at: Date; completed_at: Date; created_at: Date };

function mapRun(r: WorkerRunRow): WorkerRunRecord {
  return { id:r.id, workerName:r.worker_name, status:r.status as WorkerRunStatus,
    ...(r.error_code ? {errorCode:r.error_code}:{}), itemsClaimed:r.items_claimed,
    itemsSucceeded:r.items_succeeded, itemsFailed:r.items_failed, startedAt:r.started_at,
    completedAt:r.completed_at, createdAt:r.created_at };
}
