"use client";

import { useState } from "react";

import {
  CommandForm,
  type CommandFormState
} from "@/components/admin/command-form";

import type { AdminPlanCode } from "@careonroad/api-contract/admin/users";

/**
 * The plan change form for one user.
 *
 * The `duration` field is only sent for a PAID plan (R3): the backend writes
 * both `app_users` and `plan_subscriptions`, and the `plan_subscriptions`
 * constraints require a 30-day period for a paid plan and forbid it for the
 * free plan. The field is therefore disabled for the free plan, so the
 * invalid combination cannot be produced at all.
 */
export function UserPlanForm({
  userId,
  currentPlan,
  action
}: {
  userId: string;
  currentPlan: AdminPlanCode;
  action: (previous: CommandFormState, formData: FormData) => Promise<CommandFormState>;
}) {
  const [planCode, setPlanCode] = useState<AdminPlanCode>(currentPlan);
  const isFree = planCode === "free";

  return (
    <CommandForm
      action={action}
      label="Lưu gói"
      confirmText="Cập nhật gói"
      description="Gói trả phí có thời hạn 30 ngày. Gói miễn phí thu hồi quyền dịch vụ trả phí nhưng không xoá dữ liệu."
    >
      <input type="hidden" name="userId" value={userId} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#3d4d63" }}
          >
            Gói
          </span>
          <select
            name="plan_code"
            value={planCode}
            onChange={(event) => setPlanCode(event.target.value as AdminPlanCode)}
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              border: "1px solid #e5e9ef",
              backgroundColor: "#fff",
              color: "#162130"
            }}
          >
            <option value="free">Miễn phí (free)</option>
            <option value="advance">Nâng cao (advance)</option>
            <option value="vip">VIP</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#3d4d63" }}
          >
            Thời hạn
          </span>
          <select
            name="duration"
            disabled={isFree}
            defaultValue="month"
            className="rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            style={{
              border: "1px solid #e5e9ef",
              backgroundColor: isFree ? "#f3f5f8" : "#fff",
              color: "#162130"
            }}
          >
            <option value="month">30 ngày</option>
          </select>
        </label>
      </div>

      {isFree ? (
        <p className="text-[11px]" style={{ color: "#6b7a8d" }}>
          Gói miễn phí không được đặt thời hạn — trường này bị vô hiệu hoá và sẽ không
          được gửi lên.
        </p>
      ) : null}
    </CommandForm>
  );
}
