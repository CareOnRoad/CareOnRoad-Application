"use server";

import { revalidatePath } from "next/cache";

import { adminDeliveryCommandSchema } from "@careonroad/api-contract/admin/delivery";

import {
  adminAbandonOutboxEvent,
  adminCancelNotification,
  adminRetryNotification,
  adminRetryOutboxEvent
} from "@/lib/api/admin-commands";
import { getAdminSession } from "@/lib/admin/session";

import type { CommandFormState } from "@/components/admin/command-form";

/**
 * Server Actions for the "Thông báo" and "Outbox" tabs.
 *
 * These commands are the delivery-recovery ones:
 *
 *  - `notifications/{id}/retry` re-queues a FAILED notification. The backend
 *    refuses it when the notification is not failed
 *    (`notification_not_retryable`), when a receipt is still pending
 *    (`delivery_work_pending`) or when the retry budget is exhausted
 *    (`retry_limit_reached`).
 *  - `notifications/{id}/cancel` stops a pending delivery. The backend
 *    refuses it once a device receipt was sent (`delivery_already_sent`).
 *  - `outbox/{id}/retry` replays a DEAD-LETTER event, and only for topics
 *    that are safe to replay (`topic_retry_unsupported`).
 *  - `outbox/{id}/abandon` drops an event. Critical handoff topics can never
 *    be abandoned (`critical_handoff_cannot_abandon`).
 *
 * The frontend renders the buttons from the backend's `next_action_codes`
 * and never re-derives these rules.
 */

/** Reads and validates the idempotency key sent by the form. */
function readIdempotencyKey(formData: FormData): string {
  const key = String(formData.get("idempotencyKey") ?? "").trim();
  if (key.length < 8 || key.length > 200) {
    throw new Error(
      "Phiên làm việc của biểu mẫu đã hết hạn. Vui lòng tải lại trang."
    );
  }
  return key;
}

function readReason(formData: FormData): string {
  return String(formData.get("reason") ?? "").trim();
}

function toFormState(result: {
  ok: boolean;
  message?: string;
  details?: unknown;
}): CommandFormState {
  if (result.ok) {
    return { ok: true, message: "Thao tác đã được thực hiện." };
  }

  const details = result.details;
  const reason =
    details &&
    typeof details === "object" &&
    "reason" in details &&
    typeof (details as { reason?: unknown }).reason === "string"
      ? (details as { reason: string }).reason
      : undefined;

  return {
    ok: false,
    message: result.message ?? "Thao tác thất bại.",
    reason
  };
}

export async function retryNotificationAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const notificationId = String(formData.get("notificationId") ?? "");

  const parsed = adminDeliveryCommandSchema.safeParse({
    reason: readReason(formData)
  });
  if (!parsed.success) {
    return { ok: false, message: "Lý do không hợp lệ." };
  }

  const result = await adminRetryNotification(
    session,
    notificationId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/notifications");
  }
  return toFormState(result);
}

export async function cancelNotificationAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const notificationId = String(formData.get("notificationId") ?? "");

  const parsed = adminDeliveryCommandSchema.safeParse({
    reason: readReason(formData)
  });
  if (!parsed.success) {
    return { ok: false, message: "Lý do không hợp lệ." };
  }

  const result = await adminCancelNotification(
    session,
    notificationId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/notifications");
  }
  return toFormState(result);
}

export async function retryOutboxEventAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const eventId = String(formData.get("eventId") ?? "");

  const parsed = adminDeliveryCommandSchema.safeParse({
    reason: readReason(formData)
  });
  if (!parsed.success) {
    return { ok: false, message: "Lý do không hợp lệ." };
  }

  const result = await adminRetryOutboxEvent(
    session,
    eventId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/outbox");
  }
  return toFormState(result);
}

export async function abandonOutboxEventAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const eventId = String(formData.get("eventId") ?? "");

  const parsed = adminDeliveryCommandSchema.safeParse({
    reason: readReason(formData)
  });
  if (!parsed.success) {
    return { ok: false, message: "Lý do không hợp lệ." };
  }

  const result = await adminAbandonOutboxEvent(
    session,
    eventId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/outbox");
  }
  return toFormState(result);
}
