import assert from "node:assert/strict";
import test from "node:test";

import { selectQuoteBundle, type Quote } from "@/lib/quotes-service";

/**
 * Regression test cho lỗi "nút Thanh toán ngay biến mất / push URL rỗng".
 *
 * Sau khi rider duyệt quote, BE không còn quote `pending` nào — active session
 * chỉ giữ quote `approved`. Vì vậy `ActiveSession.approvedQuote` là bắt buộc.
 */
function makeQuote(partial: Partial<Quote> & { id: string; version: number }): Quote {
  return {
    request_id: "req-1",
    assignment_id: "asg-1",
    currency: "VND",
    subtotal_amount: 100_000,
    discount_amount: 0,
    total_amount: 100_000,
    created_by: "mech-1",
    created_at: "2026-01-01T00:00:00.000Z",
    status: "pending",
    lines: [],
    ...partial,
  };
}

test("bundle rỗng trả null cho cả pending lẫn approved", () => {
  const bundle = selectQuoteBundle([]);
  assert.equal(bundle.pending, null);
  assert.equal(bundle.approved, null);
});

test("chỉ quote pending mới được chọn làm pending", () => {
  const bundle = selectQuoteBundle([
    makeQuote({ id: "q1", version: 1, status: "rejected" }),
    makeQuote({ id: "q2", version: 2, status: "pending" }),
    makeQuote({ id: "q3", version: 3, status: "approved" }),
  ]);
  assert.equal(bundle.pending?.id, "q2");
  assert.equal(bundle.approved?.id, "q3");
});

test("chọn version cao nhất khi có nhiều quote cùng trạng thái", () => {
  const bundle = selectQuoteBundle([
    makeQuote({ id: "q1", version: 1, status: "pending" }),
    makeQuote({ id: "q5", version: 5, status: "pending" }),
    makeQuote({ id: "q3", version: 3, status: "pending" }),
  ]);
  assert.equal(bundle.pending?.id, "q5");
});

test("chọn approved version cao nhất", () => {
  const bundle = selectQuoteBundle([
    makeQuote({ id: "q1", version: 1, status: "approved" }),
    makeQuote({ id: "q4", version: 4, status: "approved" }),
  ]);
  assert.equal(bundle.approved?.id, "q4");
});

test("sau khi duyệt thì pending = null và approved khác null", () => {
  // Đây chính là trạng thái gây lỗi: `sr.active.quote` null → nút thanh toán
  // không bấm được và tổng tiền không hiển thị.
  const bundle = selectQuoteBundle([
    makeQuote({ id: "q1", version: 1, status: "approved" }),
  ]);
  assert.equal(bundle.pending, null);
  assert.equal(bundle.approved?.id, "q1");
  assert.equal(bundle.approved?.total_amount, 100_000);
});

test("superseded / expired không được coi là pending hay approved", () => {
  const bundle = selectQuoteBundle([
    makeQuote({ id: "q1", version: 1, status: "superseded" }),
    makeQuote({ id: "q2", version: 2, status: "expired" }),
  ]);
  assert.equal(bundle.pending, null);
  assert.equal(bundle.approved, null);
});
