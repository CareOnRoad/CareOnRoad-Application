/**
 * Deep-link `careonroad://auth/callback?code=...` (Google OAuth) không có màn
 * hình tương ứng → expo-router sẽ hiện "Unmatched Route". AuthProvider đã tự
 * nghe Linking và đổi code lấy session, nên router chỉ cần về '/'.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return path.includes('auth/callback') ? '/' : path;
}
