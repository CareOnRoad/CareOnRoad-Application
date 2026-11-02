import "server-only";

import { z } from "zod";

import { ADMIN_PAGE_DEFAULT_LIMIT } from "@careonroad/api-contract/common";
import {
  adminUserActivityListResponseSchema,
  adminUserDeviceListResponseSchema,
  adminUserListResponseSchema,
  adminUserSummarySchema
} from "@careonroad/api-contract/admin/users";
import {
  adminMechanicListResponseSchema,
  adminMechanicWorkHistoryListResponseSchema,
  adminMechanicPerformanceSchema,
  adminMechanicSummarySchema
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
  adminDashboardSummarySchema,
  adminStuckWorkflowsResponseSchema,
  adminDashboardPageSchema
} from "@careonroad/api-contract/admin/dashboard";
import {
  adminAssignmentDetailSchema,
  adminAssignmentTimelineResponseSchema,
  adminAssignmentDiagnosisSchema
} from "@careonroad/api-contract/admin/assignments";
import {
  adminQuoteListResponseSchema,
  adminQuoteDetailSchema,
  adminQuoteSupervisionListResponseSchema
} from "@careonroad/api-contract/admin/quotes";
import {
  adminDispatchStatusSchema,
  adminDispatchRoundsSchema,
  adminDispatchEligibilitySchema,
  adminDispatchRoundDetailSchema
} from "@careonroad/api-contract/admin/dispatch";
import {
  adminNotificationListResponseSchema,
  adminNotificationDetailSchema,
  adminNotificationDeliverySummarySchema,
  adminOutboxListResponseSchema,
  adminOutboxEventSchema,
  adminWorkerHealthResponseSchema
} from "@careonroad/api-contract/admin/delivery";
import {
  adminReminderListResponseSchema,
  adminReminderRuleSchema,
  adminReminderOccurrenceListResponseSchema,
  adminReminderHealthResponseSchema
} from "@careonroad/api-contract/admin/reminders";
import {
  adminAuditListResponseSchema,
  adminAuditExportResponseSchema,
  adminAuditRowSchema
} from "@careonroad/api-contract/admin/audit";
import {
  adminConfigurationSchema,
  adminProviderBudgetsSchema
} from "@careonroad/api-contract/admin/configuration";
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
 * One function per screen, no generic path strings at the call site — a typo
 * becomes a type error instead of a 404 at runtime. Every path below was read
 * from the backend route files under `apps/api/app/api/v1/admin`.
 *
 * Mutations are intentionally absent: this file is read-only, so no page can
 * call a mutating route without a deliberate new function that also handles
 * the required `X-Idempotency-Key` and `reason`. See `admin-commands.ts` for
 * the mutation side and `admin-command-runner.ts` for the shared runner.
 */

type Session = { accessToken: string };

type ListQuery = {
  cursor?: string;
  limit?: number;
};

const defaultLimit = (query: ListQuery) => query.limit ?? ADMIN_PAGE_DEFAULT_LIMIT;

const enc = encodeURIComponent;

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export function fetchAdminUsers(
  session: Session,
  query: ListQuery & {
    query?: string;
    role?: string;
    status?: string;
    from?: string;
    to?: string;
  } = {}
) {
  return apiFetch<z.infer<typeof adminUserListResponseSchema>>(
    `/api/v1/admin/users${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      query: query.query,
      role: query.role,
      status: query.status,
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminUserListResponseSchema }
  );
}

export function fetchAdminUser(session: Session, userId: string) {
  return apiFetch<z.infer<typeof adminUserSummarySchema>>(
    `/api/v1/admin/users/${enc(userId)}`,
    { accessToken: session.accessToken, schema: adminUserSummarySchema }
  );
}

export function fetchAdminUserDevices(
  session: Session,
  userId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminUserDeviceListResponseSchema>>(
    `/api/v1/admin/users/${enc(userId)}/devices${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminUserDeviceListResponseSchema }
  );
}

