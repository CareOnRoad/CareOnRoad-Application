/**
 * Ánh xạ lỗi auth sang message tiếng Việt.
 *
 * Tách riêng khỏi `auth-service.ts` để có thể unit-test được: module này
 * không import React Native / Supabase nên chạy được trong `node --test`.
 */
import { ApiError, TIMEOUT_MESSAGE } from '@/lib/api';

/**
 * Message chuẩn cho lỗi kết nối tới máy chủ xác thực (Supabase).
 */
export const AUTH_NETWORK_MESSAGE = 'Không thể kết nối tới máy chủ xác thực';

/**
 * Message chuẩn cho lỗi kết nối tới backend (CareOnRoad API).
 */
export const API_NETWORK_MESSAGE = 'Không thể kết nối tới máy chủ';

/**
 * Message chuẩn cho credential sai (đúng ngữ nghĩa ở màn ĐĂNG NHẬP).
 */
export const INVALID_CREDENTIALS_MESSAGE = 'Email hoặc mật khẩu không đúng';

/**
 * Message chung khi email đã có trong hệ thống.
 */
export const EMAIL_ALREADY_REGISTERED_MESSAGE = 'Email này đã được sử dụng';

/**
 * Message khi email ĐÃ TỒN TẠI nhưng mật khẩu user nhập không khớp.
 *
 * ⚠️ Khác với {@link INVALID_CREDENTIALS_MESSAGE}: ở màn đăng ký, email
 * không bị sai — Supabase đã xác nhận email tồn tại. Chỉ có mật khẩu không
 * khớp với tài khoản đã có. Báo chung "Email hoặc mật khẩu không đúng" khiến
 * user tưởng mình nhập sai và thử lại mãi.
 */
export const EMAIL_EXISTS_WRONG_PASSWORD_MESSAGE =
  'Email này đã được sử dụng với mật khẩu khác. ' +
  'Vui lòng đăng nhập bằng mật khẩu đã đặt, hoặc liên hệ hỗ trợ để đặt lại mật khẩu.';

/**
 * Message khi email đã đăng ký nhưng chưa xác nhận.
 *
 * Cùng lý do với {@link EMAIL_EXISTS_WRONG_PASSWORD_MESSAGE}: hành động đúng
 * là mở hộp thư xác nhận, không phải thử lại đăng ký.
 */
export const EMAIL_EXISTS_NOT_CONFIRMED_MESSAGE =
  'Email này đã được đăng ký nhưng chưa xác nhận. ' +
  'Vui lòng kiểm tra hộp thư để xác nhận tài khoản rồi đăng nhập.';

/**
 * Cloudflare trả lỗi gateway (524, 520, 502, 503, 504) khi request tới
 * origin bị timeout. `auth-js` bọc thành `AuthRetryableFetchError` với
 * message dạng `"HTTP 524"` hoặc kèm HTML body thô.
 */
const CLOUDFLARE_GATEWAY_STATUSES = [500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530];

/**
 * Trích HTTP status ra từ message của `AuthRetryableFetchError`
 * (dạng `"HTTP 524"` hoặc `"524"`).
 */
function extractHttpStatus(message: string): number | undefined {
  const match = /(?:HTTP\s*)?\b(5\d{2})\b/i.exec(message);
  if (!match) return undefined;
  const status = Number.parseInt(match[1]!, 10);
  return Number.isFinite(status) ? status : undefined;
}

/**
 * Nhận diện lỗi mạng/timeout từ Supabase.
 *
 * `@supabase/auth-js` bọc lỗi native của Expo thành
 * `AuthRetryableFetchError` với message lấy nguyên từ lỗi gốc, tức là
 * `"fetch failed: ..."`. Nếu chỉ dò chuỗi `'network'` thì không bắt được và
 * nguyên chuỗi thô sẽ hiện lên UI.
 */
export function isNetworkLikeSupabaseError(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes('fetch failed')) return true;
  if (lower.includes('network')) return true;
  if (lower.includes('aborted') || lower.includes('timeout')) return true;
  const status = extractHttpStatus(lower);
  return status !== undefined && CLOUDFLARE_GATEWAY_STATUSES.includes(status);
}

/**
 * Map lỗi từ Supabase sang message tiếng Việt.
 *
 * @see https://supabase.com/docs/reference/javascript/auth-error-codes
 */
export function mapSupabaseError(err: { message?: string } | null | undefined): Error {
  const msg = err?.message ?? 'Lỗi không xác định';
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return new Error(INVALID_CREDENTIALS_MESSAGE);
  }
  if (lower.includes('email not confirmed')) {
    return new Error('Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.');
  }
  if (lower.includes('user already registered')) {
    return new Error(EMAIL_ALREADY_REGISTERED_MESSAGE);
  }
  if (lower.includes('rate limit')) {
    return new Error('Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.');
  }
  if (isNetworkLikeSupabaseError(lower)) {
    return new Error(AUTH_NETWORK_MESSAGE);
  }
  return new Error(msg);
}

/**
 * Nhận diện lỗi credential sai từ Supabase (chưa map qua message tiếng Việt).
 *
 * Dùng ở luồng đăng ký để phân biệt "sai mật khẩu" với các lỗi khác.
 */
export function isInvalidCredentialsError(err: { message?: string } | null | undefined): boolean {
  const lower = (err?.message ?? '').toLowerCase();
  return lower.includes('invalid login credentials') || lower.includes('invalid credentials');
}

/**
 * Nhận diện lỗi "email chưa xác nhận" từ Supabase (chưa map qua message tiếng Việt).
 */
export function isEmailNotConfirmedError(err: { message?: string } | null | undefined): boolean {
  return (err?.message ?? '').toLowerCase().includes('email not confirmed');
}

/**
 * Nhận diện lỗi "tài khoản đã tồn tại" đã được ánh xạ sang message
 * tiếng Việt ("Email này đã được sử dụng").
 *
 * Dùng ở UI để hướng dẫn user sang màn đăng nhập thay vì báo lỗi chung.
 *
 * Bao gồm cả trường hợp "email đã có nhưng mật khẩu không khớp" và
 * "email đã có nhưng chưa xác nhận" — cả 3 đều có chung một hành động
 * đúng: chuyển sang màn Đăng nhập, không phải thử đăng ký lại.
 */
export function isAccountAlreadyRegisteredError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes(EMAIL_ALREADY_REGISTERED_MESSAGE) ||
    err.message.includes(EMAIL_EXISTS_WRONG_PASSWORD_MESSAGE) ||
    err.message.includes(EMAIL_EXISTS_NOT_CONFIRMED_MESSAGE)
  );
}

/** Message tiếng Việt cho lỗi backend khi tải hồ sơ sau đăng nhập. */
export function mapActorError(err: unknown): Error {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return new Error('Tài khoản đang bị khóa hoặc không còn hoạt động. Vui lòng liên hệ hỗ trợ.');
    }
    if (err.code === 'NETWORK_ERROR') {
      // `err.message` đã được chuẩn hoá trong `api.ts` (không còn chuỗi
      // thô kiểu "fetch failed: ..."), nhưng ta vẫn chuẩn hoá lại để chắc
      // chắn không lộ chuỗi kỹ thuật nào.
      const message = err.message === TIMEOUT_MESSAGE ? TIMEOUT_MESSAGE : API_NETWORK_MESSAGE;
      return new Error(message);
    }
  }
  return err instanceof Error ? err : new Error('Không tải được hồ sơ tài khoản');
}
