import { filterPage } from "@/lib/list-pagination";
import { sanitizeAdminReason } from "@/features/admin/admin-redaction";
import type { AdminSupervisionRepository, SupervisionAction } from "../contracts/admin-supervision.repository";
export class InMemoryAdminSupervisionRepository implements AdminSupervisionRepository {
  constructor(private readonly rows: SupervisionAction[]) {}
  async append(input: SupervisionAction) { const row = { ...input, reason: sanitizeAdminReason(input.reason) }; this.rows.push(row); return row; }
  async list(input: Parameters<AdminSupervisionRepository["list"]>[0]) {
    return filterPage(this.rows.filter((row) => row.requestId === input.requestId && (!input.quoteId || row.quoteId === input.quoteId) && (!input.diagnosisId || row.diagnosisId === input.diagnosisId)), input);
  }
}
