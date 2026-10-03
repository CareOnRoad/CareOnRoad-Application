import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { QuoteError, transitionWorkflow } from "@/features/quotes/quote.service";
import { MAX_PAYMENT_AMOUNT } from "@/features/payments/payment-amount";
import { CancellationConflict } from "@/features/assignments/assignment-cancellation";
import { persistNotification } from "@/features/notifications/notification.service";
import { listQuerySchema, toPage } from "@/lib/list-pagination";
import type { Quote } from "@/server/repositories/contracts/quote.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { loadActiveAdminActor } from "./admin.authorization";
import { adminReasonSchema, adminUuidSchema } from "./admin.schemas";
import { prepareAdminCommand, recordAdminAction } from "./admin-command";

const disputeSchema = adminReasonSchema.extend({ resolution: z.enum(["request_revision", "void_pending_quote", "uphold_latest_quote"]) }).strict();
const pageSchema = listQuerySchema.omit({ date_from: true, date_to: true });
export type SupervisionCommand = "diagnosis_revision" | "quote_revision" | "void" | "expire" | "dispute";

export class AdminSupervisionService {
  constructor(private readonly unitOfWork: UnitOfWork, private readonly options: { now?: () => Date; createId?: () => string } = {}) {}
  async read(identity: VerifiedSupabaseIdentity, id: string, kind: "diagnosis" | "quote" | "quotes" | "actions", input: unknown = {}) {
    if (!adminUuidSchema.safeParse(id).success) throw new QuoteError("INVALID_INPUT", "Resource ID is invalid.", 400);
    const parsed = pageSchema.safeParse(input);
    if (!parsed.success) throw new QuoteError("INVALID_INPUT", "Query is invalid.", 400);
    return this.unitOfWork.execute(async (repositories) => {
      await loadActiveAdminActor(identity, repositories.users);
      if (kind === "quote") {
        const quote = await repositories.quotes.findById(id);
        if (!quote) throw new QuoteError("NOT_FOUND", "Quote not found.", 404);
        const actions = await repositories.adminSupervision.list({ requestId: quote.requestId, quoteId: id, ...parsed.data });
        return { ...safeQuote(quote), supervision: toPage(actions, parsed.data.limit, safeAction) };
      }
      if (kind === "diagnosis") {
        const diagnosis = await repositories.diagnoses.findByAssignmentId(id);
        if (!diagnosis) throw new QuoteError("NOT_FOUND", "Diagnosis not found.", 404);
        const history = await repositories.audit.query({ ...parsed.data, entityType: "mechanic_diagnosis", entityId: diagnosis.id });
        const actions = await repositories.adminSupervision.list({ requestId: diagnosis.requestId, diagnosisId: diagnosis.id, ...parsed.data });
        return { id: diagnosis.id, assignment_id: id, request_id: diagnosis.requestId, mechanic_id: diagnosis.mechanicId,
          has_diagnosis: true, has_recommended_work: Boolean(diagnosis.recommendedWorkText), has_safety_notes: Boolean(diagnosis.safetyNotes),
          immutable: await repositories.quotes.hasAnyByDiagnosis(diagnosis.id), created_at: diagnosis.createdAt.toISOString(), updated_at: diagnosis.updatedAt.toISOString(),
          history: toPage(history, parsed.data.limit, (row) => ({ id: row.id, action: row.action, actor_id: row.actorId, created_at: row.createdAt.toISOString() })),
          supervision: toPage(actions, parsed.data.limit, safeAction) };
      }
      if (!await repositories.serviceRequests.findById(id)) throw new QuoteError("NOT_FOUND", "Request not found.", 404);
      if (kind === "quotes") return toPage(await repositories.quotes.listPageByRequest(id, parsed.data.limit, parsed.data.cursor), parsed.data.limit, safeQuote);
      return toPage(await repositories.adminSupervision.list({ requestId: id, ...parsed.data }), parsed.data.limit, safeAction);
    });
  }

