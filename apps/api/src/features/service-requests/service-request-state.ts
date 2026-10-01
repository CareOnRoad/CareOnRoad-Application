import type { RequestStatus } from "@/server/repositories/contracts/service-request.repository";

const TRANSITIONS: ReadonlyMap<RequestStatus, ReadonlySet<RequestStatus>> = new Map([
  ["submitted", transitionSet(["dispatching", "manual_escalation", "canceled"])],
  ["dispatching", transitionSet(["offered", "manual_escalation", "canceled"])],
  ["offered", transitionSet(["assigned", "manual_escalation", "canceled"])],
  ["assigned", transitionSet(["awaiting_quote_approval", "mechanic_en_route", "submitted", "canceled"])],
  ["mechanic_en_route", transitionSet(["submitted", "in_service"])],
  ["in_service", transitionSet(["awaiting_quote_approval", "awaiting_payment", "completed"])],
  ["awaiting_quote_approval", transitionSet(["assigned", "submitted", "in_service", "awaiting_payment"])],
  ["awaiting_payment", transitionSet(["in_service", "completed"])],
  ["manual_escalation", transitionSet(["submitted"])],
  ["canceled", transitionSet([])],
  ["completed", transitionSet([])]
]);

export function canTransitionRequestStatus(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS.get(from)?.has(to) ?? false;
}

export function assertRequestStatusTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransitionRequestStatus(from, to)) {
    throw new Error(`Illegal service request transition: ${from} -> ${to}`);
  }
}

function transitionSet(statuses: RequestStatus[]): ReadonlySet<RequestStatus> {
  return new Set(statuses);
}
