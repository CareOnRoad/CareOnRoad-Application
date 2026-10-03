import type { TransactionSql } from "postgres";
import { sanitizeAdminReason } from "@/features/admin/admin-redaction";
import type { AdminSupervisionRepository, SupervisionAction } from "../contracts/admin-supervision.repository";
type Row = { id: string; admin_id: string; request_id: string; assignment_id: string; quote_id: string | null; diagnosis_id: string | null; action: SupervisionAction["action"]; reason: string; created_at: Date };
export class PostgresAdminSupervisionRepository implements AdminSupervisionRepository {
  constructor(private readonly sql: TransactionSql) {}
  async append(input: SupervisionAction) {
    const [row] = await this.sql<Row[]>`insert into admin_supervision_actions (id, admin_id, request_id, assignment_id, quote_id, diagnosis_id, action, reason, created_at)
      values (${input.id}, ${input.adminId}, ${input.requestId}, ${input.assignmentId}, ${input.quoteId ?? null}, ${input.diagnosisId ?? null}, ${input.action}, ${sanitizeAdminReason(input.reason)}, ${input.createdAt}) returning *`;
    return map(row!);
  }
  async list(input: Parameters<AdminSupervisionRepository["list"]>[0]) {
    const rows = await this.sql<Row[]>`select * from admin_supervision_actions where request_id = ${input.requestId}
      and (${input.quoteId ?? null}::uuid is null or quote_id = ${input.quoteId ?? null}::uuid)
      and (${input.diagnosisId ?? null}::uuid is null or diagnosis_id = ${input.diagnosisId ?? null}::uuid)
      and (${input.cursor?.timestamp ?? null}::timestamptz is null or (date_trunc('milliseconds', created_at), id) < (${input.cursor?.timestamp ?? null}::timestamptz, ${input.cursor?.id ?? null}::uuid))
      order by date_trunc('milliseconds', created_at) desc, id desc limit ${input.limit + 1}`;
    return rows.map(map);
  }
}
function map(row: Row): SupervisionAction { return { id: row.id, adminId: row.admin_id, requestId: row.request_id, assignmentId: row.assignment_id, quoteId: row.quote_id ?? undefined, diagnosisId: row.diagnosis_id ?? undefined, action: row.action, reason: row.reason, createdAt: row.created_at }; }
