import type { AssignmentStatus } from "@/server/repositories/contracts/assignment.repository";

const TRANSITIONS: ReadonlyMap<AssignmentStatus, ReadonlySet<AssignmentStatus>> = new Map([
  ["accepted", transitionSet(["quoted", "en_route", "canceled", "recovery_canceled"])],
  ["en_route", transitionSet(["on_site", "canceled", "recovery_canceled"])],
  ["on_site", transitionSet(["diagnosis", "canceled"])],
  ["diagnosis", transitionSet(["quoted", "in_progress", "canceled"])],
  ["quoted", transitionSet(["accepted", "diagnosis", "awaiting_payment", "canceled", "recovery_canceled"])],
  ["awaiting_payment", transitionSet(["in_progress", "completed", "canceled"])],
  ["in_progress", transitionSet(["awaiting_payment", "completed", "canceled"])],
  ["completed", transitionSet([])],
  ["canceled", transitionSet([])],
  ["recovery_canceled", transitionSet([])]
]);

export function canTransitionAssignmentStatus(
  from: AssignmentStatus,
  to: AssignmentStatus
): boolean {
  return TRANSITIONS.get(from)?.has(to) ?? false;
}

export function assertAssignmentStatusTransition(
  from: AssignmentStatus,
  to: AssignmentStatus
): void {
  if (!canTransitionAssignmentStatus(from, to)) {
    throw new Error(`Illegal assignment transition: ${from} -> ${to}`);
  }
}

function transitionSet(statuses: AssignmentStatus[]): ReadonlySet<AssignmentStatus> {
  return new Set(statuses);
}
