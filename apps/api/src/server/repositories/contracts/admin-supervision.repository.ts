import type { PageCursor } from "@/lib/list-pagination";
export type SupervisionAction = {
  id: string; adminId: string; requestId: string; assignmentId: string; quoteId?: string; diagnosisId?: string;
  action: "request_revision" | "void_pending_quote" | "expire_quote" | "uphold_latest_quote"; reason: string; createdAt: Date;
};
export interface AdminSupervisionRepository {
  append(input: SupervisionAction): Promise<SupervisionAction>;
  list(input: { requestId: string; quoteId?: string; diagnosisId?: string; limit: number; cursor?: PageCursor }): Promise<SupervisionAction[]>;
}
