/**
 * Tiện ích deep-link dùng chung cho mobile app.
 *
 * Module này CỐ TÍNH không import gì từ React Native / Expo để:
 *  - test được bằng `node --test` (không cần mock native module),
 *  - dùng được trong `app/+native-intent.tsx` (module đặc biệt của Expo Router)
 *    mà không kéo theo dependency nặng.
 *
 * Bối cảnh: app nhận deep-link từ 3 nguồn khác nhau, mỗi nguồn có một "hình
 * dạng" URL riêng:
 *
 *  1. Release / dev client (scheme của app):
 *     `careonroad://auth/callback?code=...`  (OAuth callback của Supabase)
 *     `careonroad://<ip>:<port>/...`          (dev client nhúng hostUri)
 *  2. Expo Go:
 *     `exp://<ip>:<port>/--/auth/callback?code=...`
 *  3. Web / universal link:
 *     `https://<domain>/...`
 *
 * Expo Router coi "host + pathname" của URL native là **route path**. Vì vậy
 * với dev client, `careonroad://192.168.1.172:8081/` bị hiểu thành path
 * `192.168.1.172:8081/` — không khớp route nào → màn "Unmatched Route".
 */

/** Scheme của app, khai báo trong `app.config.ts`. */
export const APP_SCHEME = 'careonroad';

/** Host của OAuth callback. Khớp với intent filter Android `host=auth`. */
export const OAUTH_CALLBACK_HOST = 'auth';

/** Path của OAuth callback (sau host). */
export const OAUTH_CALLBACK_PATH = '/callback';

/**
 * Marker nhận diện URL OAuth callback.
 *
 * Dùng marker thay vì so khớp URL chính xác vì dev client / Expo Go có thể
 * thêm tiền tố hostUri (`<ip>:<port>`) vào trước path.
 */
export const OAUTH_CALLBACK_MARKER = 'auth/callback';

/**
 * OAuth redirect URL dạng canonical (dùng cho app build: dev client & release).
 *
 * Vì sao KHÔNG dùng `createURL('auth/callback')`:
 *  - `createURL()` nhúng `hostUri` của dev server (`<ip>:<port>`) vào URL khi
 *    chạy dev client → URL đổi theo IP/Wi-Fi, không khai báo trước được trong
 *    Supabase Dashboard → Redirect URLs.
 *  - Bản không có dấu `/` đầu sẽ ra `careonroad://<ip>:<port>auth/callback` —
 *    URL **không hợp lệ** (`new URL()` throw).
 *  - URL canonical này khớp chính xác với intent filter Android đã khai báo
 *    (`scheme=careonroad`, `host=auth`, `pathPrefix=/callback`) nên hệ điều
 *    hành mở app ổn định.
 */
export const CANONICAL_OAUTH_REDIRECT_URL = `${APP_SCHEME}://${OAUTH_CALLBACK_HOST}${OAUTH_CALLBACK_PATH}`;

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

/** Tiền tố path đặc biệt của Expo Go (vd `exp://host:8081/--/rider`). */
const EXPO_GO_PATH_PREFIX_RE = /^\/--\//;

/**
 * Chuẩn hóa một deep-link URL thành route path mà Expo Router hiểu được.
 *
 * Quy tắc:
 *  - OAuth callback (`auth/callback`) → `'/'`: không có route tương ứng, và
 *    `AuthProvider` tự đọc URL để đổi `code` lấy session.
 *  - Dev client (`careonroad://<ip>:<port>/...`) → bỏ `hostUri`, chỉ giữ path.
 *  - Expo Go (`exp://<ip>:<port>/--/...`) → bỏ hostUri và tiền tố `/--/`.
 *  - Mọi trường hợp khác (vd universal link `https://...`) → giữ nguyên để
 *    Expo Router tự parse như trước.
 *
 * @param rawUrl URL nhận được từ hệ thống (system deep link).
 * @returns Route path dùng cho điều hướng.
 */
