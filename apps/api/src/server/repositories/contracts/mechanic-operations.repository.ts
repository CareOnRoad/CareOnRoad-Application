import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";

import type { Assignment, AssignmentStatus } from "./assignment.repository";
import type { MechanicProfile } from "./mechanic.repository";
import type { QuoteStatus } from "./quote.repository";
import type { RequestPriority, RequestStatus } from "./service-request.repository";

export type MechanicOperationCursor = {
  timestamp: Date;
  id: string;
};

export type MechanicSafeRequestContext = {
  id: string;
  requestCode: string;
  serviceType: ServiceType;
  status: RequestStatus;
  priority: RequestPriority;
  createdAt: Date;
  scheduledStartAt?: Date;
};

export type MechanicJobSummary = {
  id: string;
  requestId: string;
  status: AssignmentStatus;
  acceptedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  request: MechanicSafeRequestContext;
  latestQuoteStatus?: QuoteStatus;
};

export type MechanicDashboardReadModel = {
  profile: MechanicProfile;
  openOffersCount: number;
  activeAssignment?: MechanicJobSummary;
  today: {
    acceptedJobs: number;
    completedJobs: number;
    canceledJobs: number;
  };
  sevenDays: {
    completedJobs: number;
    canceledJobs: number;
    acceptedOffers: number;
    declinedOffers: number;
    decidedQuotes: number;
    approvedQuotes: number;
  };
};

export type MechanicJobListInput = {
  mechanicId: string;
  limit: number;
  cursor?: MechanicOperationCursor;
  status?: AssignmentStatus;
  activeOnly?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
};

export type MechanicJobPage = {
  items: MechanicJobSummary[];
  nextCursor?: MechanicOperationCursor;
};

export type MechanicPerformanceInput = {
  mechanicId: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export type MechanicPerformanceReadModel = {
  completedJobs: number;
  canceledJobs: number;
  acceptedOffers: number;
  declinedOffers: number;
  averageAcceptTimeSeconds?: number;
  averageWorkflowDurationSeconds?: number;
  decidedQuotes: number;
  approvedQuotes: number;
  ratingAvg: number;
  ratingCount: number;
};

export type AssignmentEtaMetadata = {
  id: string;
  assignmentId: string;
  requestId: string;
  mechanicId: string;
  etaAt?: Date;
  delayReason?: string;
  createdBy: string;
  createdAt: Date;
};

export type AssignmentMediaPurpose = "diagnosis" | "work_proof" | "safety" | "other";

export type AssignmentMediaMetadata = {
  id: string;
  assignmentId: string;
  requestId: string;
  mechanicId: string;
  purpose: AssignmentMediaPurpose;
  mediaReference: string;
  contentType: string;
  sizeBytes: number;
  checksum?: string;
  createdBy: string;
  createdAt: Date;
};

export type AssignmentSafetyChecklist = {
  testRideCompleted: boolean;
  toolsRemoved: boolean;
  areaSafe: boolean;
  riderBriefed: boolean;
  noFluidLeak: boolean;
};

export type AssignmentCompletionChecklist = {
  id: string;
  assignmentId: string;
  requestId: string;
  mechanicId: string;
  revision: number;
  approvedQuoteId?: string;
  workSummary: string;
  safetyChecklist: AssignmentSafetyChecklist;
  notes?: string;
  createdBy: string;
  createdAt: Date;
};

export type CreateAssignmentEtaMetadata = {
  id: string;
  assignmentId: string;
  requestId: string;
  mechanicId: string;
  etaAt?: Date;
  delayReason?: string;
  createdBy: string;
  createdAt: Date;
};

export type CreateAssignmentMediaMetadata = {
  id: string;
  assignmentId: string;
  requestId: string;
  mechanicId: string;
  purpose: AssignmentMediaPurpose;
  mediaReference: string;
  contentType: string;
  sizeBytes: number;
  checksum?: string;
  createdBy: string;
  createdAt: Date;
};

export type CreateAssignmentCompletionChecklist = {
  id: string;
  assignmentId: string;
  requestId: string;
  mechanicId: string;
  approvedQuoteId?: string;
  workSummary: string;
  safetyChecklist: AssignmentSafetyChecklist;
  notes?: string;
  createdBy: string;
  createdAt: Date;
};

export interface MechanicOperationsRepository {
  getDashboard(input: {
    mechanicId: string;
    now: Date;
    todayStart: Date;
    sevenDaysStart: Date;
  }): Promise<MechanicDashboardReadModel | undefined>;
  listJobs(input: MechanicJobListInput): Promise<MechanicJobPage>;
  getPerformance(
    input: MechanicPerformanceInput
  ): Promise<MechanicPerformanceReadModel | undefined>;
  findOwnedAssignmentForUpdate(input: {
    assignmentId: string;
    mechanicId: string;
  }): Promise<Assignment | undefined>;
  createAssignmentEtaMetadata(
    input: CreateAssignmentEtaMetadata
  ): Promise<AssignmentEtaMetadata>;
  listAssignmentEtaMetadata(assignmentId: string): Promise<AssignmentEtaMetadata[]>;
  createAssignmentMediaMetadata(
    input: CreateAssignmentMediaMetadata
  ): Promise<AssignmentMediaMetadata>;
  listAssignmentMediaMetadata(assignmentId: string): Promise<AssignmentMediaMetadata[]>;
  createAssignmentCompletionChecklist(
    input: CreateAssignmentCompletionChecklist
  ): Promise<AssignmentCompletionChecklist>;
  getLatestAssignmentCompletionChecklist(
    assignmentId: string
  ): Promise<AssignmentCompletionChecklist | undefined>;
}
