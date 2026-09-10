import type { AssignmentStatus } from "@/server/repositories/contracts/assignment.repository";

const TRANSITIONS: ReadonlyMap<AssignmentStatus, ReadonlySet<AssignmentStatus>> = new Map([
  ["accepted", transitionSet(["en_route", "canceled", "recovery_canceled"])],
  ["en_route", transitionSet(["on_site", "canceled", "recovery_canceled"])],
  ["on_site", transitionSet(["diagnosis", "canceled"])],
  ["diagnosis", transitionSet(["quoted", "canceled"])],
  ["quoted", transitionSet(["awaiting_payment", "canceled"])],
  ["awaiting_payment", transitionSet(["in_progress", "canceled"])],
  ["in_progress", transitionSet(["completed", "canceled"])],
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
