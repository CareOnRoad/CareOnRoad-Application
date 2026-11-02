"use server";

import { revalidatePath } from "next/cache";

import {
  adminReminderDisableSchema,
  adminReminderEnableSchema,
  adminReminderRetrySchema
} from "@careonroad/api-contract/admin/reminders";

import {
  adminDisableReminder,
  adminEnableReminder,
  adminRetryReminderOccurrence
} from "@/lib/api/admin-commands";
import { getAdminSession } from "@/lib/admin/session";

import type { CommandFormState } from "@/components/admin/command-form";

/**
 * Server Actions for the "Nhắc hẹn" tab.
 *
 * IMPORTANT — `enable` requires a `next_due_at` in the FUTURE; the backend
 * rejects a past date. The form therefore computes the default date on the
 * server and validates it before sending.
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

export async function enableReminderAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const reminderId = String(formData.get("reminderId") ?? "");
  const nextDueAt = readNextDueAt(formData);

  if (!nextDueAt) {
    return {
      ok: false,
      message: "Ngày đến hạn tiếp theo không hợp lệ."
    };
  }

  const parsed = adminReminderEnableSchema.safeParse({
    reason: readReason(formData),
    next_due_at: nextDueAt
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Ngày đến hạn tiếp theo phải là một thời điểm hợp lệ trong tương lai."
    };
  }

  if (new Date(parsed.data.next_due_at).getTime() <= Date.now()) {
    return {
      ok: false,
      message: "Ngày đến hạn tiếp theo phải nằm trong tương lai."
    };
  }

  const result = await adminEnableReminder(
    session,
    reminderId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/reminders");
  }
  return toFormState(result);
}

/**
 * Reads the `next_due_at` field.
 *
 * The form uses a `datetime-local` input, which produces a LOCAL time
 * without a timezone ("2026-11-05T09:00"). The backend demands an absolute
 * instant WITH an offset, so the local value is converted here. A value that
 * already carries an offset is passed through untouched.
 */
function readNextDueAt(formData: FormData): string | null {
  const raw = String(formData.get("next_due_at") ?? "").trim();
  if (!raw) {
    return null;
  }
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw);
  const date = new Date(hasOffset ? raw : `${raw}:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export async function disableReminderAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const reminderId = String(formData.get("reminderId") ?? "");

  const parsed = adminReminderDisableSchema.safeParse({
    reason: readReason(formData)
  });
  if (!parsed.success) {
    return { ok: false, message: "Lý do không hợp lệ." };
  }

  const result = await adminDisableReminder(
    session,
    reminderId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/reminders");
  }
  return toFormState(result);
}

export async function retryReminderOccurrenceAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const occurrenceId = String(formData.get("occurrenceId") ?? "");

  const parsed = adminReminderRetrySchema.safeParse({
    reason: readReason(formData)
  });
  if (!parsed.success) {
    return { ok: false, message: "Lý do không hợp lệ." };
  }

  const result = await adminRetryReminderOccurrence(
    session,
    occurrenceId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/reminders");
  }
  return toFormState(result);
}
