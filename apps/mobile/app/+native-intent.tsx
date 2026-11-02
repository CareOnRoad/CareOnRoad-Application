/**
 * Deep-link handler của Expo Router (native).
 *
 * Expo Router coi "host + pathname" của URL native là route path. Các URL
 * OAuth callback (`careonroad://auth/callback?code=...`) và URL dev client
 * (`careonroad://<ip>:<port>/...`) đều không khớp route nào trong `app/`
 * → màn "Unmatched Route".
 *
 * `AuthProvider` đã tự nghe `Linking` và đổi `code` lấy session, nên ở đây
 * chỉ cần chuẩn hóa URL về route hợp lệ.
 */
import { resolveDeepLinkPath } from '@/lib/deep-link';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return resolveDeepLinkPath(path);
}
