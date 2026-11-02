"use client";

import { CommandForm } from "@/components/admin/command-form";

import {
  disableReminderAction,
  enableReminderAction,
  retryReminderOccurrenceAction
} from "./actions";

/**
 * The reminder command forms.
 *
 * Three commands, each with its own form (and therefore its own idempotency
 * key — the backend scopes idempotency by `(actor, scope, key)`, so a shared
 * key under two scopes would run BOTH commands):
 *
 *  - **Bật lại**: requires a `next_due_at` in the FUTURE. The backend rejects
 *    a past date, so the form shows the current due date and asks for a new
 *    one.
 *  - **Tắt**: disables the rule. Existing reminders keep firing, but no new
 *    occurrence is created.
 *  - **Thử lại lần nhắc**: re-queues a FAILED occurrence. It is only offered
 *    for a failed occurrence, because the backend refuses anything else
 *    (`occurrence_not_failed`).
 */
export function ReminderCommandForms({
  reminderId,
  enabled,
  nextDueAt
}: {
  reminderId: string;
  enabled: boolean;
  nextDueAt?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CommandForm
        action={enableReminderAction}
        label="Bật lại nhắc hẹn"
        confirmText="Bật lại nhắc hẹn"
        disabled={enabled}
        disabledHint={
          enabled ? undefined : "Quy tắc đang bật, không cần bật lại."
        }
        description="Bật quy tắc và đặt ngày đến hạn tiếp theo. Ngày phải nằm trong tương lai."
      >
        <input type="hidden" name="reminderId" value={reminderId} />
        <label className="flex flex-col gap-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#3d4d63" }}
          >
            Ngày đến hạn tiếp theo <span style={{ color: "#b3131d" }}>*</span>
          </span>
          <input
            type="datetime-local"
            name="next_due_at"
            required
            defaultValue={toLocalInputValue(nextDueAt)}
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              border: "1px solid #e5e9ef",
              backgroundColor: "#fff",
              color: "#162130"
            }}
          />
          <span className="text-[11px]" style={{ color: "#6b7a8d" }}>
            Đến hạn hiện tại: {nextDueAt ?? "—"} (giờ Việt Nam).
          </span>
        </label>
      </CommandForm>

      <CommandForm
        action={disableReminderAction}
        label="Tắt nhắc hẹn"
        confirmText="Tắt nhắc hẹn"
        variant="danger"
        disabled={!enabled}
        disabledHint={
          enabled ? undefined : "Quy tắc đã tắt sẵn."
        }
        description="Ngừng tạo lần nhắc mới. Các lần nhắc đã tồn tại vẫn được giữ nguyên."
      >
        <input type="hidden" name="reminderId" value={reminderId} />
      </CommandForm>
    </div>
  );
}

/**
 * The occurrence retry form.
 *
 * Rendered per FAILED occurrence — the backend refuses the retry for any
 * other status (`occurrence_not_failed`).
 */
export function ReminderOccurrenceRetryForm({
  occurrenceId,
  status
}: {
  occurrenceId: string;
  status: string;
}) {
  const canRetry = status === "failed";

  return (
    <CommandForm
      action={retryReminderOccurrenceAction}
      label="Thử lại lần nhắc"
      confirmText="Thử lại"
      disabled={!canRetry}
      disabledHint={
        canRetry ? undefined : "Chỉ thử lại được lần nhắc ở trạng thái lỗi."
      }
      description="Đưa lần nhắc lỗi vào hàng đợi xử lý lại."
    >
      <input type="hidden" name="occurrenceId" value={occurrenceId} />
    </CommandForm>
  );
}

/**
 * Converts an ISO timestamp into the `datetime-local` input format.
 *
 * The value is rendered in the browser's local timezone, and the Server
 * Action converts it back to an absolute ISO instant, so the backend always
 * receives an unambiguous timestamp with an offset.
 */
function toLocalInputValue(value?: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
