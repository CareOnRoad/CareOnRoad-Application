import assert from "node:assert/strict";
import test from "node:test";

import {
  isQuotePayableNow,
  requiresPaymentTiming,
  type Quote,
} from "@/lib/quotes-service";

/**
 * Regression test cho workflow nhiều bước (cứu hộ / bảo dưỡng).
 *
 * BE (`payment.service.ts` → `createPaymentOrder`) chỉ cho tạo payment order
 * khi quote approved VÀ đúng trạng thái assignment:
 *  - `rescue_labor` chỉ payable khi rider chọn `labor_upfront`
 *    (assignment `accepted`, request `assigned`).
 *  - `maintenance_labor` KHÔNG bao giờ payable — tiền công được gộp vào
 *    báo giá vật tư `maintenance_work`.
 *  - Các quote còn lại chỉ payable khi assignment `awaiting_payment`.
 */
function makeQuote(partial: Partial<Quote> & { id: string }): Quote {
  return {
    request_id: "req-1",
    assignment_id: "asg-1",
    version: 1,
    currency: "VND",
    subtotal_amount: 100_000,
    discount_amount: 0,
    total_amount: 100_000,
    created_by: "mech-1",
    created_at: "2026-01-01T00:00:00.000Z",
    status: "approved",
    lines: [],
    ...partial,
  };
}

test("chỉ quote rescue_labor mới bắt buộc chọn payment_timing", () => {
  assert.equal(requiresPaymentTiming(makeQuote({ id: "q1", purpose: "rescue_labor" })), true);
  assert.equal(requiresPaymentTiming(makeQuote({ id: "q2", purpose: "standard" })), false);
  assert.equal(requiresPaymentTiming(makeQuote({ id: "q3", purpose: "rescue_final" })), false);
  assert.equal(requiresPaymentTiming(makeQuote({ id: "q4", purpose: "maintenance_labor" })), false);
  assert.equal(requiresPaymentTiming(makeQuote({ id: "q5", purpose: "maintenance_work" })), false);
  assert.equal(requiresPaymentTiming(null), false);
  assert.equal(requiresPaymentTiming(undefined), false);
});

test("quote chưa approved thì không payable", () => {
  const pending = makeQuote({ id: "q1", status: "pending", purpose: "standard" });
  assert.equal(isQuotePayableNow(pending, { assignmentStatus: "awaiting_payment" }), false);
});

test("rescue_labor chỉ payable với labor_upfront + assignment accepted", () => {
  const labor = makeQuote({ id: "q1", purpose: "rescue_labor" });
  assert.equal(
    isQuotePayableNow(labor, { paymentTiming: "labor_upfront", assignmentStatus: "accepted" }),
    true,
  );
  // Rider chọn trả sau khi sửa → chưa được thanh toán tiền công.
  assert.equal(
    isQuotePayableNow(labor, { paymentTiming: "after_repair", assignmentStatus: "accepted" }),
    false,
  );
  // Đã sang bước khác thì không payable nữa.
  assert.equal(
    isQuotePayableNow(labor, { paymentTiming: "labor_upfront", assignmentStatus: "awaiting_payment" }),
    false,
  );
});

test("maintenance_labor không bao giờ payable", () => {
  const labor = makeQuote({ id: "q2", purpose: "maintenance_labor" });
  assert.equal(
    isQuotePayableNow(labor, { paymentTiming: "after_service", assignmentStatus: "awaiting_payment" }),
    false,
  );
});

test("maintenance_work / rescue_final chỉ payable khi assignment awaiting_payment", () => {
  const work = makeQuote({ id: "q3", purpose: "maintenance_work" });
  assert.equal(
    isQuotePayableNow(work, { paymentTiming: "after_service", assignmentStatus: "awaiting_payment" }),
    true,
  );
  assert.equal(
    isQuotePayableNow(work, { paymentTiming: "after_service", assignmentStatus: "diagnosis" }),
    false,
  );

  const final = makeQuote({ id: "q4", purpose: "rescue_final" });
  assert.equal(
    isQuotePayableNow(final, { paymentTiming: "after_repair", assignmentStatus: "awaiting_payment" }),
    true,
  );
});

test("quote standard (không khai purpose) payable khi awaiting_payment", () => {
  const standard = makeQuote({ id: "q5" });
  assert.equal(isQuotePayableNow(standard, { assignmentStatus: "awaiting_payment" }), true);
  assert.equal(isQuotePayableNow(standard, { assignmentStatus: "diagnosis" }), false);
});
