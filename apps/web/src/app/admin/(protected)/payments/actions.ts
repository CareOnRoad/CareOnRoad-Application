"use server";

import { revalidatePath } from "next/cache";

import { adminPaymentReviewResolveSchema } from "@careonroad/api-contract/admin/payments";

import { adminResolvePaymentReview } from "@/lib/api/admin-commands";
import { getAdminSession } from "@/lib/admin/session";

import type { CommandFormState } from "@/components/admin/command-form";

/**
 * Server Actions for the "Thanh toán" tab.
 *
 * This is the ONLY administrative command that touches real money: the
 * backend calls payOS to reconcile the order before confirming it, and then
 * confirms or closes the order.
 *
 * The UI therefore requires an explicit two-step confirmation (see
 * `PaymentReviewResolver`): the admin picks the resolution, then types a
 * confirmation phrase before the command is sent.
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
    return { ok: true, message: "Đã xử lý đơn thanh toán." };
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
    message: result.message ?? "Xử lý thất bại.",
    reason
  };
}

export async function resolvePaymentReviewAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const paymentOrderId = String(formData.get("paymentOrderId") ?? "");

  const parsed = adminPaymentReviewResolveSchema.safeParse({
    action: String(formData.get("action") ?? ""),
    reason: readReason(formData)
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Cách xử lý không hợp lệ (chỉ nhận confirm_received hoặc close_unpaid)."
    };
  }

  const result = await adminResolvePaymentReview(
    session,
    paymentOrderId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/payments");
  }
  return toFormState(result);
}
