import {
  ACTIVE_ASSIGNMENT_STATUSES,
  type Assignment,
  type AssignmentStatus
} from "../contracts/assignment.repository";
import type { DispatchCandidate } from "../contracts/dispatch.repository";
import type {
  AssignmentCompletionChecklist,
  AssignmentEtaMetadata,
  AssignmentMediaMetadata,
  CreateAssignmentCompletionChecklist,
  CreateAssignmentEtaMetadata,
  CreateAssignmentMediaMetadata,
  MechanicDashboardReadModel,
  MechanicJobListInput,
  MechanicJobPage,
  MechanicJobSummary,
  MechanicOperationsRepository,
  MechanicPerformanceInput,
  MechanicPerformanceReadModel
} from "../contracts/mechanic-operations.repository";
import type { MechanicProfile } from "../contracts/mechanic.repository";
import type { Quote, QuoteStatus } from "../contracts/quote.repository";
import type { ServiceRequest } from "../contracts/service-request.repository";

export class InMemoryMechanicOperationsRepository implements MechanicOperationsRepository {
  constructor(
    private readonly profiles: MechanicProfile[],
    private readonly candidates: DispatchCandidate[],
    private readonly assignments: Assignment[],
    private readonly requests: ServiceRequest[],
    private readonly quotes: Quote[],
    private readonly etaMetadata: AssignmentEtaMetadata[] = [],
    private readonly mediaMetadata: AssignmentMediaMetadata[] = [],
    private readonly completionChecklists: AssignmentCompletionChecklist[] = []
  ) {}

  async getDashboard(input: {
    mechanicId: string;
    now: Date;
    todayStart: Date;
    sevenDaysStart: Date;
  }): Promise<MechanicDashboardReadModel | undefined> {
    const profile = this.profiles.find((item) => item.userId === input.mechanicId);
    if (!profile) return undefined;
    const mechanicAssignments = this.assignments.filter(
      (assignment) => assignment.mechanicId === input.mechanicId
    );
    return {
      profile: cloneProfile(profile),
      openOffersCount: this.candidates.filter(
        (candidate) =>
          candidate.mechanicId === input.mechanicId &&
          candidate.status === "offered" &&
          candidate.expiresAt !== undefined &&
          candidate.expiresAt > input.now
      ).length,
      activeAssignment: mechanicAssignments
        .filter((assignment) => isActiveStatus(assignment.status))
        .sort(compareAssignmentNewest)[0]
        ? this.toJob(
            mechanicAssignments
              .filter((assignment) => isActiveStatus(assignment.status))
              .sort(compareAssignmentNewest)[0]!
          )
        : undefined,
      today: {
        acceptedJobs: mechanicAssignments.filter(
          (assignment) => assignment.acceptedAt >= input.todayStart
        ).length,
        completedJobs: mechanicAssignments.filter(
          (assignment) =>
            assignment.status === "completed" &&
            assignment.completedAt !== undefined &&
            assignment.completedAt >= input.todayStart
        ).length,
        canceledJobs: mechanicAssignments.filter(
          (assignment) =>
            assignment.status === "canceled" &&
            assignment.canceledAt !== undefined &&
            assignment.canceledAt >= input.todayStart
        ).length
      },
      sevenDays: {
        completedJobs: mechanicAssignments.filter(
          (assignment) =>
            assignment.status === "completed" &&
            assignment.completedAt !== undefined &&
            assignment.completedAt >= input.sevenDaysStart
        ).length,
        canceledJobs: mechanicAssignments.filter(
          (assignment) =>
            assignment.status === "canceled" &&
            assignment.canceledAt !== undefined &&
            assignment.canceledAt >= input.sevenDaysStart
        ).length,
        acceptedOffers: this.offerCount(input.mechanicId, "accepted", input.sevenDaysStart),
        declinedOffers: this.offerCount(input.mechanicId, "rejected", input.sevenDaysStart),
        decidedQuotes: this.quoteDecisionCount(input.mechanicId, input.sevenDaysStart),
        approvedQuotes: this.quoteDecisionCount(input.mechanicId, input.sevenDaysStart, "approved")
      }
    };
  }

