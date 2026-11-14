/**
 * Service wrappers cho /api/v1/reminders (rider-owned).
 *
 * Contract BE verified từ `reminder.schemas.ts` + `reminder.service.ts`:
 *  - GET    /api/v1/reminders?active_only=&motorcycle_id=
 *  - POST   /api/v1/reminders           - tạo rule (idempotency yêu cầu)
 *  - PATCH  /api/v1/reminders/{id}      - update
 *  - POST   /api/v1/reminders/{id}/snooze
 *
 * Mẫu nhắc bảo dưỡng theo linh kiện (gói Advance / VIP):
 *  - GET    /api/v1/reminder-presets                     - catalog mẫu
 *  - POST   /api/v1/motorcycles/{id}/reminder-presets     - bật mẫu cho 1 xe
 *  - POST   /api/v1/reminders/{id}/done                   - đánh dấu đã làm
 *
 * Field shapes (snake_case từ BE):
 *  - interval_days?: number (1-3650)
 *  - next_due_at: ISO datetime
 *  - snoozed_until?: ISO datetime
 *  - enabled: boolean
 *  - last_completed_at?: ISO datetime
 *  - item_code?: mã mẫu (rule được sinh từ preset)
 *  - last_done_on?: YYYY-MM-DD
 *
 * Mapping UI:
 *  - "recurrence" UI (none/weekly/monthly/quarterly) → `interval_days` (0/7/30/90) + enabled
 *  - "scheduled_at" UI → `next_due_at`
 *  - "status" UI (active/disabled/snoozed) → derive từ enabled + snoozed_until
 */
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';
import type { PaidPlanCode } from '@/lib/plan-gate';

/** UI recurrence enum – ánh xạ sang interval_days. */
export type ReminderRecurrence = 'none' | 'weekly' | 'monthly' | 'quarterly';

/** UI status enum – derive từ enabled + snoozed_until. */
export type ReminderStatus = 'active' | 'snoozed' | 'disabled';

export interface Reminder {
  id: string;
  rider_id: string;
  motorcycle_id: string;
  title: string;
  description?: string;
  /** Số ngày lặp lại. UI dùng recurrenceLabel để render. */
  interval_days?: number;
  /** Lần kế tiếp cần nhắc. */
  next_due_at: string;
  /** Nếu có và > now: reminder đang bị tạm hoãn. */
  snoozed_until?: string;
  enabled: boolean;
  last_completed_at?: string;
  /** Mã mẫu nhắc bảo dưỡng (rule được sinh từ preset). */
  item_code?: ReminderItemCode;
  /** Ngày làm gần nhất (YYYY-MM-DD) — chỉ có với rule preset. */
  last_done_on?: string;
  created_at: string;
  updated_at: string;
}

/** UI-derived status (cho UI render Badge). */
export function deriveStatus(r: Reminder, now: Date = new Date()): ReminderStatus {
  if (!r.enabled) return 'disabled';
  if (r.snoozed_until && new Date(r.snoozed_until).getTime() > now.getTime()) {
    return 'snoozed';
  }
  return 'active';
}

export interface CreateReminderInput {
  motorcycle_id: string;
  title: string;
  description?: string;
  /** UI recurrence – sẽ chuyển sang interval_days. */
  recurrence: ReminderRecurrence;
  /** ISO datetime string (YYYY-MM-DDTHH:mm:ss+07:00). */
  next_due_at: string;
}

export interface UpdateReminderInput {
  title?: string;
  description?: string;
  next_due_at?: string;
  interval_days?: number;
  enabled?: boolean;
}

/** Chuyển UI recurrence → interval_days (number of days). */
export function recurrenceToIntervalDays(r: ReminderRecurrence): number | undefined {
  switch (r) {
    case 'none':
      return undefined; // one-shot
    case 'weekly':
      return 7;
    case 'monthly':
      return 30;
    case 'quarterly':
      return 90;
    default:
      return undefined;
  }
}

/** Hiển thị interval_days (nếu có) thành UI recurrence label. */
export function intervalDaysToRecurrence(days: number | undefined): ReminderRecurrence {
  if (!days) return 'none';
  if (days === 7) return 'weekly';
  if (days === 30) return 'monthly';
  if (days === 90) return 'quarterly';
  return 'none';
}

export function recurrenceLabel(r: ReminderRecurrence): string {
  switch (r) {
    case 'none':
      return 'Một lần';
    case 'weekly':
      return 'Mỗi tuần';
    case 'monthly':
      return 'Mỗi tháng';
    case 'quarterly':
      return 'Mỗi quý';
    default:
      return r;
  }
}

export async function listReminders(params: {
  active_only?: boolean;
  motorcycle_id?: string;
} = {}): Promise<Reminder[]> {
  const res = await apiGet<{ items?: Reminder[] } | Reminder[]>('/api/v1/reminders', {
    query: params,
  });
  if (Array.isArray(res)) return res;
  return res.items ?? [];
}

/**
 * Tạo reminder rule.
 * BE nhận `{ motorcycle_id, title, interval_days?, next_due_at, enabled }`.
 * Trong service này luôn gửi `enabled: true` cho create flow.
 */
