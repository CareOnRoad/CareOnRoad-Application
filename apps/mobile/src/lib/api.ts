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
  error?: ApiErrorPayload & {
    code?: ApiErrorCode;
  };
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
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, 'NETWORK_ERROR', 'Yêu cầu bị huỷ do hết thời gian chờ');
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      err instanceof Error ? err.message : 'Không thể kết nối tới máy chủ',
    );
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
    const err = body?.error ?? {};
    throw new ApiError(
      response.status,
      err?.code ?? defaultCodeForStatus(response.status),
      err?.message ?? `Yêu cầu thất bại (HTTP ${response.status})`,
      err?.details,
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
