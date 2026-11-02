"use server";

import { revalidatePath } from "next/cache";

import {
  adminPlanChangeSchema,
  adminRoleMutationSchema
} from "@careonroad/api-contract/admin/users";

import {
  adminArchiveUser,
  adminChangeUserPlan,
  adminGrantUserRole,
  adminReactivateUser,
  adminRevokeDevice,
  adminRevokeUserRole,
  adminSuspendUser
} from "@/lib/api/admin-commands";
import { getAdminSession } from "@/lib/admin/session";

import type { CommandFormState } from "@/components/admin/command-form";

/**
 * Server Actions for the "Người dùng" tab.
 *
 * Each action:
 *  1. reads the idempotency key from the hidden form field (one key per
 *     form, so a retry REPLAYS instead of duplicating),
 *  2. validates the body with the shared contract BEFORE the request,
 *  3. runs the command through the shared runner,
 *  4. returns a plain result the form renders inline.
 *
 * The access token stays on the server — it is never read from the form.
 */

/** Reads and validates the idempotency key sent by the form. */
function readIdempotencyKey(formData: FormData): string {
  const key = String(formData.get("idempotencyKey") ?? "").trim();
  // The backend requires 8–200 characters. An empty key would be rejected
  // with an opaque 400, so it is caught here with a clear message.
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
  code?: string;
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

export async function suspendUserAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const body = { reason: readReason(formData) };

  const result = await adminSuspendUser(
    session,
    String(formData.get("userId") ?? ""),
    body,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/users");
  }
  return toFormState(result);
}

export async function reactivateUserAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const body = { reason: readReason(formData) };

  const result = await adminReactivateUser(
    session,
    String(formData.get("userId") ?? ""),
    body,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/users");
  }
  return toFormState(result);
}

export async function archiveUserAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const body = { reason: readReason(formData) };

  const result = await adminArchiveUser(
    session,
    String(formData.get("userId") ?? ""),
    body,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/users");
  }
  return toFormState(result);
}

/**
 * Grant or extend a rider plan.
 *
 * The `duration` field is only sent for a PAID plan: the backend forbids it
 * for the free plan and requires it otherwise. The contract refine would
 * reject the wrong combination, but the form disables the field so the
 * mismatch cannot be produced in the first place.
 */
export async function changeUserPlanAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const planCode = String(formData.get("plan_code") ?? "free");
  const duration = planCode === "free" ? undefined : "month";

  const parsed = adminPlanChangeSchema.safeParse({
    reason: readReason(formData),
    plan_code: planCode,
    ...(duration ? { duration } : {})
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Gói trả phí bắt buộc có thời hạn 30 ngày; gói miễn phí không được đặt thời hạn."
    };
  }

  const result = await adminChangeUserPlan(
    session,
    String(formData.get("userId") ?? ""),
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/users");
  }
  return toFormState(result);
}

export async function grantUserRoleAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();

  const parsed = adminRoleMutationSchema.safeParse({
    reason: readReason(formData),
    role: String(formData.get("role") ?? "")
  });

  if (!parsed.success) {
    return { ok: false, message: "Vai trò không hợp lệ." };
  }

  const result = await adminGrantUserRole(
    session,
    String(formData.get("userId") ?? ""),
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/users");
  }
  return toFormState(result);
}

export async function revokeUserRoleAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();

  const parsed = adminRoleMutationSchema.safeParse({
    reason: readReason(formData),
    role: String(formData.get("role") ?? "")
  });

  if (!parsed.success) {
    return { ok: false, message: "Vai trò không hợp lệ." };
  }

  const result = await adminRevokeUserRole(
    session,
    String(formData.get("userId") ?? ""),
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/users");
  }
  return toFormState(result);
}

/** Revoke one device of a user (the device id is global, not nested). */
export async function revokeDeviceAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const body = { reason: readReason(formData) };

  const result = await adminRevokeDevice(
    session,
    String(formData.get("deviceId") ?? ""),
    body,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/users");
  }
  return toFormState(result);
}
