/**
 * Service wrappers cho notification APIs (rider-owned inbox).
 *
 *  - GET    /api/v1/notifications?cursor=&limit=&unread_only=
 *  - GET    /api/v1/notifications/unread-count
 *  - POST   /api/v1/notifications/{id}/read
 *  - POST   /api/v1/notifications/read-all
 */
import { apiGet, apiPost } from '@/lib/api';

export type NotificationCategory =
  | 'service_request'
  | 'assignment'
  | 'quote'
  | 'payment'
  | 'reminder'
  | 'system'
  | 'review';

export interface NotificationItem {
  id: string;
  user_id: string;
  /**
   * Derived category từ `type` BE trả về, dùng cho UI icon/tone/label.
   * BE trả `type` dạng `"assignment.en_route"`, `"quote.created"`, ...
   * Xem {@link normalizeNotificationType}.
   */
  category: NotificationCategory;
  /**
   * Raw BE type (e.g. `"quote.created"`, `"payment.succeeded"`) - dùng cho
   * deep-link routing khi cần phân biệt chính xác (xem `notification-routing.ts`).
   */
  type?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  next_cursor?: string;
}

/**
 * Map raw BE notification `type` về `NotificationCategory` cho UI.
 *
 * BE trả `type` dạng dot-separated (`"<namespace>.<event>"`). Một số ít
 * notification không có namespace (vd `maintenance.reminder`) — vẫn parse
 * theo prefix để gom nhóm.
 */
export function normalizeNotificationType(type: string | undefined | null): NotificationCategory {
  if (!type) return 'system';
  const value = String(type).toLowerCase();
  if (value.startsWith('rescue.') || value.startsWith('maintenance.booking')) {
    return 'service_request';
  }
  if (value.startsWith('assignment.')) return 'assignment';
  if (value.startsWith('quote.')) return 'quote';
  if (value.startsWith('payment.')) return 'payment';
  if (value === 'maintenance.reminder' || value.startsWith('reminder.')) return 'reminder';
  if (value.startsWith('review.')) return 'review';
  return 'system';
}

function mapInboxItem(raw: NotificationItem & { type?: string }): NotificationItem {
  const type = raw.type ?? (raw as unknown as { type?: string }).type;
  return {
    ...raw,
    type,
    category: normalizeNotificationType(type),
  };
}

export async function listNotifications(params: {
  cursor?: string;
  limit?: number;
  unread_only?: boolean;
} = {}): Promise<NotificationListResponse> {
  const res = await apiGet<NotificationListResponse>('/api/v1/notifications', {
    query: params,
  });
  return {
    ...res,
    items: (res.items ?? []).map(mapInboxItem),
  };
}

export async function getUnreadCount(): Promise<number> {
  const res = await apiGet<{ count: number } | number>('/api/v1/notifications/unread-count');
  if (typeof res === 'number') return res;
  return res.count;
}

export async function markRead(notificationId: string): Promise<NotificationItem> {
  const res = await apiPost<NotificationItem>(
    `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
    {},
  );
  return mapInboxItem(res);
}

export async function markAllRead(): Promise<{ updated: number }> {
  return apiPost<{ updated: number }>('/api/v1/notifications/read-all', {});
}

export function categoryIcon(category: NotificationCategory): string {
  switch (category) {
    case 'service_request':
      return 'Siren';
    case 'assignment':
      return 'Wrench';
    case 'quote':
      return 'FileText';
    case 'payment':
      return 'CreditCard';
    case 'reminder':
      return 'Bell';
    case 'review':
      return 'Star';
    default:
      return 'Info';
  }
}
