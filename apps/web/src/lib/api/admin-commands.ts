import "server-only";

import { z } from "zod";

import {
  adminUserSummarySchema,
  adminUserDeviceSchema,
  adminUserStatusMutationSchema,
  adminRoleMutationSchema,
  adminDeviceRevokeMutationSchema,
  adminPlanChangeSchema
} from "@careonroad/api-contract/admin/users";
import {
  adminMechanicSummarySchema,
  adminMechanicStatusMutationSchema,
  adminMechanicSkillsMutationSchema,
  adminMechanicRadiusMutationSchema,
  adminMechanicForceUnavailableMutationSchema
} from "@careonroad/api-contract/admin/mechanics";
import {
  adminRequestDetailSchema,
  adminRequestNoteMutationSchema,
  adminRequestCommandSchema,
  adminRequestCancellationRepairSchema,
  adminRequestReservationRepairSchema,
  adminRequestDispatchCommandSchema
} from "@careonroad/api-contract/admin/service-requests";
import {
  adminAssignmentCancelSchema,
  adminAssignmentNoteSchema,
  adminAssignmentMechanicCommandSchema,
  adminAssignmentResolveStuckSchema
} from "@careonroad/api-contract/admin/assignments";
import {
  adminQuoteCommandSchema,
  adminQuoteDisputeSchema
} from "@careonroad/api-contract/admin/quotes";
import { adminDispatchCommandSchema } from "@careonroad/api-contract/admin/dispatch";
import {
  adminDeliveryCommandSchema,
  adminOutboxEventSchema,
  adminNotificationSchema
} from "@careonroad/api-contract/admin/delivery";
import {
  adminReminderDisableSchema,
  adminReminderEnableSchema,
  adminReminderRetrySchema,
  adminReminderRuleSchema,
  adminReminderOccurrenceSchema
} from "@careonroad/api-contract/admin/reminders";
import {
  adminDispatchConfigurationUpdateSchema
} from "@careonroad/api-contract/admin/configuration";
import { adminPaymentReviewResolveSchema } from "@careonroad/api-contract/admin/payments";

import {
  runAdminCommand,
  type AdminCommandResult
} from "./admin-command-runner";

/**
 * Every administrative mutation, one function per backend route.
 *
 * The functions here only declare the PATH, the BODY SHAPE and the RESPONSE
 * SHAPE. The transport concerns (idempotency header, validation, error
 * mapping) live in `admin-command-runner.ts`, so no page can accidentally
 * forget the `X-Idempotency-Key` or the `reason`.
 *
 * IMPORTANT — the backend scopes idempotency by `(actor, scope, key)`. A key
 * reused under two different scopes runs BOTH commands, so every form must
 * mint its own key. The `CommandForm` client component does that.
 */

type Session = { accessToken: string };

