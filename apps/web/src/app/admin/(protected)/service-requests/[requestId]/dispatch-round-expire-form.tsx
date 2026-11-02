"use client";

import { CommandForm } from "@/components/admin/command-form";

import { isPastDeadline } from "@/lib/admin/deadline";

import { expireDispatchRoundAction } from "../actions";

/**
 * The dispatch round expiry form.
 *
 * The backend refuses to expire a round that has not expired yet
 * (`Dispatch round has not expired.`), so the button is only enabled for a
 * round whose `expires_at` is already in the past. Expiring a round closes
 * the open offers it produced.
 */
export function DispatchRoundExpireForm({
  roundId,
  requestId,
  status,
  expiresAt
}: {
  roundId: string;
  requestId: string;
  status: string;
  expiresAt?: string;
}) {
  const isExpired = isPastDeadline(expiresAt);
  const canExpire = status === "active" && isExpired;

  return (
    <CommandForm
      action={expireDispatchRoundAction}
      label="Đánh dấu vòng điều phối hết hạn"
      confirmText="Đánh dấu hết hạn"
      disabled={!canExpire}
      disabledHint={
        canExpire
          ? undefined
          : status !== "active"
            ? "Vòng điều phối này không còn hoạt động."
            : "Chỉ đánh dấu hết hạn được khi vòng điều phối đã quá thời hạn."
      }
      description="Kết thúc vòng điều phối và rút lại các đề nghị đang chờ trong vòng đó."
    >
      <input type="hidden" name="roundId" value={roundId} />
      <input type="hidden" name="requestId" value={requestId} />
    </CommandForm>
  );
}
