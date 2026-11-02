"use server";

import { revalidatePath } from "next/cache";

import {
  adminDispatchConfigurationUpdateSchema,
  isDispatchPolicyUpdateValid,
  type AdminDispatchPolicyShape
} from "@careonroad/api-contract/admin/configuration";

import { adminUpdateDispatchConfiguration } from "@/lib/api/admin-commands";
import { getAdminSession } from "@/lib/admin/session";

import type { CommandFormState } from "@/components/admin/command-form";

/**
 * Server Actions for the "Cấu hình" tab.
 *
 * The dispatch policy update changes LIVE behaviour, but only for NEW
 * dispatch episodes — running episodes keep the policy they started with.
 * The action therefore validates the merged policy against the same rules
 * the backend enforces (`isDispatchPolicyUpdateValid`):
 *
 *  - the radius steps must stay strictly ascending;
 *  - the total wait must cover at least one offer window.
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
    return { ok: true, message: "Cấu hình đã được cập nhật." };
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
    message: result.message ?? "Cập nhật thất bại.",
    reason
  };
}

/**
 * The current policy, passed by the page so the action can validate the
 * merged result without an extra round trip.
 */
export async function updateDispatchConfigurationAction(
  _previous: CommandFormState,
  formData: FormData,
  current: AdminDispatchPolicyShape
): Promise<CommandFormState> {
  const { session } = await getAdminSession();

  const radiusSteps = String(formData.get("radius_steps_km") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

  const update: Partial<AdminDispatchPolicyShape> = {
    "dispatch.radius_steps_km": radiusSteps.length > 0 ? radiusSteps : undefined,
    "dispatch.offer_expiry_seconds":
      Number(formData.get("offer_expiry_seconds")) || undefined,
    "dispatch.max_rounds": Number(formData.get("max_rounds")) || undefined,
    "dispatch.total_wait_seconds":
      Number(formData.get("total_wait_seconds")) || undefined
  };

  for (const key of Object.keys(update) as (keyof AdminDispatchPolicyShape)[]) {
    if (update[key] === undefined) {
      delete update[key];
    }
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, message: "Cần ít nhất một giá trị để cập nhật." };
  }

  if (!isDispatchPolicyUpdateValid(current, update)) {
    return {
      ok: false,
      message:
        "Cấu hình không hợp lệ: các bán kính phải tăng dần và tổng thời gian chờ phải đủ cho một cửa sổ đề nghị."
    };
  }

  const parsed = adminDispatchConfigurationUpdateSchema.safeParse({
    reason: readReason(formData),
    values: update
  });

  if (!parsed.success) {
    return { ok: false, message: "Cấu hình không hợp lệ theo giới hạn của hệ thống." };
  }

  const result = await adminUpdateDispatchConfiguration(
    session,
    parsed.data,
    readIdempotencyKey(formData)
  );

  if (result.ok) {
    revalidatePath("/admin/configuration");
  }
  return toFormState(result);
}