const enc = encodeURIComponent;

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export function adminSuspendUser(
  session: Session,
  userId: string,
  body: z.infer<typeof adminUserStatusMutationSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminUserSummarySchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/users/${enc(userId)}/suspend`,
    body,
    bodySchema: adminUserStatusMutationSchema,
    responseSchema: adminUserSummarySchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminReactivateUser(
  session: Session,
  userId: string,
  body: z.infer<typeof adminUserStatusMutationSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminUserSummarySchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/users/${enc(userId)}/reactivate`,
    body,
    bodySchema: adminUserStatusMutationSchema,
    responseSchema: adminUserSummarySchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminArchiveUser(
  session: Session,
  userId: string,
  body: z.infer<typeof adminUserStatusMutationSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminUserSummarySchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/users/${enc(userId)}/archive`,
    body,
    bodySchema: adminUserStatusMutationSchema,
    responseSchema: adminUserSummarySchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/**
 * Grant or extend a rider plan.
 *
 * The backend writes TWO tables here (`app_users` and `plan_subscriptions`),
 * so the form must get `duration` exactly right: required for a paid plan,
 * forbidden for the free plan. The contract's refine rejects the wrong
 * combination before the request is sent.
 */
export function adminChangeUserPlan(
  session: Session,
  userId: string,
  body: z.infer<typeof adminPlanChangeSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminUserSummarySchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/users/${enc(userId)}/plan`,
    body,
    bodySchema: adminPlanChangeSchema,
    responseSchema: adminUserSummarySchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminGrantUserRole(
  session: Session,
  userId: string,
  body: z.infer<typeof adminRoleMutationSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminUserSummarySchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/users/${enc(userId)}/roles/grant`,
    body,
    bodySchema: adminRoleMutationSchema,
    responseSchema: adminUserSummarySchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminRevokeUserRole(
  session: Session,
  userId: string,
  body: z.infer<typeof adminRoleMutationSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminUserSummarySchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/users/${enc(userId)}/roles/revoke`,
    body,
    bodySchema: adminRoleMutationSchema,
    responseSchema: adminUserSummarySchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/** Revoke one device of a user. The device id is global, not nested. */
export function adminRevokeDevice(
  session: Session,
  deviceId: string,
  body: z.infer<typeof adminDeviceRevokeMutationSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminUserDeviceSchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/devices/${enc(deviceId)}/revoke`,
    body,
    bodySchema: adminDeviceRevokeMutationSchema,
    responseSchema: adminUserDeviceSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/* -------------------------------------------------------------------------- */
/* Mechanics                                                                   */
/* -------------------------------------------------------------------------- */

type MechanicStatusAction = "approve" | "reject" | "suspend" | "ban" | "reactivate";

export function adminChangeMechanicStatus(
  session: Session,
  mechanicId: string,
  action: MechanicStatusAction,
  body: z.infer<typeof adminMechanicStatusMutationSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminMechanicSummarySchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/mechanics/${enc(mechanicId)}/${action}`,
    body,
    bodySchema: adminMechanicStatusMutationSchema,
    responseSchema: adminMechanicSummarySchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/** The backend uses PUT (not POST) for the skills update. */
export function adminUpdateMechanicSkills(
  session: Session,
  mechanicId: string,
  body: z.infer<typeof adminMechanicSkillsMutationSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminMechanicSummarySchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/mechanics/${enc(mechanicId)}/skills`,
    method: "PUT",
    body,
    bodySchema: adminMechanicSkillsMutationSchema,
    responseSchema: adminMechanicSummarySchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/** The backend uses PUT (not POST) for the service radius update. */
export function adminUpdateMechanicServiceRadius(
  session: Session,
  mechanicId: string,
  body: z.infer<typeof adminMechanicRadiusMutationSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminMechanicSummarySchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/mechanics/${enc(mechanicId)}/service-radius`,
    method: "PUT",
    body,
    bodySchema: adminMechanicRadiusMutationSchema,
    responseSchema: adminMechanicSummarySchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminForceMechanicUnavailable(
  session: Session,
  mechanicId: string,
  body: z.infer<typeof adminMechanicForceUnavailableMutationSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminMechanicSummarySchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/mechanics/${enc(mechanicId)}/force-unavailable`,
    body,
    bodySchema: adminMechanicForceUnavailableMutationSchema,
    responseSchema: adminMechanicSummarySchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/* -------------------------------------------------------------------------- */
/* Service requests                                                            */
/* -------------------------------------------------------------------------- */

export function adminCancelServiceRequest(
  session: Session,
  requestId: string,
  body: z.infer<typeof adminRequestCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminRequestDetailSchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/service-requests/${enc(requestId)}/cancel`,
    body,
    bodySchema: adminRequestCommandSchema,
    responseSchema: adminRequestDetailSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminManuallyEscalateServiceRequest(
  session: Session,
  requestId: string,
  body: z.infer<typeof adminRequestCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminRequestDetailSchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/service-requests/${enc(requestId)}/manual-escalate`,
    body,
    bodySchema: adminRequestCommandSchema,
    responseSchema: adminRequestDetailSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminAddServiceRequestNote(
  session: Session,
  requestId: string,
  body: z.infer<typeof adminRequestNoteMutationSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/service-requests/${enc(requestId)}/notes`,
    body,
    bodySchema: adminRequestNoteMutationSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminResolveQuoteDispute(
  session: Session,
  requestId: string,
  body: z.infer<typeof adminQuoteDisputeSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/service-requests/${enc(requestId)}/quote-dispute/resolve`,
    body,
    bodySchema: adminQuoteDisputeSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/**
 * The cancellation repair runs as a DRY RUN by default.
 *
 * `dry_run: false` is what actually mutates the assignment, so the form must
 * make that distinction explicit. The contract defaults `dry_run` to `true`.
 */
export function adminRepairServiceRequestCancellation(
  session: Session,
  requestId: string,
  body: z.infer<typeof adminRequestCancellationRepairSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/service-requests/${enc(requestId)}/repair-cancellation`,
    body,
    bodySchema: adminRequestCancellationRepairSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminRepairServiceRequestReservation(
  session: Session,
  requestId: string,
  body: z.infer<typeof adminRequestReservationRepairSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/service-requests/${enc(requestId)}/repair-reservation`,
    body,
    bodySchema: adminRequestReservationRepairSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminRetryServiceRequestDispatch(
  session: Session,
  requestId: string,
  body: z.infer<typeof adminRequestDispatchCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/service-requests/${enc(requestId)}/dispatch/retry`,
    body,
    bodySchema: adminRequestDispatchCommandSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminCancelServiceRequestDispatch(
  session: Session,
  requestId: string,
  body: z.infer<typeof adminRequestDispatchCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/service-requests/${enc(requestId)}/dispatch/cancel`,
    body,
    bodySchema: adminRequestDispatchCommandSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/** Manually assign a mechanic to a request that has no active assignment. */
export function adminManualAssignServiceRequest(
  session: Session,
  requestId: string,
  body: z.infer<typeof adminAssignmentMechanicCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/service-requests/${enc(requestId)}/dispatch/manual-assign`,
    body,
    bodySchema: adminAssignmentMechanicCommandSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/* -------------------------------------------------------------------------- */
/* Assignments                                                                 */
/* -------------------------------------------------------------------------- */

export function adminCancelAssignment(
  session: Session,
  assignmentId: string,
  body: z.infer<typeof adminAssignmentCancelSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/assignments/${enc(assignmentId)}/cancel`,
    body,
    bodySchema: adminAssignmentCancelSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminAddAssignmentNote(
  session: Session,
  assignmentId: string,
  body: z.infer<typeof adminAssignmentNoteSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/assignments/${enc(assignmentId)}/notes`,
    body,
    bodySchema: adminAssignmentNoteSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminReassignAssignment(
  session: Session,
  assignmentId: string,
  body: z.infer<typeof adminAssignmentMechanicCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/assignments/${enc(assignmentId)}/reassign`,
    body,
    bodySchema: adminAssignmentMechanicCommandSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminResolveStuckAssignment(
  session: Session,
  assignmentId: string,
  body: z.infer<typeof adminAssignmentResolveStuckSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/assignments/${enc(assignmentId)}/resolve-stuck`,
    body,
    bodySchema: adminAssignmentResolveStuckSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/* -------------------------------------------------------------------------- */
/* Dispatch rounds                                                             */
/* -------------------------------------------------------------------------- */

export function adminExpireDispatchRound(
  session: Session,
  roundId: string,
  body: z.infer<typeof adminDispatchCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/dispatch/rounds/${enc(roundId)}/expire`,
    body,
    bodySchema: adminDispatchCommandSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/* -------------------------------------------------------------------------- */
/* Quotes & diagnoses                                                          */
/* -------------------------------------------------------------------------- */

type QuoteCommandAction = "expire" | "void" | "request-revision";

export function adminCommandQuote(
  session: Session,
  quoteId: string,
  action: QuoteCommandAction,
  body: z.infer<typeof adminQuoteCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/quotes/${enc(quoteId)}/${action}`,
    body,
    bodySchema: adminQuoteCommandSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminRequestDiagnosisRevision(
  session: Session,
  diagnosisId: string,
  body: z.infer<typeof adminQuoteCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: `/api/v1/admin/diagnoses/${enc(diagnosisId)}/request-revision`,
    body,
    bodySchema: adminQuoteCommandSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/* -------------------------------------------------------------------------- */
/* Reminders                                                                   */
/* -------------------------------------------------------------------------- */

export function adminEnableReminder(
  session: Session,
  reminderId: string,
  body: z.infer<typeof adminReminderEnableSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminReminderRuleSchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/reminders/${enc(reminderId)}/enable`,
    body,
    bodySchema: adminReminderEnableSchema,
    responseSchema: adminReminderRuleSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminDisableReminder(
  session: Session,
  reminderId: string,
  body: z.infer<typeof adminReminderDisableSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminReminderRuleSchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/reminders/${enc(reminderId)}/disable`,
    body,
    bodySchema: adminReminderDisableSchema,
    responseSchema: adminReminderRuleSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminRetryReminderOccurrence(
  session: Session,
  occurrenceId: string,
  body: z.infer<typeof adminReminderRetrySchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminReminderOccurrenceSchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/reminder-occurrences/${enc(occurrenceId)}/retry`,
    body,
    bodySchema: adminReminderRetrySchema,
    responseSchema: adminReminderOccurrenceSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/* -------------------------------------------------------------------------- */
/* Notifications & outbox                                                      */
/* -------------------------------------------------------------------------- */

export function adminCancelNotification(
  session: Session,
  notificationId: string,
  body: z.infer<typeof adminDeliveryCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminNotificationSchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/notifications/${enc(notificationId)}/cancel`,
    body,
    bodySchema: adminDeliveryCommandSchema,
    responseSchema: adminNotificationSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminRetryNotification(
  session: Session,
  notificationId: string,
  body: z.infer<typeof adminDeliveryCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminNotificationSchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/notifications/${enc(notificationId)}/retry`,
    body,
    bodySchema: adminDeliveryCommandSchema,
    responseSchema: adminNotificationSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminRetryOutboxEvent(
  session: Session,
  eventId: string,
  body: z.infer<typeof adminDeliveryCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminOutboxEventSchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/outbox/${enc(eventId)}/retry`,
    body,
    bodySchema: adminDeliveryCommandSchema,
    responseSchema: adminOutboxEventSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

export function adminAbandonOutboxEvent(
  session: Session,
  eventId: string,
  body: z.infer<typeof adminDeliveryCommandSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<z.infer<typeof adminOutboxEventSchema>>> {
  return runAdminCommand({
    path: `/api/v1/admin/outbox/${enc(eventId)}/abandon`,
    body,
    bodySchema: adminDeliveryCommandSchema,
    responseSchema: adminOutboxEventSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a payment that needs review.
 *
 * THIS IS THE ONLY ADMIN COMMAND THAT TOUCHES REAL MONEY: the backend calls
 * the payOS provider to reconcile the order before confirming it. The UI MUST
 * require an explicit two-step confirmation (see `PaymentReviewResolver`).
 */
export function adminResolvePaymentReview(
  session: Session,
  paymentOrderId: string,
  body: z.infer<typeof adminPaymentReviewResolveSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<Record<string, unknown>>> {
  return runAdminCommand({
    path: `/api/v1/admin/payments/orders/${enc(paymentOrderId)}/resolve`,
    body,
    bodySchema: adminPaymentReviewResolveSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Update the live dispatch policy.
 *
 * The change applies to NEW dispatch episodes only. The UI must show a
 * warning and a diff before submitting (see the Configuration tab).
 */
export function adminUpdateDispatchConfiguration(
  session: Session,
  body: z.infer<typeof adminDispatchConfigurationUpdateSchema>,
  idempotencyKey: string
): Promise<AdminCommandResult<unknown>> {
  return runAdminCommand({
    path: "/api/v1/admin/configuration/dispatch",
    method: "PUT",
    body,
    bodySchema: adminDispatchConfigurationUpdateSchema,
    idempotencyKey,
    accessToken: session.accessToken
  });
}
