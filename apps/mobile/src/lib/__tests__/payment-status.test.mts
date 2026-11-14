import assert from "node:assert/strict";
import test from "node:test";

import {
  isFinalStatus,
  isPendingStatus,
  statusLabel,
  type PaymentStatus,
} from "@/lib/payments-service";

/**
 * Contract payment status PHẢI khớp backend
 * (`apps/api/src/features/payments/payment.service.ts` → `PaymentOrderStatus`).
 *
 * Lỗi cũ: FE khai `'paid'` trong khi BE trả `'succeeded'` → màn "thanh toán
 * thành công" không bao giờ hiển thị, và đọc field `paid_at` trong khi BE
 * trả `succeeded_at`.
 */
const ALL_STATUSES: PaymentStatus[] = [
  "created",
  "pending",
  "succeeded",
  "failed",
  "canceled",
  "needs_review",
];

test("mobile không dùng status 'paid' (BE dùng 'succeeded')", () => {
  assert.equal((ALL_STATUSES as string[]).includes("paid"), false);
  assert.equal((ALL_STATUSES as string[]).includes("expired"), false);
});

test("statusLabel map đủ 6 status của BE", () => {
  assert.equal(statusLabel("created"), "Đang tạo");
  assert.equal(statusLabel("pending"), "Chờ thanh toán");
  assert.equal(statusLabel("succeeded"), "Đã thanh toán");
  assert.equal(statusLabel("failed"), "Thất bại");
  assert.equal(statusLabel("canceled"), "Đã huỷ");
  assert.equal(statusLabel("needs_review"), "Cần xem xét");
});

test("isFinalStatus chỉ true khi status đã chốt", () => {
  assert.equal(isFinalStatus("succeeded"), true);
  assert.equal(isFinalStatus("canceled"), true);
  assert.equal(isFinalStatus("failed"), true);

  assert.equal(isFinalStatus("created"), false);
  assert.equal(isFinalStatus("pending"), false);
  assert.equal(isFinalStatus("needs_review"), false);
});

test("isPendingStatus chỉ true khi còn chờ provider xác nhận", () => {
  assert.equal(isPendingStatus("created"), true);
  assert.equal(isPendingStatus("pending"), true);

  assert.equal(isPendingStatus("succeeded"), false);
  assert.equal(isPendingStatus("canceled"), false);
  assert.equal(isPendingStatus("failed"), false);
  assert.equal(isPendingStatus("needs_review"), false);
});

test("mọi status đều có label và không trùng nhau", () => {
  const labels = ALL_STATUSES.map((s) => statusLabel(s));
  assert.equal(new Set(labels).size, ALL_STATUSES.length);
  for (const label of labels) {
    assert.ok(label.length > 0);
    assert.notEqual(label, "s");
  }
});

test("final và pending không chồng lấn", () => {
  for (const status of ALL_STATUSES) {
    assert.equal(
      isFinalStatus(status) && isPendingStatus(status),
      false,
      `status ${status} không được vừa final vừa pending`,
    );
  }
});

test("failure_code không ảnh hưởng phân loại status", () => {
  // `failure_code` chỉ là metadata của BE, không được đổi cách app poll.
  // Đơn `failed` + `failure_code` = `EXPIRED` vẫn là final → app dừng poll
  // và hiện nhánh "Huỷ đơn & tạo lại".
  const failedWithCode = { status: "failed" as const, failure_code: "EXPIRED" };
  assert.equal(isFinalStatus(failedWithCode.status), true);
  assert.equal(isPendingStatus(failedWithCode.status), false);

  // `needs_review` + failure_code vẫn không được coi là pending/final.
  const reviewWithCode = {
    status: "needs_review" as const,
    failure_code: "AMOUNT_MISMATCH",
  };
  assert.equal(isFinalStatus(reviewWithCode.status), false);
  assert.equal(isPendingStatus(reviewWithCode.status), false);
});