export function fetchAdminUserActivity(
  session: Session,
  userId: string,
  query: ListQuery & { from?: string; to?: string } = {}
) {
  return apiFetch<z.infer<typeof adminUserActivityListResponseSchema>>(
    `/api/v1/admin/users/${enc(userId)}/activity${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminUserActivityListResponseSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Mechanics                                                                   */
/* -------------------------------------------------------------------------- */

export function fetchAdminMechanics(
  session: Session,
  query: ListQuery & {
    profile_status?: string;
    service_type?: string;
    is_available?: boolean;
    location_freshness?: string;
    work_state?: string;
  } = {}
) {
  return apiFetch<z.infer<typeof adminMechanicListResponseSchema>>(
    `/api/v1/admin/mechanics${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      profile_status: query.profile_status,
      service_type: query.service_type,
      is_available: query.is_available,
      location_freshness: query.location_freshness,
      work_state: query.work_state
    })}`,
    { accessToken: session.accessToken, schema: adminMechanicListResponseSchema }
  );
}

export function fetchAdminMechanic(session: Session, mechanicId: string) {
  return apiFetch<z.infer<typeof adminMechanicSummarySchema>>(
    `/api/v1/admin/mechanics/${enc(mechanicId)}`,
    { accessToken: session.accessToken, schema: adminMechanicSummarySchema }
  );
}

export function fetchAdminMechanicWorkHistory(
  session: Session,
  mechanicId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminMechanicWorkHistoryListResponseSchema>>(
    `/api/v1/admin/mechanics/${enc(mechanicId)}/work-history${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminMechanicWorkHistoryListResponseSchema }
  );
}

