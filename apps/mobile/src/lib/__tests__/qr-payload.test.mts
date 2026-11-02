import assert from "node:assert/strict";
import test from "node:test";

import {
  buildQrMatrix,
  buildQrPath,
  buildQrPathFromPayload,
  canRenderQrCode,
  isEmvcoPayload,
  isImageUrl,
  utf8Bytes,
} from "@/lib/qr-payload";

/**
 * Payload VietQR thật do payOS trả về (EMVCo, ~120 byte).
 * Nguồn: `plan_subscriptions.qr_code` / `payment_orders.qr_code` sau khi
 * gọi `POST https://api.payos.vn/v2/payment-requests`.
 */
const VIETQR_PAYLOAD =
  "00020101021238570010A000000727012700069704220113VQRQANGTG42460208QRIBFTTA53037045405100005802VN62130809GOP10000263040313";

test("isImageUrl phân biệt URL ảnh với payload EMVCo", () => {
  assert.equal(isImageUrl(VIETQR_PAYLOAD), false);
  assert.equal(isImageUrl("https://example.com/qr.png"), true);
  assert.equal(isImageUrl("data:image/png;base64,AAAA"), true);
  assert.equal(isImageUrl("  https://example.com/qr.png  "), true);
});

test("isEmvcoPayload nhận diện payload VietQR", () => {
  assert.equal(isEmvcoPayload(VIETQR_PAYLOAD), true);
  assert.equal(isEmvcoPayload("000201"), true);
  assert.equal(isEmvcoPayload("https://example.com/qr.png"), false);
});

test("utf8Bytes encode ASCII 1 byte/ký tự", () => {
  const bytes = utf8Bytes("AB");
  assert.equal(bytes.length, 2);
  assert.equal(bytes[0], 65);
  assert.equal(bytes[1], 66);
});

test("utf8Bytes encode ký tự multi-byte đúng chuẩn UTF-8", () => {
  // "é" = U+00E9 → 2 byte: C3 A9
  assert.deepEqual(Array.from(utf8Bytes("é")), [0xc3, 0xa9]);
  // "₫" (U+20AB) → 3 byte: E2 82 AB
  assert.deepEqual(Array.from(utf8Bytes("₫")), [0xe2, 0x82, 0xab]);
  // Emoji (U+1F600) → 4 byte: F0 9F 98 80
  assert.deepEqual(Array.from(utf8Bytes("\u{1f600}")), [0xf0, 0x9f, 0x98, 0x80]);
});

test("buildQrMatrix sinh ma trận QR hợp lệ cho payload VietQR", () => {
  const matrix = buildQrMatrix(VIETQR_PAYLOAD);
  assert.ok(matrix);
  // Kích thước ma trận QR luôn là 4*version+17 (>= 21).
  assert.ok(matrix.size >= 21);
  assert.equal(matrix.size % 4, 1);
  assert.equal(matrix.modules.length, matrix.size * matrix.size);
  // Ma trận có cả module đen và module trắng.
  const dark = matrix.modules.reduce((sum, value) => sum + value, 0);
  assert.ok(dark > 0, "QR phải có module đen");
  assert.ok(dark < matrix.modules.length, "QR phải có module trắng");
});

test("buildQrMatrix trả null cho payload không encode được", () => {
  assert.equal(buildQrMatrix("x".repeat(100000)), null);
});

test("buildQrPath sinh path SVG hợp lệ", () => {
  const matrix = buildQrMatrix(VIETQR_PAYLOAD);
  assert.ok(matrix);
  const path = buildQrPath(matrix);
  assert.ok(path.length > 0);
  assert.ok(path.startsWith("M"));
  // Mỗi lệnh vẽ là 1 hình chữ nhật 1 module cao.
  assert.equal((path.match(/v1h-/g) ?? []).length > 0, true);
});

test("buildQrPathFromPayload trả path + size, hoặc null khi lỗi", () => {
  const ok = buildQrPathFromPayload(VIETQR_PAYLOAD);
  assert.ok(ok);
  assert.ok(ok.path.length > 0);
  assert.ok(ok.size >= 21);
  assert.equal(buildQrPathFromPayload("x".repeat(100000)), null);
});

test("canRenderQrCode quyết định render được hay cần fallback", () => {
  assert.equal(canRenderQrCode(VIETQR_PAYLOAD), true);
  assert.equal(canRenderQrCode("https://example.com/qr.png"), true);
  assert.equal(canRenderQrCode(""), false);
  assert.equal(canRenderQrCode("   "), false);
  assert.equal(canRenderQrCode("x".repeat(100000)), false);
});
