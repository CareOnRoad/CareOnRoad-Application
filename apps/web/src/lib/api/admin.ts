import "server-only";

import { z } from "zod";

import { ADMIN_PAGE_DEFAULT_LIMIT } from "@careonroad/api-contract/common";
import {
  adminUserActivityListResponseSchema,
  adminUserDeviceListResponseSchema,
  adminUserListResponseSchema
} from "@careonroad/api-contract/admin/users";
import {
  adminMechanicListResponseSchema,
  adminMechanicWorkHistoryListResponseSchema,
  adminMechanicPerformanceSchema
} from "@careonroad/api-contract/admin/mechanics";
import {
  adminRequestListResponseSchema,
  adminRequestTimelineResponseSchema,
  adminRequestMediaListResponseSchema,
  adminRequestAssignmentSchema,
  adminRequestQuoteSchema,
  adminRequestDetailSchema
} from "@careonroad/api-contract/admin/service-requests";
import {
  operationalQueueListResponseSchema,
  type OperationalQueue,
  type OperationalQueueListResponse
} from "@careonroad/api-contract/admin/operations";
import {
  healthLivenessResponseSchema,
  healthReadinessResponseSchema
} from "@careonroad/api-contract/health";

import { apiFetch, buildQuery } from "./server-client";

/**
 * Typed wrappers for the admin read routes.
 *
 * One function per screen, no generic path strings at the call site â€” a typo
 * becomes a type error instead of a 404 at runtime. Every path below was read
 * from the backend route files under `apps/api/app/api/v1/admin`.
 *
 * Mutations are intentionally absent: this file is read-only, so no page can
 * call a mutating route without a deliberate new function that also handles
 * the required `X-Idempotency-Key` and `reason`.
 */

type Session = { accessToken: string };

type ListQuery = {
  cursor?: string;
  limit?: number;
};

const defaultLimit = (query: ListQuery) => query.limit ?? ADMIN_PAGE_DEFAULT_LIMIT;

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export function fetchAdminUsers(
  session: Session,
  query: ListQuery & { q?: string; role?: string; status?: string } = {}
) {
  return apiFetch<z.infer<typeof adminUserListResponseSchema>>(
    `/api/v1/admin/users${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      query: query.q,
      role: query.role,
      status: query.status
    })}`,
    { accessToken: session.accessToken, schema: adminUserListResponseSchema }
  );
}

export function fetchAdminUserDevices(
  session: Session,
  userId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminUserDeviceListResponseSchema>>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/devices${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminUserDeviceListResponseSchema }
  );
}

export function fetchAdminUserActivity(
  session: Session,
  userId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminUserActivityListResponseSchema>>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/activity${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminUserActivityListResponseSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Mechanics                                                                   */
/* -------------------------------------------------------------------------- */

export function fetchAdminMechanics(
  session: Session,
  query: ListQuery & { q?: string; profile_status?: string; skill?: string } = {}
) {
  return apiFetch<z.infer<typeof adminMechanicListResponseSchema>>(
    `/api/v1/admin/mechanics${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      query: query.q,
      profile_status: query.profile_status,
      skill: query.skill
    })}`,
    { accessToken: session.accessToken, schema: adminMechanicListResponseSchema }
  );
}

export function fetchAdminMechanicWorkHistory(
  session: Session,
  mechanicId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminMechanicWorkHistoryListResponseSchema>>(
    `/api/v1/admin/mechanics/${encodeURIComponent(mechanicId)}/work-history${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminMechanicWorkHistoryListResponseSchema }
  );
}

export function fetchAdminMechanicPerformance(session: Session, mechanicId: string) {
  return apiFetch<z.infer<typeof adminMechanicPerformanceSchema>>(
    `/api/v1/admin/mechanics/${encodeURIComponent(mechanicId)}/performance`,
    { accessToken: session.accessToken, schema: adminMechanicPerformanceSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Service requests                                                            */
/* -------------------------------------------------------------------------- */

export function fetchAdminServiceRequests(
  session: Session,
  query: ListQuery & { status?: string; q?: string } = {}
) {
  return apiFetch<z.infer<typeof adminRequestListResponseSchema>>(
    `/api/v1/admin/service-requests${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      status: query.status,
      query: query.q
    })}`,
    { accessToken: session.accessToken, schema: adminRequestListResponseSchema }
  );
}

export function fetchAdminServiceRequestDetail(session: Session, requestId: string) {
  return apiFetch<z.infer<typeof adminRequestDetailSchema>>(
    `/api/v1/admin/service-requests/${encodeURIComponent(requestId)}`,
    { accessToken: session.accessToken, schema: adminRequestDetailSchema }
  );
}

export function fetchAdminServiceRequestTimeline(
  session: Session,
  requestId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminRequestTimelineResponseSchema>>(
    `/api/v1/admin/service-requests/${encodeURIComponent(requestId)}/timeline${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminRequestTimelineResponseSchema }
  );
}

export function fetchAdminServiceRequestMedia(
  session: Session,
  requestId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminRequestMediaListResponseSchema>>(
    `/api/v1/admin/service-requests/${encodeURIComponent(requestId)}/media${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminRequestMediaListResponseSchema }
  );
}

export function fetchAdminServiceRequestAssignment(session: Session, requestId: string) {
  return apiFetch<z.infer<typeof adminRequestAssignmentSchema>>(
    `/api/v1/admin/service-requests/${encodeURIComponent(requestId)}/assignment`,
    { accessToken: session.accessToken, schema: adminRequestAssignmentSchema }
  );
}

export function fetchAdminServiceRequestQuotes(
  session: Session,
  requestId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminRequestQuoteSchema>[]>(
    `/api/v1/admin/service-requests/${encodeURIComponent(requestId)}/quotes${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: z.array(adminRequestQuoteSchema) }
  );
}

/* -------------------------------------------------------------------------- */
/* Operations monitoring                                                       */
/* -------------------------------------------------------------------------- */

export function fetchOperationalQueue(
  session: Session,
  queue: OperationalQueue,
  query: ListQuery = {}
): Promise<OperationalQueueListResponse> {
  return apiFetch<OperationalQueueListResponse>(
    `/api/v1/admin/operations/${queue}${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: operationalQueueListResponseSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Health â€” public, no session required                                        */
/* -------------------------------------------------------------------------- */

export function fetchLiveness() {
  return apiFetch(`/api/v1/internal/health/live`, {
    accessToken: "",
    schema: healthLivenessResponseSchema
  });
}

export function fetchReadiness() {
  return apiFetch(`/api/v1/internal/health/ready`, {
    accessToken: "",
    schema: healthReadinessResponseSchema
  });
}

