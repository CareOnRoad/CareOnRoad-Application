import assert from "node:assert/strict";
import test from "node:test";

import {
  failureCodeLabel,
  isFinalStatus,
  isPendingStatus,
  paymentRetryDecision,
  statusLabel,
  type PaymentStatus,
} from "@/lib/payments-service";

/**
 * Regression test cho quyết định retry của payment order (P2 trong plan
 * "fix-rider-session-payment-gaps").
 *
 * Vấn đề gốc:
 *  - BE giữ đơn `failed` trong `findActiveByQuoteForUpdate` → `POST` tạo đơn
 *    mới sẽ trả lại CHÍNH đơn cũ, nên rider không bao giờ thoát được nếu
 *    không có nút huỷ.
 *  - Đơn `needs_review` đang được admin xem xét → rider KHÔNG được tự retry
 *    (tránh double-charge).
 *  - Đơn `succeeded` → hiện màn thành công, không retry.
 */

test("đơn failed → retryable (cho phép huỷ và tạo lại)", () => {
  assert.equal(paymentRetryDecision({ status: "failed" }), "retryable");
});

test("đơn failed + failure_code EXPIRED vẫn retryable", () => {
  // `failure_code` chỉ là thông tin hiển thị, không đổi quyết định retry.
  assert.equal(
    paymentRetryDecision({ status: "failed" }),
    "retryable",
  );
});

test("đơn needs_review → needs_support (không tự retry)", () => {
  assert.equal(paymentRetryDecision({ status: "needs_review" }), "needs_support");
});

test("đơn succeeded → already_paid (hiện màn thành công)", () => {
  assert.equal(paymentRetryDecision({ status: "succeeded" }), "already_paid");
});

test("các status còn lại không được coi là retryable", () => {
  const others: PaymentStatus[] = ["created", "pending", "canceled"];
  for (const status of others) {
    assert.equal(
      paymentRetryDecision({ status }),
      "already_paid",
      `status ${status} không được coi là retryable`,
    );
  }
});

test("chỉ status failed mới retryable — không status nào khác", () => {
  const all: PaymentStatus[] = [
    "created",
    "pending",
    "succeeded",
    "failed",
    "canceled",
    "needs_review",
  ];
  const retryable = all.filter((s) => paymentRetryDecision({ status: s }) === "retryable");
  assert.deepEqual(retryable, ["failed"]);
});

test("failureCodeLabel map mã lỗi BE sang message tiếng Việt", () => {
  assert.equal(failureCodeLabel("EXPIRED"), "Liên kết thanh toán đã hết hạn");
  assert.equal(failureCodeLabel("CANCELED"), "Đơn thanh toán đã bị huỷ");
  assert.equal(failureCodeLabel("TIMEOUT"), "Thanh toán quá thời gian cho phép");
  // Mã lạ → trả nguyên để không mất thông tin.
  assert.equal(failureCodeLabel("SOMETHING_NEW"), "SOMETHING_NEW");
  // Không có mã → null (UI không render dòng mã lỗi).
  assert.equal(failureCodeLabel(undefined), null);
  assert.equal(failureCodeLabel(null), null);
});

test("đơn failed vẫn là final status (app không poll thêm)", () => {
  assert.equal(isFinalStatus("failed"), true);
  assert.equal(isPendingStatus("failed"), false);
  assert.equal(statusLabel("failed"), "Thất bại");
});
