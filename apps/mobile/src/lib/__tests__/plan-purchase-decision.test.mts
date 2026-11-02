import assert from "node:assert/strict";
import test from "node:test";

import {
  planPurchaseDecision,
  planRank,
  type PlanCode,
} from "@/lib/subscriptions-service";

/**
 * Quy tắc mua gói trên mobile PHẢI khớp với backend
 * (`apps/api/src/features/subscriptions/subscription.service.ts`):
 *
 *  - Gói thấp hơn gói hiện tại → bị chặn (`downgrade_blocked`, HTTP 409).
 *  - Gói bằng gói hiện tại → gia hạn (số ngày còn dư được cộng dồn).
 *  - Gói cao hơn → nâng cấp.
 *
 * Trước đây UI chặn luôn gói đang dùng ("Gói hiện tại" disabled), khiến
 * người dùng không gia hạn được gói đang hiệu lực.
 */
test("planRank orders free < advance < vip", () => {
  assert.ok(planRank("free") < planRank("advance"));
  assert.ok(planRank("advance") < planRank("vip"));
});

test("a free rider can purchase advance or vip", () => {
  assert.equal(planPurchaseDecision("free", "advance"), "purchase");
  assert.equal(planPurchaseDecision("free", "vip"), "purchase");
});

test("the free plan is never purchasable", () => {
  assert.equal(planPurchaseDecision("free", "free"), "not_purchasable");
  assert.equal(planPurchaseDecision("advance", "free"), "not_purchasable");
  assert.equal(planPurchaseDecision("vip", "free"), "not_purchasable");
});

test("buying the same plan is a renewal, not a downgrade", () => {
  assert.equal(planPurchaseDecision("advance", "advance"), "renewal");
  assert.equal(planPurchaseDecision("vip", "vip"), "renewal");
});

test("buying a higher plan is an upgrade", () => {
  assert.equal(planPurchaseDecision("advance", "vip"), "upgrade");
});

test("buying a lower plan is blocked as a downgrade", () => {
  assert.equal(planPurchaseDecision("vip", "advance"), "downgrade");
  assert.equal(planPurchaseDecision("advance", "free"), "not_purchasable");
});

test("every decision stays inside the known set", () => {
  const plans: PlanCode[] = ["free", "advance", "vip"];
  const allowed = new Set([
    "purchase",
    "renewal",
    "upgrade",
    "downgrade",
    "not_purchasable",
  ]);

  for (const current of plans) {
    for (const target of plans) {
      assert.ok(allowed.has(planPurchaseDecision(current, target)));
    }
  }
});
