import type { Assignment } from "@/server/repositories/contracts/assignment.repository";
import type { AuditActorRole } from "@/server/repositories/contracts/audit.repository";
import type { FoundationRepositories } from "@/server/repositories/contracts/unit-of-work";
import { persistNotification } from "@/features/notifications/notification.service";
import { assertAssignmentStatusTransition } from "./assignment-state";
import { appendAssignmentAuditOutbox } from "./assignment.service";

export class CancellationConflict extends Error {
  readonly status = 409;
  readonly errorCode = "CONFLICT";
  readonly details: { reason_code: string };
  constructor(reason: string) {
    super("Workflow cannot be canceled or recovered without resolving its commitments.");
    this.details = { reason_code: reason };
  }
}

export async function assertNoAssignmentCommitment(repositories: FoundationRepositories, assignment: Assignment, allowClosedQuotes = false): Promise<void> {
  // startedAt currently records travel too; en_route/on_site/diagnosis are still pre-work.
  if (["in_progress", "completed"].includes(assignment.status) || (assignment.status === "accepted" && assignment.startedAt)) throw new CancellationConflict("work_started");
  if (assignment.rescueLaborQuoteId || assignment.maintenanceLaborQuoteId) throw new CancellationConflict("agreement_exists");
  if (await repositories.payments.hasUnresolvedForRequest({ requestId: assignment.requestId })) {
    throw new CancellationConflict("payment_unresolved");
  }
  if (allowClosedQuotes ? await repositories.quotes.hasOpenByAssignment(assignment.id) : await repositories.quotes.hasAnyByAssignment(assignment.id)) throw new CancellationConflict("quote_already_issued");
}

export async function cancelUncommittedAssignment(repositories: FoundationRepositories, assignment: Assignment, input: {
  actorId: string; actorRole: AuditActorRole; reason: string; now: Date; createId: () => string; allowClosedQuotes?: boolean;
}): Promise<Assignment> {
  const allowClosed = input.actorRole === "admin" && input.allowClosedQuotes === true;
  await assertNoAssignmentCommitment(repositories, assignment, allowClosed);
  if (!["accepted", "en_route", "on_site", "diagnosis", ...(allowClosed ? ["quoted"] : [])].includes(assignment.status)) throw new CancellationConflict("assignment_state");
  assertAssignmentStatusTransition(assignment.status, "canceled");
  const updated = await repositories.assignments.updateStatus({ id: assignment.id, status: "canceled", updatedAt: input.now, canceledAt: input.now });
  if (!updated) throw new CancellationConflict("assignment_missing");
  await repositories.assignments.appendStatusHistory({ id: input.createId(), assignmentId: assignment.id,
    fromStatus: assignment.status, toStatus: "canceled", actorId: input.actorId, actorRole: input.actorRole, reason: input.reason, createdAt: input.now });
  await appendAssignmentAuditOutbox({ ...input, action: "assignment.status_changed", assignment: updated,
    audit: repositories.audit, outbox: repositories.outbox, extraPayload: { from_status: assignment.status, to_status: "canceled" } });
  await persistNotification(repositories, { userId: assignment.mechanicId, type: "assignment.canceled", title: "Công việc đã bị hủy",
    body: "Mở danh sách công việc để kiểm tra trạng thái mới.", data: { assignment_id: assignment.id, request_id: assignment.requestId },
    dedupeKey: `assignment.canceled:${assignment.id}:mechanic`, requestId: assignment.requestId }, input.now, input.createId);
  return updated;
}
