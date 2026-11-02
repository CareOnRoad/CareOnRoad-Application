"use server";

import { revalidatePath } from "next/cache";

import {
  adminAssignmentCancelSchema,
  adminAssignmentMechanicCommandSchema,
  adminAssignmentNoteSchema,
  adminAssignmentResolveStuckSchema
} from "@careonroad/api-contract/admin/assignments";

import {
  adminAddAssignmentNote,
  adminCancelAssignment,
  adminReassignAssignment,
  adminResolveStuckAssignment
} from "@/lib/api/admin-commands";
import { getAdminSession } from "@/lib/admin/session";

import type { CommandFormState } from "@/components/admin/command-form";

/**
 * Server Actions for the "Điều phối" tab (assignment commands).
 *
 * The backend guards these with the assignment state machine:
 *
 *  - `cancel` requires the request to be in the matching state and the
 *    assignment to have no commitment (no issued quote, no labour agreement,
 *    no unresolved payment);
 *  - `reassign` requires the assignment to be `accepted` or `en_route`, and
 *    refuses the SAME mechanic (`same_mechanic`);
 *  - `resolve_stuck` with `investigate` REQUIRES a note.
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

function revalidate(assignmentId: string, requestId?: string) {
  revalidatePath(`/admin/assignments/${assignmentId}`);
  if (requestId) {
    revalidatePath(`/admin/service-requests/${requestId}`);
  }
}

export async function cancelAssignmentAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const parsed = adminAssignmentCancelSchema.safeParse({
    reason: readReason(formData)
  });
  if (!parsed.success) {
    return { ok: false, message: "Lý do không hợp lệ." };
  }

  const result = await adminCancelAssignment(
    session,
    assignmentId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidate(assignmentId, String(formData.get("requestId") ?? ""));
  }
  return toFormState(result);
}

/**
 * Adds an internal note to an assignment.
 *
 * Notes are APPEND-ONLY: they are written to a dedicated table and to the
 * audit log, never overwriting an existing record.
 */
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
    revalidate(assignmentId, String(formData.get("requestId") ?? ""));
  }
  return toFormState(result);
}

/**
 * Reassigns an assignment to another mechanic.
 *
 * The previous assignment is marked `recovery_canceled` — the history is
 * preserved, never deleted.
 */
export async function reassignAssignmentAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const parsed = adminAssignmentMechanicCommandSchema.safeParse({
    reason: readReason(formData),
    mechanic_id: String(formData.get("mechanic_id") ?? "").trim()
  });
  if (!parsed.success) {
    return { ok: false, message: "Cần mã kỹ thuật viên hợp lệ (UUID)." };
  }

  const result = await adminReassignAssignment(
    session,
    assignmentId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidate(assignmentId, String(formData.get("requestId") ?? ""));
  }
  return toFormState(result);
}

/**
 * Resolves a stuck assignment.
 *
 * `investigate` REQUIRES a note; `reassign` requires a mechanic id;
 * `cancel` requires neither. The contract enforces all three.
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
          ? "Chế độ điều tra bắt buộc có ghi chú."
          : action === "reassign"
            ? "Chế độ đổi kỹ thuật viên cần mã kỹ thuật viên hợp lệ (UUID)."
            : "Lý do không hợp lệ."
    };
  }

  const result = await adminResolveStuckAssignment(
    session,
    assignmentId,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidate(assignmentId, String(formData.get("requestId") ?? ""));
  }
  return toFormState(result);
}
