import type { DispatchRepository } from "@/server/repositories/contracts/dispatch.repository";
import type { RequestStatus } from "@/server/repositories/contracts/service-request.repository";

const ADMIN_CANCELABLE_STATUSES = new Set<RequestStatus>([
  "submitted",
  "dispatching",
  "offered"
]);

const ADMIN_ESCALATABLE_STATUSES = new Set<RequestStatus>([
  "submitted",
  "dispatching",
  "offered"
]);

export type AdminRequestCommand = "cancel" | "manual_escalate";

export function canRunAdminRequestCommand(
  status: RequestStatus,
  command: AdminRequestCommand
): boolean {
  return command === "cancel"
    ? ADMIN_CANCELABLE_STATUSES.has(status)
    : ADMIN_ESCALATABLE_STATUSES.has(status);
}

export async function reconcileOpenDispatchForRequest(
  dispatch: DispatchRepository,
  requestId: string,
  now: Date
): Promise<{ canceledRounds: number; canceledCandidates: number }> {
  return dispatch.cancelOpenDispatchForRequest({ requestId, now });
}
