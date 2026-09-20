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
  category: NotificationCategory;
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

export async function listNotifications(params: {
  cursor?: string;
  limit?: number;
  unread_only?: boolean;
} = {}): Promise<NotificationListResponse> {
  return apiGet<NotificationListResponse>('/api/v1/notifications', { query: params });
}

export async function getUnreadCount(): Promise<number> {
  const res = await apiGet<{ count: number } | number>('/api/v1/notifications/unread-count');
  if (typeof res === 'number') return res;
  return res.count;
}

export async function markRead(notificationId: string): Promise<void> {
  await apiPost(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, {});
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
