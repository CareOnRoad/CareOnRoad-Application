/**
 * HTTP API client - đóng gói các gọi fetch tới backend Next.js.
 *
 * Đặc điểm:
 *  - Tự động đính kèm Bearer token từ Supabase session (nếu có).
 *  - Parse JSON response và ném ra ApiError với mã lỗi + status.
 *  - Cho phép truyền header tuỳ chỉnh (X-Idempotency-Key, X-Worker-Secret...).
 *  - Server-side errors được propagate nguyên văn cho caller xử lý.
 *
 * Lưu ý: Tất cả backend routes là /api/v1/... (verified via AGENTS.md).
 */

import { getEnv } from '@/lib/config';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'ACTOR_SUSPENDED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface ApiErrorPayload {
  code?: ApiErrorCode;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type TokenProvider = () => Promise<string | null> | string | null;

let currentTokenProvider: TokenProvider | null = null;

/**
 * Đăng ký callback cung cấp access token (Supabase access_token).
 * AuthContext sẽ gọi hàm này ngay sau khi Supabase session thay đổi.
 */
export function setAccessTokenProvider(provider: TokenProvider | null): void {
  currentTokenProvider = provider;
}

async function resolveToken(): Promise<string | null> {
  if (!currentTokenProvider) return null;
  try {
    return await currentTokenProvider();
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Headers bổ sung (X-Idempotency-Key, X-Worker-Secret...). */
  headers?: Record<string, string>;
  /** Khi true sẽ KHÔNG gắn Authorization header (dùng cho sign-up / sign-in). */
  skipAuth?: boolean;
  /** Query params, sẽ được encode tự động. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Abort signal cho phép caller huỷ request. */
  signal?: AbortSignal;
  /** Request timeout (ms). Mặc định 15000. */
  timeoutMs?: number;
}

interface ErrorResponseBody {
  /**
   * Format thực tế của BE: body PHẲNG
   * `{ error_code, message, details?, request_id? }` (xem `createApiErrorBody`
   * trong `apps/api/src/lib/api-error.ts`).
   */
  error_code?: string;
  message?: string;
  details?: unknown;
  request_id?: string;
  /** Format legacy: body NESTED `{ error: { code, message, details } }`. */
  error?: ApiErrorPayload & {
    code?: ApiErrorCode;
  };
}

/** Message chuẩn khi request bị huỷ vì hết thời gian chờ. */
export const TIMEOUT_MESSAGE = 'Yêu cầu bị huỷ do hết thời gian chờ';

/** Message chuẩn khi không thể kết nối tới máy chủ. */
export const NETWORK_MESSAGE = 'Không thể kết nối tới máy chủ';

/**
 * Nhận diện lỗi timeout của `fetch`.
 *
 * ⚠️ Bản RELEASE dùng native fetch của Expo, khác hẳn bản dev:
 *
 *   - Dev: `fetch` là JS của React Native → abort sinh `AbortError` đúng chuẩn.
 *   - Release: `expo/src/winter/fetch/fetch.ts` bọc **mọi** lỗi native thành
 *     `FetchError` (`expo/src/winter/fetch/FetchErrors.ts`):
 *     `super("fetch failed: " + message)` và `name` vẫn là `"Error"`.
 *
 * Nếu chỉ kiểm tra `err.name === 'AbortError'` thì trong release nhánh này
 * KHÔNG BAO GIỜ khớp → timeout bị đẩy nguyên chuỗi `"fetch failed: ..."`
 * lên UI, đúng lỗi mà user thật gặp phải.
 */
export function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { name?: unknown; message?: unknown };
  if (candidate.name === 'AbortError' || candidate.name === 'TimeoutError') {
    return true;
  }
  const message =
    typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  if (!message.includes('fetch failed')) {
    return false;
  }
  return (
    message.includes('abort') ||
    message.includes('timeout') ||
    message.includes('timed out')
  );
}

/**
 * Chuẩn hoá lỗi mạng thành message tiếng Việt, không để lộ chuỗi thô
 * (`"fetch failed: ..."`) cho người dùng.
 */
export function toNetworkErrorMessage(err: unknown): string {
  return isTimeoutError(err) ? TIMEOUT_MESSAGE : NETWORK_MESSAGE;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const env = getEnv();
  const base = env.apiBaseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!query) return `${base}${cleanPath}`;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    params.append(k, String(v));
  });
  const queryString = params.toString();
  return queryString ? `${base}${cleanPath}?${queryString}` : `${base}${cleanPath}`;
}

function defaultCodeForStatus(status: number): ApiErrorCode {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 400) return 'INVALID_INPUT';
  return 'UNKNOWN_ERROR';
}

export async function apiRequest<TResponse = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const url = buildUrl(path, options.query);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body !== undefined && headers['Content-Type'] === undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!options.skipAuth) {
    const token = await resolveToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw new ApiError(0, 'NETWORK_ERROR', toNetworkErrorMessage(err));
  }
  clearTimeout(timeoutId);

  // No content
  if (response.status === 204) {
    return undefined as TResponse;
  }

  let payload: unknown = null;
  const text = await response.text();
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const body = (payload ?? {}) as ErrorResponseBody;
    // BE trả body PHẲNG `{ error_code, message, details }`; format NESTED
    // `{ error: { code, message } }` là format legacy — hỗ trợ cả hai và ưu
    // tiên format phẳng để không mất `error_code` cụ thể của backend.
    const nested = body?.error ?? {};
    const code = (body?.error_code ?? nested?.code) as ApiErrorCode | undefined;
    const message = body?.message ?? nested?.message;
    const details = body?.details ?? nested?.details;
    throw new ApiError(
      response.status,
      code ?? defaultCodeForStatus(response.status),
      message ?? `Yêu cầu thất bại (HTTP ${response.status})`,
      details,
    );
  }

  return payload as TResponse;
}

/** Helper cho HTTP GET. */
export function apiGet<TResponse = unknown>(
  path: string,
  options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<TResponse> {
  return apiRequest<TResponse>(path, { ...options, method: 'GET' });
}

/** Helper cho HTTP POST. */
export function apiPost<TResponse = unknown>(
  path: string,
  body?: unknown,
  options: Omit<RequestOptions, 'method'> = {},
): Promise<TResponse> {
  return apiRequest<TResponse>(path, { ...options, method: 'POST', body });
}

/** Helper cho HTTP PUT. */
export function apiPut<TResponse = unknown>(
  path: string,
  body?: unknown,
  options: Omit<RequestOptions, 'method'> = {},
): Promise<TResponse> {
  return apiRequest<TResponse>(path, { ...options, method: 'PUT', body });
}

/** Helper cho HTTP PATCH. */
export function apiPatch<TResponse = unknown>(
  path: string,
  body?: unknown,
  options: Omit<RequestOptions, 'method'> = {},
): Promise<TResponse> {
  return apiRequest<TResponse>(path, { ...options, method: 'PATCH', body });
}

/** Helper cho HTTP DELETE. */
export function apiDelete<TResponse = unknown>(
  path: string,
  options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<TResponse> {
  return apiRequest<TResponse>(path, { ...options, method: 'DELETE' });
}
