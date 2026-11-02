import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedReturnUrl } from "@/lib/deep-link";

/**
 * Regression test cho lỗi "quay lại 1 trang Google rỗng" sau khi thanh toán.
 *
 * Bối cảnh: `PAYOS_RETURN_URL` trỏ tới endpoint health-check trả JSON, nên
 * payOS đưa người dùng tới một trang trống thay vì quay lại app. Cách sửa:
 * mobile gửi deep-link làm `return_url` / `cancel_url` cho payOS.
 *
 * Backend (`apps/api/src/features/subscriptions/subscription.schemas.ts`) chỉ
 * nhận scheme `careonroad`, `exp`, `exps` — allowlist phải khớp chính xác,
 * nếu lệch thì backend trả 400 và người dùng không mua được gói.
 */
test("deep-link scheme của app được chấp nhận", () => {
  assert.equal(isAllowedReturnUrl("careonroad://rider/plans"), true);
  assert.equal(isAllowedReturnUrl("exp://127.0.0.1:8081/--/rider/plans"), true);
  assert.equal(isAllowedReturnUrl("exps://127.0.0.1:8081/--/rider/plans"), true);
});

test("scheme viết hoa vẫn được chấp nhận", () => {
  assert.equal(isAllowedReturnUrl("CareOnRoad://rider/plans"), true);
  assert.equal(isAllowedReturnUrl("EXP://127.0.0.1:8081/--/rider/plans"), true);
});

test("URL web bị từ chối (đó chính là nguồn của trang trống)", () => {
  assert.equal(isAllowedReturnUrl("https://careonroad.dpdns.org/api/v1/internal/health/live"), false);
  assert.equal(isAllowedReturnUrl("http://example.test/plans"), false);
});

test("scheme lạ bị từ chối", () => {
  assert.equal(isAllowedReturnUrl("javascript://alert(1)"), false);
  assert.equal(isAllowedReturnUrl("intent://rider/plans"), false);
  assert.equal(isAllowedReturnUrl("ftp://example.test"), false);
});

test("giá trị rỗng / không phải chuỗi bị từ chối", () => {
  assert.equal(isAllowedReturnUrl(""), false);
  assert.equal(isAllowedReturnUrl("   "), false);
  assert.equal(isAllowedReturnUrl(undefined), false);
  assert.equal(isAllowedReturnUrl(null), false);
  assert.equal(isAllowedReturnUrl(42), false);
});

test("URL không có '://' bị từ chối", () => {
  assert.equal(isAllowedReturnUrl("careonroad:rider/plans"), false);
  assert.equal(isAllowedReturnUrl("//rider/plans"), false);
});