  async listJobs(input: MechanicJobListInput): Promise<MechanicJobPage> {
    const filtered = this.assignments
      .filter((assignment) => assignment.mechanicId === input.mechanicId)
      .filter((assignment) => !input.status || assignment.status === input.status)
      .filter((assignment) => !input.activeOnly || isActiveStatus(assignment.status))
      .filter((assignment) => !input.dateFrom || assignment.createdAt >= input.dateFrom)
      .filter((assignment) => !input.dateTo || assignment.createdAt <= input.dateTo)
      .sort(compareAssignmentNewest)
      .filter(
        (assignment) =>
          !input.cursor ||
          compareDateIdDesc(
            assignment.createdAt,
            assignment.id,
            input.cursor.timestamp,
            input.cursor.id
          ) > 0
      );
    const page = filtered.slice(0, input.limit + 1);
    const items = page.slice(0, input.limit).map((assignment) => this.toJob(assignment));
    const last = items.at(-1);
    return {
      items,
      ...(page.length > input.limit && last
        ? { nextCursor: { timestamp: last.createdAt, id: last.id } }
        : {})
    };
  }

  async getPerformance(
    input: MechanicPerformanceInput
  ): Promise<MechanicPerformanceReadModel | undefined> {
    const profile = this.profiles.find((item) => item.userId === input.mechanicId);
    if (!profile) return undefined;
    const assignments = this.assignments
      .filter((assignment) => assignment.mechanicId === input.mechanicId)
      .filter((assignment) => withinRange(assignment.createdAt, input.dateFrom, input.dateTo));
    const acceptedCandidates = this.candidates
      .filter(
        (candidate) =>
          candidate.mechanicId === input.mechanicId && candidate.status === "accepted"
      )
      .filter((candidate) => withinRange(candidate.createdAt, input.dateFrom, input.dateTo));
    const acceptDurations = acceptedCandidates
      .filter((candidate) => candidate.offeredAt && candidate.respondedAt)
      .map((candidate) => secondsBetween(candidate.offeredAt!, candidate.respondedAt!));
    const workflowDurations = assignments
      .filter((assignment) => assignment.status === "completed" && assignment.completedAt)
      .map((assignment) => secondsBetween(assignment.acceptedAt, assignment.completedAt!));
    const decidedQuotes = this.quotesForMechanic(input.mechanicId).filter((quote) =>
      withinRange(quote.createdAt, input.dateFrom, input.dateTo)
    );
    return {
      completedJobs: assignments.filter((assignment) => assignment.status === "completed").length,
      canceledJobs: assignments.filter((assignment) => assignment.status === "canceled").length,
      acceptedOffers: acceptedCandidates.length,
      declinedOffers: this.candidates
        .filter(
          (candidate) =>
            candidate.mechanicId === input.mechanicId && candidate.status === "rejected"
        )
        .filter((candidate) => withinRange(candidate.createdAt, input.dateFrom, input.dateTo))
        .length,
      averageAcceptTimeSeconds: average(acceptDurations),
      averageWorkflowDurationSeconds: average(workflowDurations),
      decidedQuotes: decidedQuotes.filter((quote) => quote.status !== "pending").length,
      approvedQuotes: decidedQuotes.filter((quote) => quote.status === "approved").length,
      ratingAvg: profile.ratingAvg,
      ratingCount: profile.ratingCount
    };
  }

  async findOwnedAssignmentForUpdate(input: {
    assignmentId: string;
    mechanicId: string;
  }): Promise<Assignment | undefined> {
    const assignment = this.assignments.find(
      (item) => item.id === input.assignmentId && item.mechanicId === input.mechanicId
    );
    return assignment ? cloneAssignment(assignment) : undefined;
  }

  async createAssignmentEtaMetadata(
    input: CreateAssignmentEtaMetadata
  ): Promise<AssignmentEtaMetadata> {
    const record: AssignmentEtaMetadata = cloneEtaMetadata(input);
    this.etaMetadata.push(record);
    return cloneEtaMetadata(record);
  }