export function fetchAdminMechanicPerformance(session: Session, mechanicId: string) {
  return apiFetch<z.infer<typeof adminMechanicPerformanceSchema>>(
    `/api/v1/admin/mechanics/${enc(mechanicId)}/performance`,
    { accessToken: session.accessToken, schema: adminMechanicPerformanceSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Service requests                                                            */
/* -------------------------------------------------------------------------- */

export function fetchAdminServiceRequests(
  session: Session,
  query: ListQuery & {
    status?: string;
    service_type?: string;
    priority?: string;
    rider_id?: string;
    mechanic_id?: string;
    request_code?: string;
    from?: string;
    to?: string;
  } = {}
) {
  return apiFetch<z.infer<typeof adminRequestListResponseSchema>>(
    `/api/v1/admin/service-requests${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      status: query.status,
      service_type: query.service_type,
      priority: query.priority,
      rider_id: query.rider_id,
      mechanic_id: query.mechanic_id,
      request_code: query.request_code,
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminRequestListResponseSchema }
  );
}

export function fetchAdminServiceRequestDetail(session: Session, requestId: string) {
  return apiFetch<z.infer<typeof adminRequestDetailSchema>>(
    `/api/v1/admin/service-requests/${enc(requestId)}`,
    { accessToken: session.accessToken, schema: adminRequestDetailSchema }
  );
}

export function fetchAdminServiceRequestTimeline(
  session: Session,
  requestId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminRequestTimelineResponseSchema>>(
    `/api/v1/admin/service-requests/${enc(requestId)}/timeline${buildQuery({
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
    `/api/v1/admin/service-requests/${enc(requestId)}/media${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminRequestMediaListResponseSchema }
  );
}

export function fetchAdminServiceRequestAssignment(session: Session, requestId: string) {
  return apiFetch<z.infer<typeof adminRequestAssignmentSchema>>(
    `/api/v1/admin/service-requests/${enc(requestId)}/assignment`,
    { accessToken: session.accessToken, schema: adminRequestAssignmentSchema }
  );
}

/**
 * The quotes of a request.
 *
 * The backend returns a cursor page envelope (`{ items, page }`), NOT a bare
 * array — the previous version of this wrapper expected an array and would
 * have failed contract validation on every call.
 *
 * NOTE the item shape: `/service-requests/[requestId]/quotes` returns the
 * request-quote summary (`AdminRequestQuoteResponse`), while
 * `/quotes/history` returns the supervision quote shape (`safeQuote`), which
 * carries `purpose` and `line_count` instead of the amount breakdown. They
 * are genuinely different and must not be merged.
 */
export function fetchAdminServiceRequestQuotes(
  session: Session,
  requestId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminRequestQuoteListSchema>>(
    `/api/v1/admin/service-requests/${enc(requestId)}/quotes${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminRequestQuoteListSchema }
  );
}

/** The quote history of a request (`/quotes/history`). */
export function fetchAdminServiceRequestQuoteHistory(
  session: Session,
  requestId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminQuoteListResponseSchema>>(
    `/api/v1/admin/service-requests/${enc(requestId)}/quotes/history${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminQuoteListResponseSchema }
  );
}

/** The admin supervision action log of a request. */
export function fetchAdminServiceRequestSupervisionActions(
  session: Session,
  requestId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminQuoteSupervisionListResponseSchema>>(
    `/api/v1/admin/service-requests/${enc(requestId)}/supervision-actions${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminQuoteSupervisionListResponseSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Dispatch (per request)                                                      */
/* -------------------------------------------------------------------------- */

export function fetchAdminDispatchStatus(session: Session, requestId: string) {
  return apiFetch<z.infer<typeof adminDispatchStatusSchema>>(
    `/api/v1/admin/service-requests/${enc(requestId)}/dispatch`,
    { accessToken: session.accessToken, schema: adminDispatchStatusSchema }
  );
}

export function fetchAdminDispatchRounds(
  session: Session,
  requestId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminDispatchRoundsSchema>>(
    `/api/v1/admin/service-requests/${enc(requestId)}/dispatch/rounds${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminDispatchRoundsSchema }
  );
}

export function fetchAdminDispatchEligibleMechanics(
  session: Session,
  requestId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminDispatchEligibilitySchema>>(
    `/api/v1/admin/service-requests/${enc(requestId)}/dispatch/eligible-mechanics${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminDispatchEligibilitySchema }
  );
}

export function fetchAdminDispatchExplanation(
  session: Session,
  requestId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminDispatchEligibilitySchema>>(
    `/api/v1/admin/service-requests/${enc(requestId)}/dispatch/explanation${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminDispatchEligibilitySchema }
  );
}

export function fetchAdminDispatchRound(session: Session, roundId: string) {
  return apiFetch<z.infer<typeof adminDispatchRoundDetailSchema>>(
    `/api/v1/admin/dispatch/rounds/${enc(roundId)}`,
    { accessToken: session.accessToken, schema: adminDispatchRoundDetailSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Assignments                                                                 */
/* -------------------------------------------------------------------------- */

export function fetchAdminAssignment(session: Session, assignmentId: string) {
  return apiFetch<z.infer<typeof adminAssignmentDetailSchema>>(
    `/api/v1/admin/assignments/${enc(assignmentId)}`,
    { accessToken: session.accessToken, schema: adminAssignmentDetailSchema }
  );
}

export function fetchAdminAssignmentTimeline(
  session: Session,
  assignmentId: string,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminAssignmentTimelineResponseSchema>>(
    `/api/v1/admin/assignments/${enc(assignmentId)}/timeline${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminAssignmentTimelineResponseSchema }
  );
}

/** The mechanic diagnosis of an assignment, with its audit + supervision logs. */
export function fetchAdminAssignmentDiagnosis(session: Session, assignmentId: string) {
  return apiFetch<z.infer<typeof adminAssignmentDiagnosisSchema>>(
    `/api/v1/admin/assignments/${enc(assignmentId)}/diagnosis`,
    { accessToken: session.accessToken, schema: adminAssignmentDiagnosisSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Quotes                                                                      */
/* -------------------------------------------------------------------------- */

export function fetchAdminQuote(session: Session, quoteId: string) {
  return apiFetch<z.infer<typeof adminQuoteDetailSchema>>(
    `/api/v1/admin/quotes/${enc(quoteId)}`,
    { accessToken: session.accessToken, schema: adminQuoteDetailSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

export type AdminDashboardView =
  | "summary"
  | "dispatch"
  | "assignments"
  | "mechanics"
  | "service-requests"
  | "workers";

export function fetchAdminDashboard(
  session: Session,
  view: AdminDashboardView,
  query: { from?: string; to?: string } = {}
) {
  return apiFetch<z.infer<typeof adminDashboardSummarySchema>>(
    `/api/v1/admin/dashboard/${view}${buildQuery({
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminDashboardPageSchema }
  );
}

export function fetchAdminStuckWorkflows(
  session: Session,
  query: ListQuery & { from?: string; to?: string; category?: string } = {}
) {
  return apiFetch<z.infer<typeof adminStuckWorkflowsResponseSchema>>(
    `/api/v1/admin/dashboard/stuck-workflows${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      from: query.from,
      to: query.to,
      category: query.category
    })}`,
    { accessToken: session.accessToken, schema: adminStuckWorkflowsResponseSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Reminders                                                                   */
/* -------------------------------------------------------------------------- */

export function fetchAdminReminders(
  session: Session,
  query: ListQuery & {
    rider_id?: string;
    enabled?: boolean;
    from?: string;
    to?: string;
  } = {}
) {
  return apiFetch<z.infer<typeof adminReminderListResponseSchema>>(
    `/api/v1/admin/reminders${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      rider_id: query.rider_id,
      enabled: query.enabled,
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminReminderListResponseSchema }
  );
}

export function fetchAdminReminder(session: Session, reminderId: string) {
  return apiFetch<z.infer<typeof adminReminderRuleSchema>>(
    `/api/v1/admin/reminders/${enc(reminderId)}`,
    { accessToken: session.accessToken, schema: adminReminderRuleSchema }
  );
}

export function fetchAdminReminderOccurrences(
  session: Session,
  reminderId: string,
  query: ListQuery & { status?: string; from?: string; to?: string } = {}
) {
  return apiFetch<z.infer<typeof adminReminderOccurrenceListResponseSchema>>(
    `/api/v1/admin/reminders/${enc(reminderId)}/occurrences${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      status: query.status,
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminReminderOccurrenceListResponseSchema }
  );
}

export function fetchAdminReminderWorkerHealth(
  session: Session,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminReminderHealthResponseSchema>>(
    `/api/v1/admin/reminders/worker-health${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminReminderHealthResponseSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export function fetchAdminNotifications(
  session: Session,
  query: ListQuery & { status?: string; user_id?: string; from?: string; to?: string } = {}
) {
  return apiFetch<z.infer<typeof adminNotificationListResponseSchema>>(
    `/api/v1/admin/notifications${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      status: query.status,
      user_id: query.user_id,
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminNotificationListResponseSchema }
  );
}

export function fetchAdminNotification(session: Session, notificationId: string) {
  return apiFetch<z.infer<typeof adminNotificationDetailSchema>>(
    `/api/v1/admin/notifications/${enc(notificationId)}`,
    { accessToken: session.accessToken, schema: adminNotificationDetailSchema }
  );
}

export function fetchAdminNotificationDeliverySummary(
  session: Session,
  query: { from?: string; to?: string } = {}
) {
  return apiFetch<z.infer<typeof adminNotificationDeliverySummarySchema>>(
    `/api/v1/admin/notifications/delivery-summary${buildQuery({
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminNotificationDeliverySummarySchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Outbox                                                                      */
/* -------------------------------------------------------------------------- */

export function fetchAdminOutbox(
  session: Session,
  query: ListQuery & { status?: string; topic?: string; from?: string; to?: string } = {}
) {
  return apiFetch<z.infer<typeof adminOutboxListResponseSchema>>(
    `/api/v1/admin/outbox${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      status: query.status,
      topic: query.topic,
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminOutboxListResponseSchema }
  );
}

export function fetchAdminOutboxDeadLetters(
  session: Session,
  query: ListQuery & { topic?: string; from?: string; to?: string } = {}
) {
  return apiFetch<z.infer<typeof adminOutboxListResponseSchema>>(
    `/api/v1/admin/outbox/dead-letter${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      topic: query.topic,
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminOutboxListResponseSchema }
  );
}

export function fetchAdminOutboxEvent(session: Session, eventId: string) {
  return apiFetch<z.infer<typeof adminOutboxEventSchema>>(
    `/api/v1/admin/outbox/${enc(eventId)}`,
    { accessToken: session.accessToken, schema: adminOutboxEventSchema }
  );
}

export function fetchAdminOutboxWorkerHealth(
  session: Session,
  query: ListQuery = {}
) {
  return apiFetch<z.infer<typeof adminWorkerHealthResponseSchema>>(
    `/api/v1/admin/outbox/worker-health${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query)
    })}`,
    { accessToken: session.accessToken, schema: adminWorkerHealthResponseSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                       */
/* -------------------------------------------------------------------------- */

export function fetchAdminAudit(
  session: Session,
  query: ListQuery & {
    actor_id?: string;
    entity_type?: string;
    entity_id?: string;
    action?: string;
    from?: string;
    to?: string;
  } = {}
) {
  return apiFetch<z.infer<typeof adminAuditListResponseSchema>>(
    `/api/v1/admin/audit${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      actor_id: query.actor_id,
      entity_type: query.entity_type,
      entity_id: query.entity_id,
      action: query.action,
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminAuditListResponseSchema }
  );
}

export function fetchAdminAuditActor(
  session: Session,
  actorId: string,
  query: ListQuery & { from?: string; to?: string } = {}
) {
  return apiFetch<z.infer<typeof adminAuditListResponseSchema>>(
    `/api/v1/admin/audit/actors/${enc(actorId)}${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminAuditListResponseSchema }
  );
}

export function fetchAdminAuditEntity(
  session: Session,
  entityType: string,
  entityId: string,
  query: ListQuery & { from?: string; to?: string } = {}
) {
  return apiFetch<z.infer<typeof adminAuditListResponseSchema>>(
    `/api/v1/admin/audit/entities/${enc(entityType)}/${enc(entityId)}${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminAuditListResponseSchema }
  );
}

/** Only the administrative actions (the backend filters `adminOnly: true`). */
export function fetchAdminAuditAdminActions(
  session: Session,
  query: ListQuery & { from?: string; to?: string } = {}
) {
  return apiFetch<z.infer<typeof adminAuditListResponseSchema>>(
    `/api/v1/admin/audit/admin-actions${buildQuery({
      cursor: query.cursor,
      limit: defaultLimit(query),
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminAuditListResponseSchema }
  );
}

export function fetchAdminAuditExport(
  session: Session,
  query: {
    limit?: number;
    actor_id?: string;
    entity_type?: string;
    entity_id?: string;
    action?: string;
    from?: string;
    to?: string;
  } = {}
) {
  return apiFetch<z.infer<typeof adminAuditExportResponseSchema>>(
    `/api/v1/admin/audit/export${buildQuery({
      limit: query.limit ?? 1000,
      actor_id: query.actor_id,
      entity_type: query.entity_type,
      entity_id: query.entity_id,
      action: query.action,
      from: query.from,
      to: query.to
    })}`,
    { accessToken: session.accessToken, schema: adminAuditExportResponseSchema }
  );
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                               */
/* -------------------------------------------------------------------------- */

export function fetchAdminConfiguration(session: Session) {
  return apiFetch<z.infer<typeof adminConfigurationSchema>>(
    "/api/v1/admin/configuration",
    { accessToken: session.accessToken, schema: adminConfigurationSchema }
  );
}

export function fetchAdminProviderBudgets(session: Session) {
  return apiFetch<z.infer<typeof adminProviderBudgetsSchema>>(
    "/api/v1/admin/configuration/provider-budgets",
    { accessToken: session.accessToken, schema: adminProviderBudgetsSchema }
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
/* Health — public, no session required                                        */
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

/* -------------------------------------------------------------------------- */
/* Local page schemas                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The quote list of a request shares the cursor page envelope.
 *
 * Declared locally because the shared contract exposes the quote ITEM but
 * not this particular LIST — the two are different shapes and conflating them
 * is exactly the bug this file previously had.
 */
const adminRequestQuoteListSchema = z.object({
  items: z.array(adminRequestQuoteSchema),
  page: z.object({
    limit: z.number().int().positive(),
    has_more: z.boolean(),
    next_cursor: z.string().optional()
  })
});

export { adminAuditRowSchema };
