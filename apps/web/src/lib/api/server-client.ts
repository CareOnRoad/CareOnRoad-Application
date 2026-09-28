import "server-only";

import { z } from "zod";

import { apiErrorBodySchema } from "@careonroad/api-contract/common";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * A non-2xx response from the backend.
 *
 * Carries the backend's own `error_code` and `request_id` so a page can show a
 * meaningful state and a support request can be traced. The body is never
 * logged — it can contain user-supplied values.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

/** The backend did not answer in time, or the connection failed. */
export class ApiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiTimeoutError";
  }
}

/** A 2xx response whose body does not match the shared contract. */
export class ApiContractError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiContractError";
    this.status = status;
  }
}

export type ApiRequestOptions<T> = {
  accessToken: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /**
   * Required by every admin mutation. Reuse the same key when retrying a
   * failed request so the backend can replay instead of duplicating.
   */
  idempotencyKey?: string;
  schema: z.ZodType<T>;
  timeoutMs?: number;
};

function apiBaseUrl(): string {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    throw new Error("API_BASE_URL must be set. See apps/web/.env.example.");
  }
  return baseUrl.replace(/\/+$/, "");
}

export function buildQuery(query: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    const text = String(value);
    if (!text) continue;
    params.set(key, text);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * Calls a `/api/v1` route as the signed-in user.
 *
 * The access token stays on the server: this module is `server-only`, and the
 * token is never written to a log, a prop, or the browser bundle.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions<T>): Promise<T> {
  const { accessToken, method = "GET", body, idempotencyKey, schema } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  // The health probes are unauthenticated. Sending an empty bearer header to
  // them is at best noise and at worst a gateway rejection.
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // Admin data is per-request and authorization-scoped, so it must never be
      // served from a shared cache.
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiTimeoutError(`Request to ${path} timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await toClientError(response, path);
  }

  if (response.status === 204) {
    // A 204 has no body to validate; the caller supplied a schema only for
    // endpoints that do return one.
    return undefined as T;
  }

  const payload = await readJson(response);

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiContractError(
      response.status,
      `The response from ${path} did not match the shared contract.`
    );
  }

  return parsed.data;
}

async function toClientError(response: Response, path: string): Promise<ApiClientError> {
  const payload = await readJson(response);
  const parsed = apiErrorBodySchema.safeParse(payload);

  if (parsed.success) {
    return new ApiClientError(
      response.status,
      parsed.data.error_code,
      parsed.data.message,
      parsed.data.request_id,
      parsed.data.details
    );
  }

  // The body was not the documented error shape — a proxy or gateway page, most
  // likely. Fall back to the status so the caller still gets a usable branch.
  return new ApiClientError(
    response.status,
    "UNEXPECTED_ERROR_BODY",
    `Request to ${path} failed with status ${response.status}.`
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * What a page should do with a failure, derived from the status rather than the
 * route. Keeping the mapping in one place stops pages from inventing their own
 * retry policy for the same status.
 */
export type ApiFailureKind =
  | "unauthorized" // sign the user out and send them to login
  | "forbidden" // signed in, but not allowed
  | "not-found"
  | "conflict" // already handled; do not mint a new idempotency key
  | "validation" // show inline on the form
  | "rate-limited" // retry later, respecting Retry-After
  | "server" // retry is safe
  | "contract" // backend and web disagree; do not render partial data
  | "unknown";

export function classifyApiError(error: unknown): ApiFailureKind {
  if (error instanceof ApiContractError) return "contract";
  if (error instanceof ApiTimeoutError) return "server";
  if (!(error instanceof ApiClientError)) return "unknown";

  if (error.status === 401) return "unauthorized";
  if (error.status === 403) return "forbidden";
  if (error.status === 404) return "not-found";
  if (error.status === 409) return "conflict";
  if (error.status === 429) return "rate-limited";
  if (error.code === "INVALID_INPUT" || error.status === 422) return "validation";
  if (error.status >= 500) return "server";

  return "unknown";
}

/** True when retrying the same request could succeed, i.e. the failure was transient. */
export function isRetryableError(error: unknown): boolean {
  return classifyApiError(error) === "server";
}
