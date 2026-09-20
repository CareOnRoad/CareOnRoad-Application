/**
 * Service wrappers cho /api/v1/reminders (rider-owned).
 *
 *  - GET    /api/v1/reminders?active_only=&motorcycle_id=
 *  - POST   /api/v1/reminders           - tạo reminder (idempotency yêu cầu)
 *  - PATCH  /api/v1/reminders/{id}      - update
 *  - POST   /api/v1/reminders/{id}/snooze
 */
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/idempotency';

export type ReminderRecurrence =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export type ReminderStatus = 'active' | 'snoozed' | 'disabled';

export interface Reminder {
  id: string;
  rider_id: string;
  motorcycle_id?: string;
  title: string;
  description?: string;
  scheduled_at: string; // ISO datetime
  recurrence: ReminderRecurrence;
  status: ReminderStatus;
  source: 'manual' | 'service_request';
  next_fire_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReminderInput {
  motorcycle_id?: string;
  title: string;
  description?: string;
  scheduled_at: string;
  recurrence: ReminderRecurrence;
}

export interface UpdateReminderInput {
  title?: string;
  description?: string;
  scheduled_at?: string;
  recurrence?: ReminderRecurrence;
  status?: ReminderStatus;
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

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  return apiPost<Reminder>(
    '/api/v1/reminders',
    input,
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

export async function updateReminder(id: string, input: UpdateReminderInput): Promise<Reminder> {
  return apiPatch<Reminder>(`/api/v1/reminders/${encodeURIComponent(id)}`, input);
}

export async function snoozeReminder(id: string, snoozeUntil: string): Promise<Reminder> {
  return apiPost<Reminder>(
    `/api/v1/reminders/${encodeURIComponent(id)}/snooze`,
    { snooze_until: snoozeUntil },
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
}

export function recurrenceLabel(r: ReminderRecurrence): string {
  switch (r) {
    case 'none':
      return 'Một lần';
    case 'daily':
      return 'Mỗi ngày';
    case 'weekly':
      return 'Mỗi tuần';
    case 'monthly':
      return 'Mỗi tháng';
    case 'quarterly':
      return 'Mỗi quý';
    case 'yearly':
      return 'Mỗi năm';
    default:
      return r;
  }
}