export function resolveDeepLinkPath(rawUrl: string): string {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    return rawUrl;
  }

  // 1) OAuth callback của Supabase → về root, route không tồn tại.
  if (rawUrl.includes(OAUTH_CALLBACK_MARKER)) {
    return '/';
  }

  const withoutScheme = rawUrl.replace(SCHEME_RE, '');
  const slashIndex = withoutScheme.indexOf('/');

  // `careonroad://<ip>:<port>` — không có path nào → về root.
  if (slashIndex === -1) {
    return '/';
  }

  const host = withoutScheme.slice(0, slashIndex);

  // Host không phải hostUri (vd `auth`) → URL có hình dạng chuẩn, giữ nguyên
  // để Expo Router parse như trước (bao gồm cả universal link https://).
  if (!host.includes(':')) {
    return rawUrl;
  }

  // 2) hostUri của dev server (dạng `<ip>:<port>`) → bỏ đi, chỉ giữ path thật.
  let path = withoutScheme.slice(slashIndex);

  // 3) Expo Go thêm tiền tố `/--/` vào path.
  path = path.replace(EXPO_GO_PATH_PREFIX_RE, '/');

  return path.length > 0 ? path : '/';
}

/**
 * Trích `code` (authorization code của PKCE) ra khỏi deep-link URL.
 *
 * `new URL()` KHÔNG parse được mọi URL native — ví dụ URL do dev client sinh ra
 * trước đây (`careonroad://<ip>:<port>auth/callback`) là URL không hợp lệ và
 * `new URL()` sẽ throw. Vì vậy ta parse thủ công, đủ để lấy query string.
 *
 * @returns Authorization code, hoặc `null` nếu URL không có `code`.
 */
export function extractOAuthCode(rawUrl: string): string | null {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    return null;
  }

  const queryIndex = rawUrl.indexOf('?');
  if (queryIndex === -1) {
    return null;
  }

  const query = rawUrl.slice(queryIndex + 1);
  for (const pair of query.split('&')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator) !== 'code') continue;

    const rawValue = pair.slice(separator + 1);
    if (rawValue.length === 0) return null;

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

/**
 * Scheme deep-link được backend chấp nhận cho `return_url` / `cancel_url`
 * khi tạo đơn mua gói (xem `ALLOWED_DEEP_LINK_SCHEMES` trong
 * `apps/api/src/features/subscriptions/subscription.schemas.ts`).
 *
 * Backend từ chối scheme khác (kể cả `https`) để bảo đảm payOS đưa người
 * dùng về đúng app, không phải một trang web trống.
 */
export const ALLOWED_RETURN_URL_SCHEMES = ['careonroad', 'exp', 'exps'] as const;

/**
 * Kiểm tra một URL có phải deep-link hợp lệ để backend chấp nhận hay không.
 *
 * Trả về `false` khi URL rỗng, không có `://`, hoặc scheme nằm ngoài danh sách
 * cho phép — khi đó mobile sẽ bỏ qua URL và để backend dùng URL fallback từ env.
 *
 * Module này không import React Native / Expo nên test được bằng `node --test`.
 */
export function isAllowedReturnUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const separator = trimmed.indexOf('://');
  if (separator <= 0) return false;
  const scheme = trimmed.slice(0, separator).toLowerCase();
  return (ALLOWED_RETURN_URL_SCHEMES as readonly string[]).includes(scheme);
}

/**
 * Kiểm tra một URL có phải OAuth callback của Supabase hay không.
 *
 * Dùng marker `auth/callback` để nhận diện được mọi hình dạng URL:
 * `careonroad://auth/callback`, `exp://<ip>:<port>/--/auth/callback`,
 * `careonroad://<ip>:<port>/auth/callback`.
 */
export function isOAuthCallbackUrl(rawUrl: string): boolean {
  return typeof rawUrl === 'string' && rawUrl.includes(OAUTH_CALLBACK_MARKER);
}