  async listAssignmentEtaMetadata(assignmentId: string): Promise<AssignmentEtaMetadata[]> {
    return this.etaMetadata
      .filter((item) => item.assignmentId === assignmentId)
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id)
      )
      .map(cloneEtaMetadata);
  }

  async createAssignmentMediaMetadata(
    input: CreateAssignmentMediaMetadata
  ): Promise<AssignmentMediaMetadata> {
    if (
      this.mediaMetadata.some(
        (item) =>
          item.assignmentId === input.assignmentId &&
          item.mediaReference === input.mediaReference
      )
    ) {
      throw new Error("duplicate assignment media metadata");
    }
    const record: AssignmentMediaMetadata = cloneMediaMetadata(input);
    this.mediaMetadata.push(record);
    return cloneMediaMetadata(record);
  }

  async listAssignmentMediaMetadata(assignmentId: string): Promise<AssignmentMediaMetadata[]> {
    return this.mediaMetadata
      .filter((item) => item.assignmentId === assignmentId)
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id)
      )
      .map(cloneMediaMetadata);
  }

  async createAssignmentCompletionChecklist(
    input: CreateAssignmentCompletionChecklist
  ): Promise<AssignmentCompletionChecklist> {
    const revision =
      Math.max(
        0,
        ...this.completionChecklists
          .filter((item) => item.assignmentId === input.assignmentId)
          .map((item) => item.revision)
      ) + 1;
    const record: AssignmentCompletionChecklist = cloneCompletionChecklist({
      ...input,
      revision
    });
    this.completionChecklists.push(record);
    return cloneCompletionChecklist(record);
  }

  async getLatestAssignmentCompletionChecklist(
    assignmentId: string
  ): Promise<AssignmentCompletionChecklist | undefined> {
    const latest = this.completionChecklists
      .filter((item) => item.assignmentId === assignmentId)
      .sort(
        (left, right) =>
          right.revision - left.revision ||
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id)
      )[0];
    return latest ? cloneCompletionChecklist(latest) : undefined;
  }

  private toJob(assignment: Assignment): MechanicJobSummary {
    const request = this.requests.find((item) => item.id === assignment.requestId);
    if (!request) {
      throw new Error("Mechanic operation fixture is missing service request.");
    }
    const latestQuote = this.quotes
      .filter((quote) => quote.requestId === request.id)
      .sort((left, right) => right.version - left.version)[0];
    return {
      ...cloneAssignment(assignment),
      request: {
        id: request.id,
        requestCode: request.requestCode,
        serviceType: request.serviceType,
        status: request.status,
        priority: request.priority,
        createdAt: new Date(request.createdAt),
        scheduledStartAt: request.scheduledStartAt
          ? new Date(request.scheduledStartAt)
          : undefined
      },
      latestQuoteStatus: latestQuote?.status
    };
  }

  private offerCount(mechanicId: string, status: "accepted" | "rejected", from: Date) {
    return this.candidates.filter(
      (candidate) =>
        candidate.mechanicId === mechanicId &&
        candidate.status === status &&
        candidate.createdAt >= from
    ).length;
  }

  private quoteDecisionCount(mechanicId: string, from: Date, status?: QuoteStatus) {
    return this.quotesForMechanic(mechanicId).filter(
      (quote) =>
        quote.createdAt >= from &&
        quote.status !== "pending" &&
        (!status || quote.status === status)
    ).length;
  }

  private quotesForMechanic(mechanicId: string) {
    const assignmentIds = new Set(
      this.assignments
        .filter((assignment) => assignment.mechanicId === mechanicId)
        .map((assignment) => assignment.id)
    );
    return this.quotes.filter((quote) => assignmentIds.has(quote.assignmentId));
  }
}

function isActiveStatus(status: AssignmentStatus): boolean {
  return ACTIVE_ASSIGNMENT_STATUSES.includes(
    status as (typeof ACTIVE_ASSIGNMENT_STATUSES)[number]
  );
}

function withinRange(value: Date, from?: Date, to?: Date): boolean {
  return (!from || value >= from) && (!to || value <= to);
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function compareAssignmentNewest(left: Assignment, right: Assignment): number {
  return compareDateIdDesc(left.createdAt, left.id, right.createdAt, right.id);
}

function compareDateIdDesc(
  leftDate: Date,
  leftId: string,
  rightDate: Date,
  rightId: string
): number {
  return rightDate.getTime() - leftDate.getTime() || rightId.localeCompare(leftId);
}

function cloneProfile(profile: MechanicProfile): MechanicProfile {
  return {
    ...profile,
    latestLocation: profile.latestLocation ? { ...profile.latestLocation } : undefined,
    locationUpdatedAt: profile.locationUpdatedAt ? new Date(profile.locationUpdatedAt) : undefined,
    availabilityUpdatedAt: new Date(profile.availabilityUpdatedAt),
    serviceTypes: [...profile.serviceTypes],
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt)
  };
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

function cloneEtaMetadata(record: AssignmentEtaMetadata): AssignmentEtaMetadata {
  return {
    ...record,
    etaAt: record.etaAt ? new Date(record.etaAt) : undefined,
    createdAt: new Date(record.createdAt)
  };
}

function cloneMediaMetadata(record: AssignmentMediaMetadata): AssignmentMediaMetadata {
  return {
    ...record,
    createdAt: new Date(record.createdAt)
  };
}

function cloneCompletionChecklist(
  record: AssignmentCompletionChecklist
): AssignmentCompletionChecklist {
  return {
    ...record,
    safetyChecklist: { ...record.safetyChecklist },
    createdAt: new Date(record.createdAt)
  };
}
