/**
 * Notification deep-link routing.
 *
 * Map 1 notification → 1 in-app route target. Tap notification sẽ:
 *  1. Mark notification as read.
 *  2. Resolve route target dựa trên `category` (derived từ BE `type`) + `data`
 *     payload (`request_id`, `quote_id`, `payment_order_id`, `assignment_id`, ...).
 *  3. Navigate tới href tương ứng.
 *
 * Lưu ý:
 *  - `data` được sanitize bởi BE (`apps/api/src/features/notifications/notification-data.ts`)
 *    → chỉ chứa các UUID field hợp lệ.
 *  - Nếu không tìm được target phù hợp → trả `none`, UI sẽ không navigate.
 *  - Href sử dụng Expo Router paths (string).
 */
import type { NotificationItem } from '@/lib/notifications-service';

export type Role = 'rider' | 'mechanic';

export type RouteTarget =
  | { kind: 'rider-rescue'; requestId: string }
  | { kind: 'rider-payment'; requestId: string; quoteId: string }
  | { kind: 'rider-review'; requestId: string }
  | { kind: 'rider-reminder'; reminderId?: string }
  | { kind: 'rider-schedule' }
  | { kind: 'rider-vehicle'; motorcycleId: string }
  | { kind: 'mechanic-offers' }
  | { kind: 'mechanic-jobs'; assignmentId: string }
  | { kind: 'none' };

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function routeFor(notification: NotificationItem, role: Role): RouteTarget {
  const data = notification.data ?? {};
  const requestId = pickString(data.request_id);
  const quoteId = pickString(data.quote_id);
  const assignmentId = pickString(data.assignment_id);
  const reminderId = pickString(data.reminder_id);
  const motorcycleId = pickString(data.motorcycle_id);

  switch (notification.category) {
    case 'quote':
      if (role === 'rider' && requestId && quoteId) {
        return { kind: 'rider-payment', requestId, quoteId };
      }
      return { kind: 'none' };
    case 'payment':
      if (role === 'rider' && requestId) {
        // Mở rescue screen để user xem payment phase (BE không expose GET payment list by rider).
        // Nếu có paymentOrderId thì ưu tiên tìm quote gắn với payment đó - trong MVP
        // cứ navigate về rescue screen (đã wire phase payment polling).
        return { kind: 'rider-rescue', requestId };
      }
      return { kind: 'none' };
    case 'review':
      if (role === 'rider' && requestId) {
        return { kind: 'rider-review', requestId };
      }
      return { kind: 'none' };
    case 'reminder':
      if (role === 'rider') {
        if (reminderId) return { kind: 'rider-reminder', reminderId };
        return { kind: 'rider-schedule' };
      }
      return { kind: 'none' };
    case 'service_request':
      if (role === 'mechanic') return { kind: 'mechanic-offers' };
      if (role === 'rider' && requestId) return { kind: 'rider-rescue', requestId };
      if (role === 'rider' && motorcycleId) return { kind: 'rider-vehicle', motorcycleId };
      return { kind: 'none' };
    case 'assignment':
      if (role === 'mechanic' && assignmentId) return { kind: 'mechanic-jobs', assignmentId };
      if (role === 'rider' && requestId) return { kind: 'rider-rescue', requestId };
      return { kind: 'none' };
    case 'system':
    default:
      return { kind: 'none' };
  }
}

/**
 * Convert route target thành Expo Router href (string) hoặc null.
 */
export function hrefFor(target: RouteTarget): string | null {
  switch (target.kind) {
    case 'rider-rescue':
      return '/rider/(tabs)/rescue';
    case 'rider-payment':
      return `/rider/payments/${encodeURIComponent(target.quoteId)}?requestId=${encodeURIComponent(target.requestId)}`;
    case 'rider-review':
      return `/rider/review?requestId=${encodeURIComponent(target.requestId)}`;
    case 'rider-reminder':
      return `/rider/(tabs)/schedule${target.reminderId ? `?reminderId=${encodeURIComponent(target.reminderId)}` : ''}`;
    case 'rider-schedule':
      return '/rider/(tabs)/schedule';
    case 'rider-vehicle':
      return `/rider/(tabs)/vehicles?focusMotorcycle=${encodeURIComponent(target.motorcycleId)}`;
    case 'mechanic-offers':
      return '/mechanic/(tabs)/offers';
    case 'mechanic-jobs':
      return `/mechanic/jobs/detail?id=${encodeURIComponent(target.assignmentId)}`;
    case 'none':
      return null;
  }
}

/**
 * One-shot helper: lấy href trực tiếp từ notification + role.
 */
export function hrefForNotification(
  notification: NotificationItem,
  role: Role,
): string | null {
  return hrefFor(routeFor(notification, role));
}
