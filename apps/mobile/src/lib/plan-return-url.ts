/**
 * Deep-link quay lại app sau khi thanh toán gói trên payOS.
 *
 * Vấn đề đã gặp: `PAYOS_RETURN_URL` trỏ tới endpoint health-check trả JSON,
 * nên sau khi thanh toán xong người dùng bị đưa tới một trang trống thay vì
 * quay lại app. Cách sửa: mobile gửi kèm deep-link (`careonroad://…` khi
 * build, `exp://…` khi chạy Expo Go) làm `return_url`/`cancel_url` cho payOS.
 *
 * Backend chỉ nhận scheme `careonroad`, `exp`, `exps`
 * (xem `ALLOWED_DEEP_LINK_SCHEMES` trong
 * `apps/api/src/features/subscriptions/subscription.schemas.ts`), nên URL không
 * hợp lệ sẽ bị bỏ qua — backend tự fallback về URL cấu hình từ env.
 */
import * as Linking from 'expo-linking';

import { isAllowedReturnUrl } from '@/lib/deep-link';

/** Route app muốn mở lại sau khi thanh toán. */
export const PLAN_RETURN_ROUTE = '/rider/plans';

/**
 * Tạo deep-link quay lại app.
 *
 * Dùng `expo-linking` để URL đúng với môi trường đang chạy:
 *  - Expo Go        → `exp://<ip>:<port>/rider/plans`
 *  - Dev client     → `careonroad://<ip>:<port>/rider/plans`
 *  - Bản build      → `careonroad:///rider/plans`
 *
 * @returns URL hợp lệ theo allowlist của backend, hoặc `undefined` nếu không
 * tạo được (khi đó backend dùng URL fallback từ env).
 */
export function buildPlanReturnUrl(route: string = PLAN_RETURN_ROUTE): string | undefined {
  let url: string | undefined;
  try {
    url = Linking.createURL(route);
  } catch {
    // `expo-linking` cần expo-constants manifest; thiếu thì bỏ qua deep-link.
    return undefined;
  }
  return isAllowedReturnUrl(url) ? url.trim() : undefined;
}
