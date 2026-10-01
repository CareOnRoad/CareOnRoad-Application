/**
 * Service wrappers cho /api/v1/reminders (rider-owned).
 *
 * Contract BE verified từ `reminder.schemas.ts` + `reminder.service.ts`:
 *  - GET    /api/v1/reminders?active_only=&motorcycle_id=
 *  - POST   /api/v1/reminders           - tạo rule (idempotency yêu cầu)
 *  - PATCH  /api/v1/reminders/{id}      - update
 *  - POST   /api/v1/reminders/{id}/snooze
 *
 * Field shapes (snake_case từ BE):
 *  - interval_days?: number (1-3650)
 *  - next_due_at: ISO datetime
 *  - snoozed_until?: ISO datetime
 *  - enabled: boolean
 *  - last_completed_at?: ISO datetime
 *
 * Mapping UI:
 *  - "recurrence" UI (none/weekly/monthly/quarterly) → `interval_days` (0/7/30/90) + enabled
 *  - "scheduled_at" UI → `next_due_at`
 *  - "status" UI (active/disabled/snoozed) → derive từ enabled + snoozed_until
 */
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';

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