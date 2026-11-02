"use client";

import { CommandForm } from "@/components/admin/command-form";

import { commandQuoteAction } from "../actions";

/**
 * The quote command forms.
 *
 * Three commands with different preconditions, so each one is a separate
 * form with its own idempotency key:
 *
 *  - **Hết hạn**: only legal when the quote's `expires_at` is already in the
 *    past. The backend refuses otherwise (`quote_not_expired`), so the button
 *    is disabled until then.
 *  - **Vô hiệu**: only legal for a PENDING quote with no unresolved payment
 *    and no labour agreement bound to it.
 *  - **Yêu cầu sửa**: sends the quote back to the mechanic for a revision.
 */
export function QuoteCommandForms({
  quoteId,
  status,
  isExpired
}: {
  quoteId: string;
  status: string;
  isExpired: boolean;
}) {
  const isPending = status === "pending";

  return (
    <div className="flex flex-col gap-6">
      <CommandForm
        action={commandQuoteAction}
        label="Đánh dấu hết hạn"
        confirmText="Đánh dấu hết hạn"
        disabled={!isExpired}
        disabledHint={
          isExpired
            ? undefined
            : "Chỉ đánh dấu hết hạn được khi báo giá đã quá thời hạn."
        }
        description="Chuyển báo giá sang trạng thái hết hạn. Chỉ dùng khi thời hạn đã qua."
      >
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="action" value="expire" />
      </CommandForm>

      <CommandForm
        action={commandQuoteAction}
        label="Vô hiệu báo giá"
        confirmText="Vô hiệu báo giá"
        variant="danger"
        disabled={!isPending}
        disabledHint={
          isPending ? undefined : "Chỉ vô hiệu được báo giá đang chờ."
        }
        description="Vô hiệu báo giá đang chờ và đưa phân công về trạng thái chờ chẩn đoán."
      >
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="action" value="void" />
      </CommandForm>

      <CommandForm
        action={commandQuoteAction}
        label="Yêu cầu sửa báo giá"
        confirmText="Yêu cầu sửa"
        disabled={!isPending}
        disabledHint={
          isPending ? undefined : "Chỉ yêu cầu sửa được báo giá đang chờ."
        }
        description="Gửi báo giá trở lại kỹ thuật viên để lập phiên bản sửa đổi."
      >
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="action" value="request-revision" />
      </CommandForm>
    </div>
  );
}
