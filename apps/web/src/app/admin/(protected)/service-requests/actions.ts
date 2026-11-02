"use server";

import { revalidatePath } from "next/cache";

import {
  adminAssignmentMechanicCommandSchema,
  adminAssignmentNoteSchema,
  adminAssignmentResolveStuckSchema
} from "@careonroad/api-contract/admin/assignments";
import {
  adminRequestCancellationRepairSchema,
  adminRequestNoteMutationSchema,
  adminRequestReservationRepairSchema
} from "@careonroad/api-contract/admin/service-requests";
import { adminDispatchCommandSchema } from "@careonroad/api-contract/admin/dispatch";

import {
  adminAddAssignmentNote,
  adminAddServiceRequestNote,
  adminCancelServiceRequest,
  adminCancelServiceRequestDispatch,
  adminExpireDispatchRound,
  adminManuallyEscalateServiceRequest,
  adminManualAssignServiceRequest,
  adminRepairServiceRequestCancellation,
  adminRepairServiceRequestReservation,
  adminResolveStuckAssignment,
  adminRetryServiceRequestDispatch
} from "@/lib/api/admin-commands";
import { getAdminSession } from "@/lib/admin/session";

import type { CommandFormState } from "@/components/admin/command-form";

/**
 * Server Actions for the "Yêu cầu cứu hộ" tab.
 *
 * These commands are the ones the backend guards most tightly:
 *
 *  - the request state machine rejects an illegal transition, and the
 *    response carries `details.reason` explaining which one;
 *  - the cancellation/reservation REPAIR commands default to a dry run, so
 *    the form must send `dry_run: false` explicitly for a real repair;
 *  - the dispatch retry/cancel commands are bounded by the episode's retry
 *    budget, which the backend reports through `reason_codes`.
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

/** Turns a runner result into the shape the form renders. */
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

function revalidateRequest(requestId: string) {
  revalidatePath("/admin/service-requests");
  revalidatePath(`/admin/service-requests/${requestId}`);
}

export async function cancelServiceRequestAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const requestId = String(formData.get("requestId") ?? "");

  const result = await adminCancelServiceRequest(
    session,
    requestId,
    { reason: readReason(formData) },
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidateRequest(requestId);
  }
  return toFormState(result);
}

export async function manuallyEscalateServiceRequestAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const requestId = String(formData.get("requestId") ?? "");

  const result = await adminManuallyEscalateServiceRequest(
    session,
    requestId,
    { reason: readReason(formData) },
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidateRequest(requestId);
  }
  return toFormState(result);
}

/**
 * Adds an internal note.
 *
 * The note body is APPEND-ONLY: it is written to a separate notes table and
 * to the audit log, never overwriting an existing record.
 */
export async function addServiceRequestNoteAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const requestId = String(formData.get("requestId") ?? "");

  const parsed = adminRequestNoteMutationSchema.safeParse({
    reason: readReason(formData),
    note: String(formData.get("note") ?? "").trim()
  });

  if (!parsed.success) {
    return { ok: false, message: "Nội dung ghi chú không được để trống." };
  }

  const result = await adminAddServiceRequestNote(
    session,
    requestId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidateRequest(requestId);
  }
  return toFormState(result);
}

/**
 * The cancellation repair.
 *
 * `dry_run` defaults to `true` in the contract, and the backend only mutates
 * anything when it is `false`. The form therefore has an explicit "dry run"
 * checkbox, and the action sends `dry_run: false` only when the admin
 * confirms the real repair.
 */
export async function repairServiceRequestCancellationAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const requestId = String(formData.get("requestId") ?? "");

  const parsed = adminRequestCancellationRepairSchema.safeParse({
    reason: readReason(formData),
    assignment_id: String(formData.get("assignment_id") ?? ""),
    dry_run: formData.get("dry_run") === "true"
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Cần mã phân công hợp lệ để sửa trạng thái huỷ."
    };
  }

  const result = await adminRepairServiceRequestCancellation(
    session,
    requestId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidateRequest(requestId);
  }
  return toFormState(result);
}

