import type { AuditActorRole } from "./audit.repository";
import type { RescuePaymentTiming } from "./quote.repository";
import type { ListFilter, PageCursor } from "@/lib/list-pagination";

export type AssignmentSource = "offer" | "admin_manual" | "admin_reassignment";

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
  acceptedCandidateId?: string;
  source?: AssignmentSource;
  assignedByAdminId?: string;
  supersedesAssignmentId?: string;
  dispatchDistanceMeters?: number;
  scheduledStartAt?: Date;
  reservationStartAt?: Date;
  reservationEndAt?: Date;
  activatedAt?: Date;
  rescueLaborQuoteId?: string;
  rescuePaymentTiming?: RescuePaymentTiming;
  maintenanceLaborQuoteId?: string;
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
  acceptedCandidateId?: string;
  source?: AssignmentSource;
  assignedByAdminId?: string;
  supersedesAssignmentId?: string;
  dispatchDistanceMeters?: number;
  scheduledStartAt?: Date;
  reservationStartAt?: Date;
  reservationEndAt?: Date;
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
  listHistory(id: string, limit: number, cursor?: PageCursor): Promise<AssignmentStatusHistory[]>;
  hasAnyByRequest(requestId: string): Promise<boolean>;
  hasTravelHistory(id: string): Promise<boolean>;
  setReservation(input: { id: string; scheduledStartAt: Date; start: Date; end: Date; updatedAt: Date }): Promise<void>;
  activate(input: { id: string; now: Date }): Promise<void>;
  findReservationConflict(input: { mechanicId: string; start: Date; end: Date; excludeId?: string }): Promise<Assignment | undefined>;
  listReservationConflictMechanicIds(input: { mechanicIds: readonly string[]; start: Date; end: Date }): Promise<string[]>;
  listScheduledForPreparation(input: { now: Date; limit: number }): Promise<Assignment[]>;
  setMaintenanceAgreement(input: { id: string; laborQuoteId: string; updatedAt: Date }): Promise<Assignment | undefined>;
  setRescueAgreement(input: { id: string; laborQuoteId: string; paymentTiming: RescuePaymentTiming; updatedAt: Date }): Promise<Assignment | undefined>;
  create(input: CreateAssignment): Promise<Assignment>;
  findById(id: string): Promise<Assignment | undefined>;
  findByIdForUpdate(id: string): Promise<Assignment | undefined>;
  findCancellationHistory(id: string): Promise<AssignmentStatusHistory | undefined>;
  findByAcceptedCandidate(candidateId: string): Promise<Assignment | undefined>;
  findActiveByRequestForUpdate(requestId: string): Promise<Assignment | undefined>;
  findActiveByMechanicForUpdate(mechanicId: string): Promise<Assignment | undefined>;
  findUnfinishedByMechanicForUpdate(mechanicId: string): Promise<Assignment | undefined>;
  listActiveWorkloadsByMechanicIds(
    mechanicIds: readonly string[]
  ): Promise<MechanicActiveWorkload[]>;
  listVisibleToActor(actor: {
    id: string;
    roles: AuditActorRole[];
  }, input?: ListFilter): Promise<Assignment[]>;
  hasVisibleByRequest(actor: { id: string; roles: AuditActorRole[] }, requestId: string): Promise<boolean>;
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
