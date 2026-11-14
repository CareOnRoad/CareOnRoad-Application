import assert from "node:assert/strict";
import test from "node:test";

import {
  hasAdvancePlan,
  hasVipPlan,
  isPlanRequiredError,
  planRank,
  planRequiredMessage,
  planRequiredMessageFor,
  planRequiredOf,
  planSatisfies,
} from "@/lib/plan-gate";
import { ApiError } from "@/lib/api";

/**
 * Quy tắc khoá tính năng theo gói PHẢI khớp backend
 * (`apps/api/src/features/plans/plan.ts` → `hasPlan`):
 *  - free < advance < vip.
 *  - Gói cao có đủ quyền gói thấp (D4).
 *  - Thiếu gói → 403 `FORBIDDEN` + `details.reason = "plan_required"`
 *    + `details.required_plan` (D15).
 */
test("planRank đúng thứ tự free < advance < vip", () => {
  assert.ok(planRank("free") < planRank("advance"));
  assert.ok(planRank("advance") < planRank("vip"));
  assert.equal(planRank(undefined), 0);
  assert.equal(planRank(null), 0);
});

test("free không đạt yêu cầu advance/vip", () => {
  assert.equal(planSatisfies("free", "advance"), false);
  assert.equal(planSatisfies("free", "vip"), false);
  assert.equal(hasAdvancePlan("free"), false);
  assert.equal(hasVipPlan("free"), false);
});

test("advance đạt yêu cầu advance nhưng không đạt vip", () => {
  assert.equal(planSatisfies("advance", "advance"), true);
  assert.equal(planSatisfies("advance", "vip"), false);
  assert.equal(hasAdvancePlan("advance"), true);
  assert.equal(hasVipPlan("advance"), false);
});

test("vip có đủ quyền của cả advance và vip", () => {
  assert.equal(planSatisfies("vip", "advance"), true);
  assert.equal(planSatisfies("vip", "vip"), true);
  assert.equal(hasAdvancePlan("vip"), true);
  assert.equal(hasVipPlan("vip"), true);
});

test("gói không xác định (= free) không mở được tính năng trả phí", () => {
  assert.equal(planSatisfies(undefined, "advance"), false);
  assert.equal(planSatisfies(null, "vip"), false);
});

function planError(required: "advance" | "vip", status = 403): ApiError {
  return new ApiError(status, "FORBIDDEN", "A higher plan is required.", {
    reason: "plan_required",
    required_plan: required,
  });
}

test("nhận diện lỗi thiếu gói", () => {
  assert.equal(isPlanRequiredError(planError("vip")), true);
  assert.equal(planRequiredOf(planError("advance")), "advance");
  assert.equal(planRequiredOf(planError("vip")), "vip");
});

test("403 nhưng không phải plan_required thì không phải lỗi thiếu gói", () => {
  const forbidden = new ApiError(403, "FORBIDDEN", "Không có quyền.");
  assert.equal(isPlanRequiredError(forbidden), false);
  assert.equal(planRequiredOf(forbidden), null);
});

test("lỗi khác status không phải lỗi thiếu gói", () => {
  assert.equal(isPlanRequiredError(planError("vip", 400)), false);
});

test("lỗi không phải ApiError thì bỏ qua", () => {
  assert.equal(isPlanRequiredError(new Error("boom")), false);
  assert.equal(isPlanRequiredError(undefined), false);
});

test("message tiếng Việt cho từng gói", () => {
  assert.match(planRequiredMessage("advance"), /Advance/);
  assert.match(planRequiredMessage("vip"), /VIP/);
  assert.equal(planRequiredMessageFor(planError("vip")), planRequiredMessage("vip"));
  assert.equal(planRequiredMessageFor(new Error("boom")), null);
});
