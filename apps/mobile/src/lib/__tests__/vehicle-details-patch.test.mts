import assert from "node:assert/strict";
import test from "node:test";

import {
  detailsToFormState,
  emptyDetailsFormState,
  formStateToDetailsPatch,
  isFutureIsoDate,
  isValidPurchasePrice,
} from "@/lib/vehicle-details";
import type { MotorcycleDetails } from "@/lib/types";

/**
 * Ngữ nghĩa partial-update của `PATCH /api/v1/motorcycles/{id}/details`:
 *  - key bị bỏ qua (undefined) → BE giữ nguyên giá trị đang lưu.
 *  - `null` → BE xoá giá trị (luôn được phép, kể cả khi hết gói — D14).
 *  - giá trị khác null → BE yêu cầu gói VIP.
 *
 * Schema BE là `strict` và `z.string().trim().min(1)` → chuỗi rỗng KHÔNG hợp lệ,
 * muốn xoá thì phải gửi `null`.
 */
test("form state rỗng có đủ mọi field", () => {
  const state = emptyDetailsFormState();
  assert.equal(state.color, "");
  assert.equal(state.purchase_price_vnd, "");
  assert.equal(state.preferred_service_center, "");
});

test("details của BE → form state giữ nguyên giá trị", () => {
  const details: MotorcycleDetails = {
    color: "Đen",
    frame_number: "F123",
    purchase_price_vnd: 35_000_000,
    purchase_date: "2024-01-15",
  };
  const state = detailsToFormState(details);
  assert.equal(state.color, "Đen");
  assert.equal(state.frame_number, "F123");
  assert.equal(state.purchase_price_vnd, "35000000");
  assert.equal(state.purchase_date, "2024-01-15");
  assert.equal(state.engine_number, "");
});

test("không đổi gì → không sinh patch (BE yêu cầu ít nhất 1 field)", () => {
  const details: MotorcycleDetails = { color: "Đen" };
  const state = detailsToFormState(details);
  assert.equal(formStateToDetailsPatch(state, details), null);
});

test("xoá giá trị đang lưu → null", () => {
  const details: MotorcycleDetails = { color: "Đen", frame_number: "F123" };
  const state = detailsToFormState(details);
  state.color = "";
  const patch = formStateToDetailsPatch(state, details);
  assert.ok(patch);
  assert.equal(patch.color, null);
  // field không đổi → không có trong patch
  assert.equal("frame_number" in (patch as object), false);
});

test("sửa giá trị → gửi giá trị mới", () => {
  const details: MotorcycleDetails = { color: "Đen" };
  const state = detailsToFormState(details);
  state.color = "Đỏ";
  const patch = formStateToDetailsPatch(state, details);
  assert.ok(patch);
  assert.equal(patch.color, "Đỏ");
});

test("giá mua là number, không phải chuỗi", () => {
  const details: MotorcycleDetails = { purchase_price_vnd: 35_000_000 };
  const state = detailsToFormState(details);
  state.purchase_price_vnd = "42000000";
  const patch = formStateToDetailsPatch(state, details);
  assert.ok(patch);
  assert.equal(patch.purchase_price_vnd, 42_000_000);
  assert.equal(typeof patch.purchase_price_vnd, "number");
});

test("giá mua xoá → null (không phải 0)", () => {
  const details: MotorcycleDetails = { purchase_price_vnd: 35_000_000 };
  const state = detailsToFormState(details);
  state.purchase_price_vnd = "";
  const patch = formStateToDetailsPatch(state, details);
  assert.ok(patch);
  assert.equal(patch.purchase_price_vnd, null);
});

test("chuỗi rỗng ở field chưa từng có → không sinh patch", () => {
  const patch = formStateToDetailsPatch(emptyDetailsFormState(), undefined);
  assert.equal(patch, null);
});

test("ngày mua không được ở tương lai", () => {
  const now = new Date(2026, 0, 15);
  assert.equal(isFutureIsoDate("2026-01-16", now), true);
  assert.equal(isFutureIsoDate("2026-01-15", now), false);
  assert.equal(isFutureIsoDate("2026-01-14", now), false);
  assert.equal(isFutureIsoDate("", now), false);
});

test("giá mua phải trong khoảng BE cho phép", () => {
  assert.equal(isValidPurchasePrice(""), true);
  assert.equal(isValidPurchasePrice("0"), true);
  assert.equal(isValidPurchasePrice("999999999999"), true);
  assert.equal(isValidPurchasePrice("1000000000000"), false);
  assert.equal(isValidPurchasePrice("-1"), false);
  assert.equal(isValidPurchasePrice("abc"), false);
});
