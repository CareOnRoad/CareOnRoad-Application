import type { AdminInternalNote } from "./admin-internal-note.repository";
import type { ListFilter } from "@/lib/list-pagination";
import type { StuckCategory } from "@/features/admin/admin-operational-policy";
export type OperationalWindow = { from: Date; to: Date; now: Date };
export type OperationalSummary = Record<string, Record<string, number>>;
export type StuckFinding = { id: string; targetId: string; requestId?: string; assignmentId?: string; category: StuckCategory; createdAt: Date; activeLease: boolean; failureCount?: number };
import type { AssignmentStatus } from "./assignment.repository";
import type {
  DispatchRoundStatus
} from "./dispatch.repository";
import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";
import type { QuoteStatus } from "./quote.repository";
import type {
  FulfillmentMode,
  RequestPriority,
  RequestStatus
} from "./service-request.repository";

export type AdminInternalNoteCursor = {
  createdAt: Date;
  id: string;
};

export type AdminInternalNoteQuery =
  | {
      serviceRequestId: string;
      assignmentId?: never;
      cursor?: AdminInternalNoteCursor;
      limit: number;
    }
  | {
      serviceRequestId?: never;
      assignmentId: string;
      cursor?: AdminInternalNoteCursor;
      limit: number;
    };

export type AdminRequestCursor = {
  timestamp: Date;
  id: string;
};

export type AdminServiceRequestQuery = {
  cursor?: AdminRequestCursor;
  limit: number;
  status?: RequestStatus;
  serviceType?: ServiceType;
  priority?: RequestPriority;
  riderId?: string;
  mechanicId?: string;
  requestCode?: string;
  from?: Date;
  to?: Date;
};

export type AdminServiceRequestSummary = {
  id: string;
  requestCode: string;
  riderId: string;
  motorcycleId: string;
  serviceType: ServiceType;
  fulfillmentMode?: FulfillmentMode;
  status: RequestStatus;
  priority: RequestPriority;
  mechanicId?: string;
  scheduledStartAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminRequestDispatchSummary = {
  roundId: string;
  roundNumber: number;
  status: DispatchRoundStatus;
  startedAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  openCandidateCount: number;
};

export type AdminRequestAssignmentSummary = {
  id: string;
  requestId: string;
  mechanicId: string;
  status: AssignmentStatus;
  acceptedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminRequestQuoteSummary = {
  id: string;
  requestId: string;
  assignmentId: string;
  version: number;
  status: QuoteStatus;
  currency: "VND";
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  expiresAt?: Date;
  createdAt: Date;
  respondedAt?: Date;
};

export type AdminServiceRequestDetail = AdminServiceRequestSummary & {
  dispatch?: AdminRequestDispatchSummary;
  assignment?: AdminRequestAssignmentSummary;
  latestQuote?: AdminRequestQuoteSummary;
  reminder?: {
    reminderId: string;
    occurrenceId?: string;
  };
};

export type AdminRequestTimelineCursor = {
  createdAt: Date;
  id: string;
};

export type AdminRequestTimelineItem =
  | {
      id: string;
      kind: "status";
      fromStatus?: RequestStatus;
      toStatus: RequestStatus;
      actorId?: string;
      reason?: string;
      createdAt: Date;
    }
  | {
      id: string;
      kind: "internal_note";
      adminId: string;
      noteText: string;
      createdAt: Date;
    };

export type AdminRequestMediaSummary = {
  id: string;
  requestId: string;
  mediaType: string;
  contentType: string;
  sizeBytes?: number;
  createdBy: string;
  createdAt: Date;
};

export type AdminQueryPage<T, C> = {
  items: T[];
  nextCursor?: C;
};

export interface AdminQueryRepository {
  operationalSummary(input: OperationalWindow): Promise<OperationalSummary>;
  stuckWorkflows(input: OperationalWindow & ListFilter & { category?: StuckCategory }): Promise<StuckFinding[]>;
  listInternalNotes(input: AdminInternalNoteQuery): Promise<AdminInternalNote[]>;
  listServiceRequests(
    input: AdminServiceRequestQuery
  ): Promise<AdminQueryPage<AdminServiceRequestSummary, AdminRequestCursor>>;
  getServiceRequestDetail(
    requestId: string
  ): Promise<AdminServiceRequestDetail | undefined>;
  listRequestTimeline(input: {
    requestId: string;
    cursor?: AdminRequestTimelineCursor;
    limit: number;
  }): Promise<
    AdminQueryPage<AdminRequestTimelineItem, AdminRequestTimelineCursor>
  >;
  listRequestMedia(input: {
    requestId: string;
    cursor?: AdminRequestCursor;
    limit: number;
  }): Promise<AdminQueryPage<AdminRequestMediaSummary, AdminRequestCursor>>;
  getRequestAssignment(
    requestId: string
  ): Promise<AdminRequestAssignmentSummary | undefined>;
  listRequestQuotes(input: {
    requestId: string;
    cursor?: AdminRequestCursor;
    limit: number;
  }): Promise<AdminQueryPage<AdminRequestQuoteSummary, AdminRequestCursor>>;
}
