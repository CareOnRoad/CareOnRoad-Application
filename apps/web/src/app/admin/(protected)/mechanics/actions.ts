"use server";

import { revalidatePath } from "next/cache";

import {
  adminMechanicRadiusMutationSchema,
  adminMechanicSkillsMutationSchema
} from "@careonroad/api-contract/admin/mechanics";

import {
  adminChangeMechanicStatus,
  adminForceMechanicUnavailable,
  adminUpdateMechanicServiceRadius,
  adminUpdateMechanicSkills
} from "@/lib/api/admin-commands";
import { getAdminSession } from "@/lib/admin/session";

import type { CommandFormState } from "@/components/admin/command-form";

/**
 * Server Actions for the "Kỹ thuật viên" tab.
 *
 * The mechanic commands write to `mechanic_profiles` and the audit/outbox
 * tables. They are append-only in the audit trail — the profile row itself is
 * updated in place, which is why every command still requires a `reason`.
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

type MechanicStatusAction = "approve" | "reject" | "suspend" | "ban" | "reactivate";

export async function changeMechanicStatusAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const action = String(formData.get("action") ?? "") as MechanicStatusAction;
  const mechanicId = String(formData.get("mechanicId") ?? "");

  const result = await adminChangeMechanicStatus(
    session,
    mechanicId,
    action,
    { reason: readReason(formData) },
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/mechanics");
  }
  return toFormState(result);
}

/**
 * Force a mechanic off the roster.
 *
 * The endpoint only accepts a `reason` — it unconditionally marks the
 * mechanic unavailable. There is NO "restore availability" admin command:
 * availability is owned by the mechanic through `/mechanics/me/availability`,
 * so the UI must not imply one exists.
 */
export async function forceMechanicUnavailableAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();

  const result = await adminForceMechanicUnavailable(
    session,
    String(formData.get("mechanicId") ?? ""),
    { reason: readReason(formData) },
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/mechanics");
  }
  return toFormState(result);
}

/**
 * Replace the service types of a mechanic.
 *
 * The backend replaces the whole set (it is not an add/remove operation), so
 * the form sends every checked service type.
 */
export async function updateMechanicSkillsAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();

  const serviceTypes = formData
    .getAll("service_types")
    .map((value) => String(value))
    .filter(Boolean);

  const parsed = adminMechanicSkillsMutationSchema.safeParse({
    reason: readReason(formData),
    service_types: serviceTypes
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Chọn ít nhất một loại dịch vụ để cập nhật kỹ năng."
    };
  }

  const result = await adminUpdateMechanicSkills(
    session,
    String(formData.get("mechanicId") ?? ""),
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/mechanics");
  }
  return toFormState(result);
}

/**
 * Update the service radius.
 *
 * The backend bounds the radius to `(0, 100]` km, which the contract mirror
 * enforces before the request is sent.
 */
export async function updateMechanicServiceRadiusAction(
  _previous: CommandFormState,
  formData: FormData
): Promise<CommandFormState> {
  const { session } = await getAdminSession();
  const raw = Number(formData.get("service_radius_km"));

  const parsed = adminMechanicRadiusMutationSchema.safeParse({
    reason: readReason(formData),
    service_radius_km: raw
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Bán kính phục vụ phải lớn hơn 0 và không vượt quá 100 km."
    };
  }

  const result = await adminUpdateMechanicServiceRadius(
    session,
    String(formData.get("mechanicId") ?? ""),
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/mechanics");
  }
  return toFormState(result);
}
