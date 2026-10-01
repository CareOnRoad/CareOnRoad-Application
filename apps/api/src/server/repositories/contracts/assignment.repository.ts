import type { AuditActorRole } from "./audit.repository";
import type { RescuePaymentTiming } from "./quote.repository";

export type AssignmentStatus =
  | "accepted"
  | "en_route"
  | "on_site"
  | "diagnosis"
  | "quoted"
  | "awaiting_payment"
  | "in_progress"
  | "completed"
  | "canceled"
  | "recovery_canceled";

export const ACTIVE_ASSIGNMENT_STATUSES = [
  "accepted",
  "en_route",
  "on_site",
  "diagnosis",
  "quoted",
  "awaiting_payment",
  "in_progress"
] as const satisfies readonly AssignmentStatus[];

export type Assignment = {
  id: string;
  requestId: string;
  mechanicId: string;
  acceptedCandidateId: string;
  rescueLaborQuoteId?: string;
  rescuePaymentTiming?: RescuePaymentTiming;
  status: AssignmentStatus;
  acceptedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AssignmentStatusHistory = {
  id: string;
  assignmentId: string;
  fromStatus?: AssignmentStatus;
  toStatus: AssignmentStatus;
  actorId?: string;
  actorRole?: AuditActorRole;
  reason?: string;
  createdAt: Date;
};

export type CreateAssignment = {
  id: string;
  requestId: string;
  mechanicId: string;
  acceptedCandidateId: string;
  status?: AssignmentStatus;
  acceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAssignmentStatusHistory = Omit<AssignmentStatusHistory, "createdAt"> & {
  createdAt?: Date;
};

export type MechanicActiveWorkload = {
  mechanicId: string;
  activeAssignmentCount: number;
};

export interface AssignmentRepository {
  setRescueAgreement(input: { id: string; laborQuoteId: string; paymentTiming: RescuePaymentTiming; updatedAt: Date }): Promise<Assignment | undefined>;
  create(input: CreateAssignment): Promise<Assignment>;
  findById(id: string): Promise<Assignment | undefined>;
  findByIdForUpdate(id: string): Promise<Assignment | undefined>;
  findByAcceptedCandidate(candidateId: string): Promise<Assignment | undefined>;
  findActiveByRequestForUpdate(requestId: string): Promise<Assignment | undefined>;
  findActiveByMechanicForUpdate(mechanicId: string): Promise<Assignment | undefined>;
  listActiveWorkloadsByMechanicIds(
    mechanicIds: readonly string[]
  ): Promise<MechanicActiveWorkload[]>;
  listVisibleToActor(actor: {
    id: string;
    roles: AuditActorRole[];
  }): Promise<Assignment[]>;
  updateStatus(input: {
    id: string;
    status: AssignmentStatus;
    updatedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    canceledAt?: Date;
  }): Promise<Assignment | undefined>;
  appendStatusHistory(input: CreateAssignmentStatusHistory): Promise<AssignmentStatusHistory>;
}
