import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeSelectedTime,
  resolveAndroidPickerMode,
  startOfDay,
} from "@/lib/datetime-picker";

/**
 * Regression tests cho bug "2 ô chọn ngày / chọn giờ không tương tác được"
 * trên màn đặt lịch bảo dưỡng & nhắc hẹn.
 *
 * Nguyên nhân gốc (đã sửa trong `src/components/ui/datetime-picker-field.tsx`):
 * `className` chứa variant `active:` nằm trên một `<View>` con → NativeWind
 * nâng `<View>` đó thành `Pressable` → `Pressable` sâu hơn cướm responder
 * của `Pressable` cha → `onPress` cha không bao giờ chạy.
 *
 * Các test ở đây bảo vệ phần logic thuần (không phụ thuộc native):
 *  - Android chỉ có mode `date` / `time` (không có `datetime`).
 *  - Ghép ngày + giờ phải giữ đúng phần ngày đã chọn.
 *  - Ngày được chọn phải được chuẩn hoá về 00:00.
 */

test("mode 'datetime' trên Android được resolve thành 'date' trước", () => {
  assert.equal(resolveAndroidPickerMode("datetime"), "date");
  assert.equal(resolveAndroidPickerMode("date"), "date");
  assert.equal(resolveAndroidPickerMode("time"), "time");
});

test("chọn ngày được chuẩn hoá về 00:00:00.000", () => {
  const picked = new Date(2026, 10, 20, 17, 45, 30, 500);
  const normalized = startOfDay(picked);

  assert.equal(normalized.getFullYear(), 2026);
  assert.equal(normalized.getMonth(), 10);
  assert.equal(normalized.getDate(), 20);
  assert.equal(normalized.getHours(), 0);
  assert.equal(normalized.getMinutes(), 0);
  assert.equal(normalized.getSeconds(), 0);
  assert.equal(normalized.getMilliseconds(), 0);
});

test("startOfDay không mutate Date gốc", () => {
  const picked = new Date(2026, 10, 20, 17, 45, 30, 500);
  startOfDay(picked);

  assert.equal(picked.getHours(), 17);
  assert.equal(picked.getMinutes(), 45);
});

test("ghép giờ vào ngày đã chọn giữ nguyên phần ngày", () => {
  const pickedDay = new Date(2026, 10, 20, 0, 0, 0, 0);
  // Native time picker trả về Date có phần ngày rác (theo `value` đã truyền vào).
  const timeSelected = new Date(2026, 0, 1, 14, 30, 0, 0);

  const merged = mergeSelectedTime(pickedDay, timeSelected);

  assert.equal(merged.getFullYear(), 2026);
  assert.equal(merged.getMonth(), 10);
  assert.equal(merged.getDate(), 20);
  assert.equal(merged.getHours(), 14);
  assert.equal(merged.getMinutes(), 30);
  assert.equal(merged.getSeconds(), 0);
  assert.equal(merged.getMilliseconds(), 0);
});

test("ghép giờ không mutate ngày đã chọn", () => {
  const pickedDay = new Date(2026, 10, 20, 0, 0, 0, 0);
  const timeSelected = new Date(2026, 0, 1, 9, 15, 0, 0);

  mergeSelectedTime(pickedDay, timeSelected);

  assert.equal(pickedDay.getHours(), 0);
  assert.equal(pickedDay.getMinutes(), 0);
});