  async command(identity: VerifiedSupabaseIdentity, id: string, command: SupervisionCommand, input: unknown, key: string) {
    if (!adminUuidSchema.safeParse(id).success) throw new QuoteError("INVALID_INPUT", "Resource ID is invalid.", 400);
    const parsed = (command === "dispute" ? disputeSchema : adminReasonSchema).safeParse(input);
    if (!parsed.success) throw new QuoteError("INVALID_INPUT", "Supervision command is invalid.", 400);
    return this.unitOfWork.execute(async (repositories) => {
      let actor = await loadActiveAdminActor(identity, repositories.users);
      const diagnosis = command === "diagnosis_revision" ? await repositories.diagnoses.findById(id) : undefined;
      const initial = command === "dispute" ? await repositories.quotes.findLatestByRequest(id) : command === "diagnosis_revision" ? undefined : await repositories.quotes.findById(id);
      if (!diagnosis && !initial) throw new QuoteError("NOT_FOUND", "Supervision target not found.", 404);
      const request = await repositories.serviceRequests.findByIdForUpdate((diagnosis ?? initial)!.requestId);
      const assignment = await repositories.assignments.findByIdForUpdate((diagnosis ?? initial)!.assignmentId);
      if (!request || !assignment) throw new QuoteError("NOT_FOUND", "Workflow not found.", 404);
      actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.options.now?.() ?? new Date(); const createId = this.options.createId ?? randomUUID;
      const scope = `admin.supervision.${command}:${id}`;
      const replay = await prepareAdminCommand(repositories, actor.id, scope, key, parsed.data, now, createId);
      if (replay) return replay;
      let quote: Quote | undefined;
      const action = command === "dispute" ? (parsed.data as z.infer<typeof disputeSchema>).resolution :
        command === "void" ? "void_pending_quote" : command === "expire" ? "expire_quote" : "request_revision";
      if (diagnosis) {
        const locked = await repositories.diagnoses.findByAssignmentIdForUpdate(assignment.id);
        if (locked?.id !== id || !["on_site", "diagnosis"].includes(assignment.status) || request.status !== "in_service") throw new CancellationConflict("diagnosis_state");
        if (await repositories.quotes.hasAnyByDiagnosis(id)) throw new CancellationConflict("diagnosis_issued");
        if (await repositories.payments.hasUnresolvedForRequest({ requestId: request.id })) throw new CancellationConflict("payment_unresolved");
      } else {
        const latest = await repositories.quotes.findLatestByRequestForUpdate(request.id);
        quote = await repositories.quotes.findByIdForUpdate(initial!.id);
        if (!quote || latest?.id !== quote.id || quote.assignmentId !== assignment.id || ["completed", "canceled", "recovery_canceled"].includes(assignment.status)) throw new CancellationConflict("quote_not_current");
        if (action === "uphold_latest_quote") {
          if (!["pending", "approved"].includes(quote.status)) throw new CancellationConflict("quote_closed");
          if ((quote.purpose ?? "standard") === "standard" && (quote.totalAmount <= 0 || quote.totalAmount > MAX_PAYMENT_AMOUNT)) throw new CancellationConflict("legacy_quote_invalid_total");
        } else {
          if (quote.status !== "pending") throw new CancellationConflict("quote_not_pending");
          if (await repositories.payments.hasUnresolvedForRequest({ requestId: request.id, quoteId: quote.id })) throw new CancellationConflict("payment_unresolved");
          if (quote.id === assignment.rescueLaborQuoteId || quote.id === assignment.maintenanceLaborQuoteId) throw new CancellationConflict("agreement_exists");
          if (action === "expire_quote" && (!quote.expiresAt || quote.expiresAt > now)) throw new CancellationConflict("quote_not_expired");
          const addition = quote.purpose === "maintenance_work" && assignment.status === "in_progress" && request.status === "in_service";
          if (!addition && (assignment.status !== "quoted" || request.status !== "awaiting_quote_approval")) throw new CancellationConflict("quote_workflow_state");
        }
      }
      const evidence = await repositories.adminSupervision.append({ id: createId(), adminId: actor.id, requestId: request.id,
        assignmentId: assignment.id, quoteId: quote?.id, diagnosisId: diagnosis?.id, action, reason: parsed.data.reason, createdAt: now });
      if (quote && action !== "uphold_latest_quote") {
        quote = (await repositories.quotes.updateStatus({ id: quote.id, status: action === "expire_quote" ? "expired" : "voided", respondedAt: now }))!;
        if (assignment.status === "quoted") {
          const labor = quote.purpose === "rescue_labor" || quote.purpose === "maintenance_labor";
          await transitionWorkflow(repositories, { assignment, request, assignmentStatus: labor ? "accepted" : "diagnosis", requestStatus: labor ? "assigned" : "in_service",
            actorId: actor.id, actorRole: "admin", now, createId, reason: `admin_${action}` });
        }
      }
      const topic = `admin.supervision.${command}`;
      await recordAdminAction(repositories, { actorId: actor.id, action: topic, entityType: quote ? "quote" : "mechanic_diagnosis", entityId: quote?.id ?? diagnosis!.id,
        requestId: request.id, reason: parsed.data.reason, now, createId, metadata: { resource_id: evidence.id, request_id: request.id, assignment_id: assignment.id, change: action } });
      for (const userId of [assignment.mechanicId, request.riderId]) await persistNotification(repositories, { userId, type: topic, title: "Cập nhật kiểm tra dịch vụ",
        body: "Mở yêu cầu để xem trạng thái báo giá và hướng xử lý mới.", data: { request_id: request.id, assignment_id: assignment.id },
        dedupeKey: `${topic}:${evidence.id}:${userId}`, requestId: request.id }, now, createId);
      const response = { ...safeAction(evidence), ...(quote ? { quote: safeQuote(quote) } : {}) };
      await repositories.idempotency.complete({ actorId: actor.id, scope, idempotencyKey: key, responseStatus: command.endsWith("revision") ? 202 : 200,
        responseBody: response, resourceType: "admin_supervision_action", resourceId: evidence.id, completedAt: now });
      return response;
    });
  }
}

function safeAction(row: import("@/server/repositories/contracts/admin-supervision.repository").SupervisionAction) {
  return { id: row.id, admin_id: row.adminId, request_id: row.requestId, assignment_id: row.assignmentId, quote_id: row.quoteId, diagnosis_id: row.diagnosisId, action: row.action, created_at: row.createdAt.toISOString() };
}
function safeQuote(quote: Quote) {
  return { id: quote.id, request_id: quote.requestId, assignment_id: quote.assignmentId, diagnosis_id: quote.diagnosisId, purpose: quote.purpose ?? "standard", version: quote.version,
    status: quote.status, total_amount: quote.totalAmount, currency: quote.currency, line_count: quote.lines.length,
    expires_at: quote.expiresAt?.toISOString(), created_at: quote.createdAt.toISOString(), responded_at: quote.respondedAt?.toISOString() };
}