/** The reservation repair — the cancellation repair plus an estimated duration. */
export async function repairServiceRequestReservationAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const requestId = String(formData.get("requestId") ?? "");

  const parsed = adminRequestReservationRepairSchema.safeParse({
    reason: readReason(formData),
    assignment_id: String(formData.get("assignment_id") ?? ""),
    dry_run: formData.get("dry_run") === "true",
    estimated_duration_minutes: Number(formData.get("estimated_duration_minutes"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Cần mã phân công hợp lệ và thời lượng ước tính từ 15 đến 480 phút."
    };
  }

  const result = await adminRepairServiceRequestReservation(
    session,
    requestId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidateRequest(requestId);
  }
  return toFormState(result);
}

export async function retryServiceRequestDispatchAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const requestId = String(formData.get("requestId") ?? "");

  const result = await adminRetryServiceRequestDispatch(
    session,
    requestId,
    { reason: readReason(formData) },
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidateRequest(requestId);
  }
  return toFormState(result);
}

export async function cancelServiceRequestDispatchAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const requestId = String(formData.get("requestId") ?? "");

  const result = await adminCancelServiceRequestDispatch(
    session,
    requestId,
    { reason: readReason(formData) },
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidateRequest(requestId);
  }
  return toFormState(result);
}

/**
 * Manually assigns a mechanic to a request.
 *
 * This BYPASSES the dispatch ranking, so it is only offered when the backend
 * reports `manual_assign` as a legal next action. The mechanic id must be a
 * UUID — the backend rejects anything else.
 */
export async function manualAssignServiceRequestAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const requestId = String(formData.get("requestId") ?? "");

  const parsed = adminAssignmentMechanicCommandSchema.safeParse({
    reason: readReason(formData),
    mechanic_id: String(formData.get("mechanic_id") ?? "").trim()
  });

  if (!parsed.success) {
    return { ok: false, message: "Cần mã kỹ thuật viên hợp lệ (UUID)." };
  }

  const result = await adminManualAssignServiceRequest(
    session,
    requestId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidateRequest(requestId);
  }
  return toFormState(result);
}

/**
 * Expires a dispatch round.
 *
 * The backend refuses to expire a round that has not expired yet
 * (`Dispatch round has not expired.`), so the form is only offered for a
 * round whose `expires_at` is already in the past.
 */
export async function expireDispatchRoundAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const roundId = String(formData.get("roundId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");

  const parsed = adminDispatchCommandSchema.safeParse({
    reason: readReason(formData)
  });

  if (!parsed.success) {
    return { ok: false, message: "Lý do không hợp lệ." };
  }

  const result = await adminExpireDispatchRound(
    session,
    roundId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidateRequest(requestId);
  }
  return toFormState(result);
}

export async function addAssignmentNoteAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const parsed = adminAssignmentNoteSchema.safeParse({
    reason: readReason(formData),
    note: String(formData.get("note") ?? "").trim()
  });

  if (!parsed.success) {
    return { ok: false, message: "Nội dung ghi chú không được để trống." };
  }

  const result = await adminAddAssignmentNote(
    session,
    assignmentId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath(`/admin/service-requests/${String(formData.get("requestId") ?? "")}`);
  }
  return toFormState(result);
}

/**
 * Resolves a stuck assignment.
 *
 * `investigate` REQUIRES a note (the contract enforces it), and `reassign`
 * requires a mechanic id. The form mirrors both constraints.
 */
export async function resolveStuckAssignmentAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const action = String(formData.get("action") ?? "investigate");

  const parsed = adminAssignmentResolveStuckSchema.safeParse({
    reason: readReason(formData),
    action,
    mechanic_id: String(formData.get("mechanic_id") ?? "").trim() || undefined,
    note: String(formData.get("note") ?? "").trim() || undefined
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        action === "investigate"
          ? "Chế độ điều tra bắt buộc có ghi chú; chế độ đổi kỹ thuật viên cần mã kỹ thuật viên."
          : "Chế độ đổi kỹ thuật viên cần mã kỹ thuật viên hợp lệ (UUID)."
    };
  }

  const result = await adminResolveStuckAssignment(
    session,
    assignmentId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath(`/admin/service-requests/${String(formData.get("requestId") ?? "")}`);
  }
  return toFormState(result);
}
