import { createSign } from "node:crypto";

import type {
  NotificationProvider,
  NotificationProviderInput,
  NotificationProviderOutcome
} from "./notification-provider";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const DEFAULT_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_TIMEOUT_MS = 8_000;

export type FcmConfiguration = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  tokenUrl?: string;
  timeoutMs?: number;
};

type AccessToken = { value: string; expiresAt: number };

export class FcmNotificationProvider implements NotificationProvider {
  private accessToken?: AccessToken;

  constructor(
    private readonly configuration: FcmConfiguration,
    private readonly dependencies: {
      fetch?: typeof fetch;
      now?: () => Date;
    } = {}
  ) {}

  async send(input: NotificationProviderInput): Promise<NotificationProviderOutcome> {
    if (input.provider !== "fcm") {
      return { kind: "permanent_failure", errorCode: "PUSH_PROVIDER_UNSUPPORTED" };
    }
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetchWithTimeout(
        this.dependencies.fetch ?? fetch,
        `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
          this.configuration.projectId
        )}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: {
              token: input.credential,
              notification: { title: input.title, body: input.body },
              data: stringifyData(input.data)
            }
          })
        },
        this.configuration.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );
      const payload = await safeJson(response);
      if (response.ok) {
        const name = readString(payload, "name");
        return {
          kind: "success",
          ...(name ? { providerMessageId: name.slice(0, 300) } : {})
        };
      }
      return classifyFcmFailure(response, payload);
    } catch (error) {
      if (error instanceof FcmConfigurationError) {
        return { kind: "permanent_failure", errorCode: error.errorCode };
      }
      if (error instanceof ProviderTimeoutError) {
        return { kind: "timeout", errorCode: "FCM_TIMEOUT" };
      }
      return { kind: "temporary_failure", errorCode: "FCM_UNAVAILABLE" };
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = (this.dependencies.now?.() ?? new Date()).getTime();
    if (this.accessToken && this.accessToken.expiresAt - 60_000 > now) {
      return this.accessToken.value;
    }
    const assertion = createServiceAccountAssertion(this.configuration, Math.floor(now / 1000));
    const response = await fetchWithTimeout(
      this.dependencies.fetch ?? fetch,
      this.configuration.tokenUrl ?? DEFAULT_TOKEN_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion
        }).toString()
      },
      this.configuration.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
    const payload = await safeJson(response);
    const value = readString(payload, "access_token");
    const expiresIn = readNumber(payload, "expires_in");
    if (!response.ok || !value || !expiresIn) {
      if (response.status >= 500 || response.status === 429) {
        throw new Error("FCM_AUTH_UNAVAILABLE");
      }
      throw new FcmConfigurationError("FCM_AUTH_CONFIGURATION_INVALID");
    }
    this.accessToken = { value, expiresAt: now + expiresIn * 1000 };
    return value;
  }
}

export function createFcmNotificationProvider(
  environment: Record<string, string | undefined> = process.env
): NotificationProvider {
  const projectId = environment.FCM_PROJECT_ID?.trim();
  const clientEmail = environment.FCM_CLIENT_EMAIL?.trim();
  const privateKey = environment.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!projectId || !clientEmail || !privateKey) {
    return {
      async send() {
        return {
          kind: "temporary_failure",
          errorCode: "PUSH_PROVIDER_NOT_CONFIGURED"
        };
      }
    };
  }
  const configuredTimeout = Number(environment.FCM_TIMEOUT_MS);
  return new FcmNotificationProvider({
    projectId,
    clientEmail,
    privateKey,
    ...(environment.FCM_TOKEN_URL ? { tokenUrl: environment.FCM_TOKEN_URL } : {}),
    ...(Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? { timeoutMs: Math.min(configuredTimeout, 30_000) }
      : {})
  });
}

function createServiceAccountAssertion(configuration: FcmConfiguration, nowSeconds: number) {
  const header = encodeJson({ alg: "RS256", typ: "JWT" });
  const claims = encodeJson({
    iss: configuration.clientEmail,
    scope: FCM_SCOPE,
    aud: configuration.tokenUrl ?? DEFAULT_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600
  });
  const unsigned = `${header}.${claims}`;
  try {
    const signature = createSign("RSA-SHA256")
      .update(unsigned)
      .end()
      .sign(configuration.privateKey)
      .toString("base64url");
    return `${unsigned}.${signature}`;
  } catch {
    throw new FcmConfigurationError("FCM_AUTH_CONFIGURATION_INVALID");
  }
}

function classifyFcmFailure(response: Response, payload: unknown): NotificationProviderOutcome {
  const providerCode = extractProviderCode(payload);
  if (providerCode === "UNREGISTERED" || providerCode === "SENDER_ID_MISMATCH") {
    return { kind: "invalid_credential", errorCode: `FCM_${providerCode}` };
  }
  if (response.status === 429 || providerCode === "QUOTA_EXCEEDED") {
    return {
      kind: "throttled",
      errorCode: "FCM_THROTTLED",
      ...(parseRetryAfter(response.headers.get("retry-after"))
        ? { retryAfter: parseRetryAfter(response.headers.get("retry-after")) }
        : {})
    };
  }
  if (response.status === 408) {
    return { kind: "timeout", errorCode: "FCM_TIMEOUT" };
  }
  if (response.status >= 500 || providerCode === "UNAVAILABLE" || providerCode === "INTERNAL") {
    return { kind: "temporary_failure", errorCode: "FCM_UNAVAILABLE", retryAfter: parseRetryAfter(response.headers.get("retry-after")) };
  }
  return { kind: "permanent_failure", errorCode: "FCM_REJECTED" };
}

function extractProviderCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return undefined;
  const error = payload.error;
  if (!error || typeof error !== "object") return undefined;
  if ("details" in error && Array.isArray(error.details)) {
    for (const detail of error.details) {
      if (detail && typeof detail === "object" && "@type" in detail &&
        detail["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError" &&
        "errorCode" in detail && typeof detail.errorCode === "string") {
        return detail.errorCode;
      }
    }
  }
  return "status" in error && typeof error.status === "string" ? error.status : undefined;
}

function stringifyData(data: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value)
    ])
  );
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function readString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return typeof record[key] === "string" ? record[key] : undefined;
}

function readNumber(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return typeof record[key] === "number" ? record[key] : undefined;
}

function encodeJson(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseRetryAfter(value: string | null): Date | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return new Date(Date.now() + seconds * 1000);
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp;
}

async function fetchWithTimeout(
  fetchImplementation: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImplementation(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new ProviderTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class ProviderTimeoutError extends Error {}

class FcmConfigurationError extends Error {
  constructor(readonly errorCode: string) {
    super(errorCode);
  }
}
