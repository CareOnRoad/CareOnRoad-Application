import type {
  Assignment,
  AssignmentRepository,
  AssignmentStatus,
  AssignmentStatusHistory,
  CreateAssignment,
  CreateAssignmentStatusHistory,
  MechanicActiveWorkload
} from "../contracts/assignment.repository";
import { ACTIVE_ASSIGNMENT_STATUSES } from "../contracts/assignment.repository";
import type { AuditActorRole } from "../contracts/audit.repository";
import type { RescuePaymentTiming } from "../contracts/quote.repository";
import type { ServiceRequest } from "../contracts/service-request.repository";

export class InMemoryAssignmentRepository implements AssignmentRepository {
  constructor(
    private readonly assignments: Assignment[],
    private readonly history: AssignmentStatusHistory[],
    private readonly serviceRequests: ServiceRequest[]
  ) {}

  async setRescueAgreement(input: { id: string; laborQuoteId: string; paymentTiming: RescuePaymentTiming; updatedAt: Date }): Promise<Assignment | undefined> {
    const assignment = this.assignments.find((item) => item.id === input.id && !item.rescueLaborQuoteId);
    if (!assignment) return undefined;
    assignment.rescueLaborQuoteId = input.laborQuoteId;
    assignment.rescuePaymentTiming = input.paymentTiming;
    assignment.updatedAt = input.updatedAt;
    return cloneAssignment(assignment);
  }

  async create(input: CreateAssignment): Promise<Assignment> {
    if (
      this.assignments.some(
        (assignment) =>
          assignment.requestId === input.requestId && isActiveStatus(assignment.status)
      )
    ) {
      throw new Error("ASSIGNMENT_ACTIVE_REQUEST_EXISTS");
    }
    if (
      this.assignments.some(
        (assignment) =>
          assignment.mechanicId === input.mechanicId && isActiveStatus(assignment.status)
      )
    ) {
      throw new Error("ASSIGNMENT_ACTIVE_MECHANIC_EXISTS");
    }
    if (
      this.assignments.some(
        (assignment) => assignment.acceptedCandidateId === input.acceptedCandidateId
      )
    ) {
      throw new Error("ASSIGNMENT_CANDIDATE_EXISTS");
    }
    const assignment: Assignment = {
      ...input,
      status: input.status ?? "accepted"
    };
    this.assignments.push(assignment);
    return cloneAssignment(assignment);
  }

  async findById(id: string): Promise<Assignment | undefined> {
    const assignment = this.assignments.find((item) => item.id === id);
    return assignment ? cloneAssignment(assignment) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<Assignment | undefined> {
    return this.findById(id);
  }

  async findByAcceptedCandidate(candidateId: string): Promise<Assignment | undefined> {
    const assignment = this.assignments.find(
      (item) => item.acceptedCandidateId === candidateId
    );
    return assignment ? cloneAssignment(assignment) : undefined;
  }

  async findActiveByRequestForUpdate(requestId: string): Promise<Assignment | undefined> {
    const assignment = this.assignments.find(
      (item) => item.requestId === requestId && isActiveStatus(item.status)
    );
    return assignment ? cloneAssignment(assignment) : undefined;
  }

  async findActiveByMechanicForUpdate(mechanicId: string): Promise<Assignment | undefined> {
    const assignment = this.assignments.find(
      (item) => item.mechanicId === mechanicId && isActiveStatus(item.status)
    );
    return assignment ? cloneAssignment(assignment) : undefined;
  }

  async listActiveWorkloadsByMechanicIds(
    mechanicIds: readonly string[]
  ): Promise<MechanicActiveWorkload[]> {
    const requestedIds = new Set(mechanicIds);
    if (requestedIds.size === 0) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const assignment of this.assignments) {
      if (requestedIds.has(assignment.mechanicId) && isActiveStatus(assignment.status)) {
        counts.set(assignment.mechanicId, (counts.get(assignment.mechanicId) ?? 0) + 1);
      }
    }
    return [...counts]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([mechanicId, activeAssignmentCount]) => ({
        mechanicId,
        activeAssignmentCount
      }));
  }

  async listVisibleToActor(actor: {
    id: string;
    roles: AuditActorRole[];
  }): Promise<Assignment[]> {
    if (actor.roles.includes("admin")) {
      return this.assignments
        .slice()
        .sort(sortNewestFirst)
        .map(cloneAssignment);
    }
    if (actor.roles.includes("mechanic")) {
      return this.assignments
        .filter((assignment) => assignment.mechanicId === actor.id)
        .sort(sortNewestFirst)
        .map(cloneAssignment);
    }
    const ownedRequestIds = new Set(
      this.serviceRequests
        .filter((request) => request.riderId === actor.id)
        .map((request) => request.id)
    );
    return this.assignments
      .filter((assignment) => ownedRequestIds.has(assignment.requestId))
      .sort(sortNewestFirst)
      .map(cloneAssignment);
  }

  async updateStatus(input: {
    id: string;
    status: AssignmentStatus;
    updatedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    canceledAt?: Date;
  }): Promise<Assignment | undefined> {
    const assignment = this.assignments.find((item) => item.id === input.id);
    if (!assignment) {
      return undefined;
    }
    assignment.status = input.status;
    assignment.updatedAt = input.updatedAt;
    assignment.startedAt = input.startedAt ?? assignment.startedAt;
    assignment.completedAt = input.completedAt ?? assignment.completedAt;
    assignment.canceledAt = input.canceledAt ?? assignment.canceledAt;
    return cloneAssignment(assignment);
  }

  async appendStatusHistory(
    input: CreateAssignmentStatusHistory
  ): Promise<AssignmentStatusHistory> {
    const row: AssignmentStatusHistory = {
      ...input,
      createdAt: input.createdAt ?? new Date()
    };
    this.history.push(row);
    return cloneHistory(row);
  }
}

function isActiveStatus(status: AssignmentStatus): boolean {
  return ACTIVE_ASSIGNMENT_STATUSES.includes(
    status as (typeof ACTIVE_ASSIGNMENT_STATUSES)[number]
  );
}

function sortNewestFirst(left: Assignment, right: Assignment): number {
  return right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id);
}

function cloneAssignment(assignment: Assignment): Assignment {
  return {
    ...assignment,
    acceptedAt: new Date(assignment.acceptedAt),
    startedAt: assignment.startedAt ? new Date(assignment.startedAt) : undefined,
    completedAt: assignment.completedAt ? new Date(assignment.completedAt) : undefined,
    canceledAt: assignment.canceledAt ? new Date(assignment.canceledAt) : undefined,
    createdAt: new Date(assignment.createdAt),
    updatedAt: new Date(assignment.updatedAt)
  };
}

function cloneHistory(history: AssignmentStatusHistory): AssignmentStatusHistory {
  return {
    ...history,
    createdAt: new Date(history.createdAt)
  };
}
