export const planCodes = ["free", "advance", "vip"] as const;
export type PlanCode = (typeof planCodes)[number];

// undefined planCode/planExpiresAt means the holder is on the free plan.
export type PlanHolder = { planCode?: PlanCode; planExpiresAt?: Date };

const planRank: Record<PlanCode, number> = { free: 0, advance: 1, vip: 2 };
const DAY_MS = 24 * 60 * 60 * 1000;

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

export function nextPlanExpiry(
  holder: PlanHolder,
  plan: "advance" | "vip",
  duration: "month" | "year",
  now: Date
): Date {
  // Renewing the same active plan extends from its expiry; anything else starts now.
  const base =
    effectivePlan(holder, now) === plan && holder.planExpiresAt ? holder.planExpiresAt : now;
  return new Date(base.getTime() + (duration === "month" ? 30 : 365) * DAY_MS);
}

export function planRequiredDetails(required: "advance" | "vip"): {
  reason: "plan_required";
  required_plan: "advance" | "vip";
} {
  return { reason: "plan_required", required_plan: required };
}
