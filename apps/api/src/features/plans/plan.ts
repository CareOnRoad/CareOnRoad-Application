export const planCodes = ["free", "advance", "vip"] as const;
export type PlanCode = (typeof planCodes)[number];

/** Gói trả phí. `free` là gói mặc định và không thể mua. */
export type PaidPlanCode = Exclude<PlanCode, "free">;

// undefined planCode/planExpiresAt means the holder is on the free plan.
export type PlanHolder = { planCode?: PlanCode; planExpiresAt?: Date };

const planRank: Record<PlanCode, number> = { free: 0, advance: 1, vip: 2 };
const DAY_MS = 24 * 60 * 60 * 1000;

/** Chu kỳ thanh toán của mọi gói trả phí. Không có gói năm. */
export const PLAN_PERIOD_DAYS = 30;

export function effectivePlan(holder: PlanHolder, now: Date): PlanCode {
  return holder.planCode &&
    holder.planExpiresAt &&
    holder.planExpiresAt.getTime() > now.getTime()
    ? holder.planCode
    : "free";
}

export function hasPlan(holder: PlanHolder, minimum: PlanCode, now: Date): boolean {
  return planRank[effectivePlan(holder, now)] >= planRank[minimum];
}

/** Thứ hạng gói: free < advance < vip. */
export function planRankOf(plan: PlanCode): number {
  return planRank[plan];
}

/**
 * So sánh 2 gói: -1 khi `left` thấp hơn, 0 khi bằng, 1 khi `left` cao hơn.
 * Dùng để chặn hạ cấp (mua gói thấp hơn gói đang có).
 */
export function comparePlans(left: PlanCode, right: PlanCode): -1 | 0 | 1 {
  const difference = planRank[left] - planRank[right];
  if (difference < 0) return -1;
  if (difference > 0) return 1;
  return 0;
}

/**
 * Ngày hết hạn khi admin cấp/gia hạn gói trả phí.
 *
 * Gia hạn đúng gói đang hiệu lực → nối tiếp từ ngày hết hạn hiện tại.
 * Đổi gói khác → tính từ thời điểm hiện tại.
 */
export function nextPlanExpiry(
  holder: PlanHolder,
  plan: PaidPlanCode,
  now: Date
): Date {
  const base =
    effectivePlan(holder, now) === plan && holder.planExpiresAt ? holder.planExpiresAt : now;
  return new Date(base.getTime() + PLAN_PERIOD_DAYS * DAY_MS);
}

/**
 * Ngày hết hạn khi người dùng tự mua/gia hạn gói trả phí.
 *
 * Ngày còn dư của gói hiện tại được cộng dồn vào chu kỳ mới:
 * `new_expiry = max(current_expiry, now) + 30 ngày`.
 */
export function planExpiryAfterPurchase(
  holder: PlanHolder,
  plan: PaidPlanCode,
  now: Date
): Date {
  const currentExpiry = holder.planExpiresAt && holder.planExpiresAt.getTime() > now.getTime()
    ? holder.planExpiresAt
    : undefined;
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return new Date(base.getTime() + PLAN_PERIOD_DAYS * DAY_MS);
}

export function planRequiredDetails(required: PaidPlanCode): {
  reason: "plan_required";
  required_plan: PaidPlanCode;
} {
  return { reason: "plan_required", required_plan: required };
}
