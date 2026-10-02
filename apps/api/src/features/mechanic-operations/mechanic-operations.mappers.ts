import { LOCATION_MAX_AGE_SECONDS } from "@/features/motorcycles/mechanic-profile.service";
import { encodeCursor } from "@/lib/list-pagination";
export { encodeCursor, decodeCursor } from "@/lib/list-pagination";
import type {
  MechanicDashboardReadModel,
  MechanicJobSummary,
  MechanicOperationCursor,
  MechanicPerformanceReadModel
} from "@/server/repositories/contracts/mechanic-operations.repository";
import type { MechanicLocationFreshness } from "@/server/repositories/contracts/mechanic.repository";

import type { MechanicNextActionCode } from "./mechanic-operations.schemas";
import { isActiveMechanicJobStatus } from "./mechanic-operations.schemas";

export type MechanicDashboardResponse = {
  availability: {
    profile_status: string;
    is_available: boolean;
  };
  location: {
    freshness: MechanicLocationFreshness;
    updated_at?: string;
  };
  open_offers_count: number;
  active_assignment?: MechanicJobResponse;
  today_counts: {
    accepted_jobs: number;
    completed_jobs: number;
    canceled_jobs: number;
  };
  seven_day_performance: {
    completed_jobs: number;
    canceled_jobs: number;
    acceptance_rate: number;
    decline_rate: number;
    quote_approval_rate: number;
  };
  rating: {
    average: number;
    count: number;
  };
  next_action_codes: MechanicNextActionCode[];
};

export type MechanicJobResponse = {
  assignment_id: string;
  request_id: string;
  status: string;
  accepted_at: string;
  started_at?: string;
  completed_at?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
  request: {
    request_code: string;
    service_type: string;
    status: string;
    priority: string;
    created_at: string;
    scheduled_start_at?: string;
  };
  latest_quote_status?: string;
  next_action_code: MechanicNextActionCode;
};

export type MechanicJobPageResponse = {
  items: MechanicJobResponse[];
  page: {
    limit: number;
    has_more: boolean;
    next_cursor?: string;
  };
};

export type MechanicPerformanceResponse = {
  completed_jobs: number;
  canceled_jobs: number;
  acceptance_rate: number;
  decline_rate: number;
  average_accept_time_seconds?: number;
  average_workflow_duration_seconds?: number;
  quote_approval_rate: number;
  rating: {
    average: number;
    count: number;
  };
};

export function toDashboardResponse(
  model: MechanicDashboardReadModel,
  now: Date
): MechanicDashboardResponse {
  return {
    availability: {
      profile_status: model.profile.profileStatus,
      is_available: model.profile.isAvailable
    },
    location: {
      freshness: locationFreshness(model.profile.locationUpdatedAt, now),
      ...(model.profile.locationUpdatedAt
        ? { updated_at: model.profile.locationUpdatedAt.toISOString() }
        : {})
    },
    open_offers_count: model.openOffersCount,
    ...(model.activeAssignment
      ? { active_assignment: toJobResponse(model.activeAssignment) }
      : {}),
    today_counts: {
      accepted_jobs: model.today.acceptedJobs,
      completed_jobs: model.today.completedJobs,
      canceled_jobs: model.today.canceledJobs
    },
    seven_day_performance: {
      completed_jobs: model.sevenDays.completedJobs,
      canceled_jobs: model.sevenDays.canceledJobs,
      acceptance_rate: rate(
        model.sevenDays.acceptedOffers,
        model.sevenDays.acceptedOffers + model.sevenDays.declinedOffers
      ),
      decline_rate: rate(
        model.sevenDays.declinedOffers,
        model.sevenDays.acceptedOffers + model.sevenDays.declinedOffers
      ),
      quote_approval_rate: rate(
        model.sevenDays.approvedQuotes,
        model.sevenDays.decidedQuotes
      )
    },
    rating: {
      average: model.profile.ratingAvg,
      count: model.profile.ratingCount
    },
    next_action_codes: nextActions(model, now)
  };
}

export function toJobResponse(job: MechanicJobSummary): MechanicJobResponse {
  return {
    assignment_id: job.id,
    request_id: job.requestId,
    status: job.status,
    accepted_at: job.acceptedAt.toISOString(),
    ...(job.startedAt ? { started_at: job.startedAt.toISOString() } : {}),
    ...(job.completedAt ? { completed_at: job.completedAt.toISOString() } : {}),
    ...(job.canceledAt ? { canceled_at: job.canceledAt.toISOString() } : {}),
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt.toISOString(),
    request: {
      request_code: job.request.requestCode,
      service_type: job.request.serviceType,
      status: job.request.status,
      priority: job.request.priority,
      created_at: job.request.createdAt.toISOString(),
      ...(job.request.scheduledStartAt
        ? { scheduled_start_at: job.request.scheduledStartAt.toISOString() }
        : {})
    },
    ...(job.latestQuoteStatus ? { latest_quote_status: job.latestQuoteStatus } : {}),
    next_action_code: nextActionForJob(job)
  };
}

export function toJobPageResponse(
  items: MechanicJobSummary[],
  limit: number,
  nextCursor?: MechanicOperationCursor
): MechanicJobPageResponse {
  return {
    items: items.map(toJobResponse),
    page: {
      limit,
      has_more: Boolean(nextCursor),
      ...(nextCursor ? { next_cursor: encodeCursor(nextCursor) } : {})
    }
  };
}

export function toPerformanceResponse(
  model: MechanicPerformanceReadModel
): MechanicPerformanceResponse {
  return {
    completed_jobs: model.completedJobs,
    canceled_jobs: model.canceledJobs,
    acceptance_rate: rate(
      model.acceptedOffers,
      model.acceptedOffers + model.declinedOffers
    ),
    decline_rate: rate(
      model.declinedOffers,
      model.acceptedOffers + model.declinedOffers
    ),
    ...(model.averageAcceptTimeSeconds !== undefined
      ? { average_accept_time_seconds: model.averageAcceptTimeSeconds }
      : {}),
    ...(model.averageWorkflowDurationSeconds !== undefined
      ? { average_workflow_duration_seconds: model.averageWorkflowDurationSeconds }
      : {}),
    quote_approval_rate: rate(model.approvedQuotes, model.decidedQuotes),
    rating: {
      average: model.ratingAvg,
      count: model.ratingCount
    }
  };
}


function locationFreshness(
  locationUpdatedAt: Date | undefined,
  now: Date
): MechanicLocationFreshness {
  if (!locationUpdatedAt) return "missing";
  return now.getTime() - locationUpdatedAt.getTime() <= LOCATION_MAX_AGE_SECONDS * 1000
    ? "fresh"
    : "stale";
}

function nextActions(
  model: MechanicDashboardReadModel,
  now: Date
): MechanicNextActionCode[] {
  const actions: MechanicNextActionCode[] = [];
  if (!model.profile.isAvailable) actions.push("go_available");
  if (locationFreshness(model.profile.locationUpdatedAt, now) !== "fresh") {
    actions.push("update_location");
  }
  if (model.openOffersCount > 0) actions.push("review_offer");
  if (model.activeAssignment) actions.push("continue_active_job");
  return actions.length > 0 ? actions : ["no_action"];
}

function nextActionForJob(job: MechanicJobSummary): MechanicNextActionCode {
  return isActiveMechanicJobStatus(job.status) ? "continue_active_job" : "no_action";
}

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}