export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  const body: Record<string, unknown> = {
    motorcycle_id: input.motorcycle_id,
    title: input.title.trim(),
    next_due_at: input.next_due_at,
    enabled: true,
  };
  const intervalDays = recurrenceToIntervalDays(input.recurrence);
  if (intervalDays !== undefined) body.interval_days = intervalDays;
  return apiPost<Reminder>(
    '/api/v1/reminders',
    body,
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

export async function updateReminder(id: string, input: UpdateReminderInput): Promise<Reminder> {
  return apiPatch<Reminder>(`/api/v1/reminders/${encodeURIComponent(id)}`, input);
}

export async function snoozeReminder(id: string, snoozeUntil: string): Promise<Reminder> {
  return apiPost<Reminder>(
    `/api/v1/reminders/${encodeURIComponent(id)}/snooze`,
    { until: snoozeUntil },
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

// =========================================================
// Mẫu nhắc bảo dưỡng theo linh kiện (gói Advance / VIP)
// =========================================================

/**
 * Mã mẫu nhắc. Khớp `reminderItemCodes` của BE
 * (`apps/api/src/features/reminders/reminder-presets.ts`).
 */
export const REMINDER_ITEM_CODES = [
  'engine_oil',
  'gear_oil',
  'brake_fluid',
  'coolant',
  'insurance_renewal',
] as const;

export type ReminderItemCode = (typeof REMINDER_ITEM_CODES)[number];

/** Mức sử dụng xe. Khớp `usageLevels` của BE. */
export const USAGE_LEVELS = ['light', 'normal', 'heavy'] as const;
export type UsageLevel = (typeof USAGE_LEVELS)[number];

/** Nhãn tiếng Việt cho mức sử dụng. */
export const USAGE_LEVEL_LABELS: Record<UsageLevel, string> = {
  light: 'Ít',
  normal: 'Vừa',
  heavy: 'Nhiều',
};

/** Nhãn tiếng Việt cho mẫu nhắc. */
export const REMINDER_ITEM_LABELS: Record<ReminderItemCode, string> = {
  engine_oil: 'Thay nhớt máy',
  gear_oil: 'Thay nhớt láp (xe tay ga)',
  brake_fluid: 'Thay dầu phanh',
  coolant: 'Thay nước làm mát',
  insurance_renewal: 'Gia hạn bảo hiểm TNDS',
};

/** Một mẫu nhắc trong catalog của BE. */
export interface ReminderPreset {
  item_code: ReminderItemCode;
  title: string;
  required_plan: PaidPlanCode;
  /** Chu kỳ (ngày) theo từng mức sử dụng. */
  interval_days: Record<UsageLevel, number>;
  /** Số ngày nhắc trước hạn (bảo hiểm = 14 ngày). */
  lead_days: number;
}

/** Response của `GET /api/v1/reminder-presets`. */
export interface ReminderPresetCatalog {
  /** Chu kỳ dùng khi không biết "lần làm gần nhất" (BE quy định). */
  unknown_last_done_due_days: number;
  items: ReminderPreset[];
}

/** Lấy catalog mẫu nhắc (gói Advance/VIP). Luôn trả kể cả khi gói thấp hơn. */
export async function listReminderPresets(): Promise<ReminderPresetCatalog> {
  return apiGet<ReminderPresetCatalog>('/api/v1/reminder-presets');
}

/** Một mẫu được chọn khi bật cho xe. */
export interface ReminderPresetApplyItem {
  item_code: ReminderItemCode;
  /** Lần làm gần nhất (YYYY-MM-DD). Không bắt buộc. */
  last_done_on?: string;
}

/** Input của `POST /api/v1/motorcycles/{id}/reminder-presets`. */
export interface ApplyReminderPresetsInput {
  usage_level: UsageLevel;
  items: ReminderPresetApplyItem[];
}

/** Kết quả bật mẫu: mỗi rule kèm cờ `created` (mới tạo hay đã có sẵn). */
export interface AppliedReminderPreset extends Reminder {
  created: boolean;
}

/**
 * Bật mẫu nhắc bảo dưỡng cho 1 xe.
 *
 * BE yêu cầu gói `advance`, hoặc `vip` nếu có mẫu `insurance_renewal`.
 * Mẫu đã bật cho xe sẽ được giữ nguyên (`created: false`), không tạo trùng.
 *
 * Lỗi có thể trả 403 `plan_required`.
 */
export async function applyReminderPresets(
  motorcycleId: string,
  input: ApplyReminderPresetsInput,
): Promise<{ items: AppliedReminderPreset[] }> {
  return apiPost<{ items: AppliedReminderPreset[] }>(
    `/api/v1/motorcycles/${encodeURIComponent(motorcycleId)}/reminder-presets`,
    input,
  );
}

/**
 * Chu kỳ (ngày) của một mẫu theo mức sử dụng đã chọn.
 *
 * Catalog BE trả `interval_days` cho cả 3 mức → UI chỉ cần chọn 1.
 */
export function presetIntervalDays(
  preset: ReminderPreset,
  usageLevel: UsageLevel,
): number {
  return preset.interval_days[usageLevel];
}

/**
 * Mẫu này có cần gói VIP không?
 *
 * Mẫu `insurance_renewal` cần `vip`; các mẫu còn lại cần `advance`.
 */
export function presetRequiresVip(preset: ReminderPreset): boolean {
  return preset.required_plan === 'vip';
}

/**
 * Đánh dấu một lịch nhắc mẫu đã làm → BE tính lại `next_due_at`.
 *
 * - Chỉ rule có `item_code` mới gọi được (BE trả 400 `INVALID_INPUT` nếu không).
 * - BE yêu cầu đúng gói của preset (`advance`/`vip`).
 * - `done_on` phải là `YYYY-MM-DD`, không ở tương lai, tối đa 10 năm trở lại.
 */
export async function markReminderDone(
  ruleId: string,
  doneOn: string,
): Promise<Reminder> {
  return apiPost<Reminder>(
    `/api/v1/reminders/${encodeURIComponent(ruleId)}/done`,
    { done_on: doneOn },
  );
}