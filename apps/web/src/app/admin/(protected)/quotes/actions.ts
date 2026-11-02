"use server";

import { revalidatePath } from "next/cache";

import {
  adminQuoteCommandSchema,
  adminQuoteDisputeSchema
} from "@careonroad/api-contract/admin/quotes";

import {
  adminCommandQuote,
  adminRequestDiagnosisRevision,
  adminResolveQuoteDispute
} from "@/lib/api/admin-commands";
import { getAdminSession } from "@/lib/admin/session";

import type { CommandFormState } from "@/components/admin/command-form";

/**
 * Server Actions for the "Báo giá" tab.
 *
 * The quote commands are the most tightly guarded ones in the admin API:
 *
 *  - `expire` requires the quote to be ALREADY expired (`expire_quote` conflict
 *    code `quote_not_expired` otherwise);
 *  - `void` and `request_revision` require a PENDING quote and no
 *    unresolved payment;
 *  - a quote that is bound to a rescue/maintenance labour agreement cannot be
 *    voided (`agreement_exists`);
 *  - the dispute resolution is decided against the LATEST quote of the
 *    request (`quote_not_current`).
 *
 * The frontend mirrors the visible parts of these rules; the backend remains
 * the authority.
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

export async function commandQuoteAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const quoteId = String(formData.get("quoteId") ?? "");
  const action = String(formData.get("action") ?? "");

  const parsed = adminQuoteCommandSchema.safeParse({ reason: readReason(formData) });
  if (!parsed.success) {
    return { ok: false, message: "Lý do không hợp lệ." };
  }

  const result = await adminCommandQuote(
    session,
    quoteId,
    action as "expire" | "void" | "request-revision",
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath(`/admin/quotes/${quoteId}`);
  }
  return toFormState(result);
}

/** Asks the mechanic to revise a diagnosis that has not produced a quote yet. */
export async function requestDiagnosisRevisionAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const diagnosisId = String(formData.get("diagnosisId") ?? "");

  const parsed = adminQuoteCommandSchema.safeParse({ reason: readReason(formData) });
  if (!parsed.success) {
    return { ok: false, message: "Lý do không hợp lệ." };
  }

  const result = await adminRequestDiagnosisRevision(
    session,
    diagnosisId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath(`/admin/assignments/${String(formData.get("assignmentId") ?? "")}`);
  }
  return toFormState(result);
}

/**
 * Resolves a quote dispute on a request.
 *
 * `uphold_latest_quote` keeps the current quote; `void_pending_quote` voids
 * it; `request_revision` sends it back to the mechanic. Only the LATEST
 * quote of the request is affected.
 */
export async function resolveQuoteDisputeAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const requestId = String(formData.get("requestId") ?? "");

  const parsed = adminQuoteDisputeSchema.safeParse({
    reason: readReason(formData),
    resolution: String(formData.get("resolution") ?? "")
  });

  if (!parsed.success) {
    return { ok: false, message: "Cách xử lý tranh chấp không hợp lệ." };
  }

  const result = await adminResolveQuoteDispute(
    session,
    requestId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath(`/admin/service-requests/${requestId}`);
  }
  return toFormState(result);
}
