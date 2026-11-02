"use client";

import { CommandForm } from "@/components/admin/command-form";

import {
  abandonOutboxEventAction,
  cancelNotificationAction,
  retryNotificationAction,
  retryOutboxEventAction
} from "./actions";

/**
 * The delivery command forms.
 *
 * The buttons are rendered from the BACKEND's own `next_action_codes`:
 *
 *  - an outbox event offers `retry` only when it is a dead letter of a
 *    replay-safe topic, and `abandon` only for the topics the backend allows
 *    to be dropped;
 *  - a notification offers `retry` only when it failed, and `cancel` only
 *    while a delivery is still pending.
 *
 * The frontend never re-derives those rules — a button that the backend did
 * not authorise would only produce a 409.
 */
export function OutboxEventCommandForms({
  eventId,
  nextActionCodes
}: {
  eventId: string;
  nextActionCodes: string[];
}) {
  const allowed = new Set(nextActionCodes);
  const canRetry = allowed.has("retry");
  const canAbandon = allowed.has("abandon");

  return (
    <div className="flex flex-col gap-6">
      <CommandForm
        action={retryOutboxEventAction}
        label="Thử lại sự kiện"
        confirmText="Thử lại"
        disabled={!canRetry}
        disabledHint={
          canRetry
            ? undefined
            : "Chỉ thử lại được sự kiện đã chết và thuộc loại an toàn để phát lại."
        }
        description="Đưa sự kiện đã chết trở lại hàng đợi xử lý. Số lần thử lại của quản trị bị giới hạn."
      >
        <input type="hidden" name="eventId" value={eventId} />
      </CommandForm>

      <CommandForm
        action={abandonOutboxEventAction}
        label="Bỏ sự kiện"
        confirmText="Bỏ sự kiện"
        variant="danger"
        disabled={!canAbandon}
        disabledHint={
          canAbandon
            ? undefined
            : "Sự kiện bàn giao quan trọng không thể bị bỏ."
        }
        description="Kết thúc sự kiện mà không xử lý. Bản ghi được giữ lại trong nhật ký."
      >
        <input type="hidden" name="eventId" value={eventId} />
      </CommandForm>
    </div>
  );
}

export function NotificationCommandForms({
  notificationId,
  status
}: {
  notificationId: string;
  status: string;
}) {
  const canRetry = status === "failed";
  const canCancel = status === "pending" || status === "processing";

  return (
    <div className="flex flex-col gap-6">
      <CommandForm
        action={retryNotificationAction}
        label="Gửi lại thông báo"
        confirmText="Gửi lại"
        disabled={!canRetry}
        disabledHint={
          canRetry
            ? undefined
            : "Chỉ gửi lại được thông báo ở trạng thái lỗi."
        }
        description="Đưa thông báo lỗi vào hàng đợi giao lại cho các thiết bị chưa nhận được."
      >
        <input type="hidden" name="notificationId" value={notificationId} />
      </CommandForm>

      <CommandForm
        action={cancelNotificationAction}
        label="Huỷ giao thông báo"
        confirmText="Huỷ giao"
        variant="danger"
        disabled={!canCancel}
        disabledHint={
          canCancel
            ? undefined
            : "Thông báo đã gửi thành công hoặc đã kết thúc nên không thể huỷ."
        }
        description="Dừng các lượt giao đang chờ. Người dùng sẽ không nhận được thông báo này."
      >
        <input type="hidden" name="notificationId" value={notificationId} />
      </CommandForm>
    </div>
  );
}
