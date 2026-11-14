import assert from "node:assert/strict";
import test from "node:test";

import {
  REMINDER_ITEM_CODES,
  REMINDER_ITEM_LABELS,
  USAGE_LEVELS,
  USAGE_LEVEL_LABELS,
  presetIntervalDays,
  presetRequiresVip,
  type ReminderPreset,
  type UsageLevel,
} from "@/lib/reminders-service";

/**
 * Mẫu nhắc bảo dưỡng phải khớp backend
 * (`apps/api/src/features/reminders/reminder-presets.ts`):
 *  - 5 mã mẫu: 4 mẫu cần `advance`, `insurance_renewal` cần `vip`.
 *  - `usage_level` = light | normal | heavy, BE quy định chu kỳ theo mức này.
 *  - Chu kỳ giảm dần khi đi xe nhiều hơn.
 */
function makePreset(partial: Partial<ReminderPreset> = {}): ReminderPreset {
  return {
    item_code: 'engine_oil',
    title: 'Thay nhớt máy.',
    required_plan: 'advance',
    interval_days: { light: 180, normal: 90, heavy: 30 },
    lead_days: 0,
    ...partial,
  };
}

test("catalog có đúng 5 mã mẫu", () => {
  assert.deepEqual([...REMINDER_ITEM_CODES], [
    'engine_oil',
    'gear_oil',
    'brake_fluid',
    'coolant',
    'insurance_renewal',
  ]);
});

test("mọi mã mẫu đều có nhãn tiếng Việt", () => {
  for (const code of REMINDER_ITEM_CODES) {
    assert.ok(REMINDER_ITEM_LABELS[code]?.length > 0);
  }
});

test("mức sử dụng có đúng 3 mức và có nhãn", () => {
  assert.deepEqual([...USAGE_LEVELS], ['light', 'normal', 'heavy']);
  assert.equal(USAGE_LEVEL_LABELS.light, 'Ít');
  assert.equal(USAGE_LEVEL_LABELS.normal, 'Vừa');
  assert.equal(USAGE_LEVEL_LABELS.heavy, 'Nhiều');
});

test("chu kỳ được chọn theo mức sử dụng", () => {
  const preset = makePreset();
  assert.equal(presetIntervalDays(preset, 'light'), 180);
  assert.equal(presetIntervalDays(preset, 'normal'), 90);
  assert.equal(presetIntervalDays(preset, 'heavy'), 30);
});

test("đi xe nhiều hơn thì chu kỳ ngắn hơn", () => {
  const preset = makePreset();
  const light = presetIntervalDays(preset, 'light');
  const normal = presetIntervalDays(preset, 'normal');
  const heavy = presetIntervalDays(preset, 'heavy');
  assert.ok(light > normal);
  assert.ok(normal > heavy);
});

test("chỉ mẫu insurance_renewal cần gói VIP", () => {
  assert.equal(presetRequiresVip(makePreset()), false);
  assert.equal(
    presetRequiresVip(
      makePreset({ item_code: 'insurance_renewal', required_plan: 'vip' }),
    ),
    true,
  );
});

test("mọi mức sử dụng đều là UsageLevel hợp lệ", () => {
  const levels: UsageLevel[] = ['light', 'normal', 'heavy'];
  for (const level of levels) {
    assert.ok(USAGE_LEVELS.includes(level));
  }
});
