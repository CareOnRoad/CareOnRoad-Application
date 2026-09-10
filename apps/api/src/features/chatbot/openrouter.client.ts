import type { LogEvent } from "@/lib/server-logger";
import { serverLogger } from "@/lib/server-logger";

import type { CompactDiagnosisPrompt } from "./prompts";
import { diagnosisJsonSchema, isRecord, parseJsonObjectContent, sanitizePreview } from "./provider-json";

export type OpenRouterErrorCode =
  | "OPENROUTER_MISSING_API_KEY"
  | "OPENROUTER_MISSING_MODEL"
  | "OPENROUTER_TIMEOUT"
  | "OPENROUTER_RATE_LIMITED"
  | "OPENROUTER_PAYMENT_REQUIRED"
  | "OPENROUTER_PROVIDER_ERROR"
  | "OPENROUTER_INVALID_PROVIDER_RESPONSE"
  | "OPENROUTER_INVALID_JSON_CONTENT"
  | "OPENROUTER_INVALID_RESPONSE";

export type OpenRouterSuccessResult = {
  success: true;
  json: unknown;
  apiHttpStatus: string;
  providerModel?: string;
};

export type OpenRouterFailureResult = {
  success: false;
  errorCode: OpenRouterErrorCode;
  message: string;
  apiHttpStatus?: string;
  retryAfterSeconds?: number;
  openRouterErrorCode?: string;
  openRouterErrorType?: string;
  providerName?: string;
  providerModel?: string;
  invalidResponseReason?: string;
  responsePreview?: string;
};

export type OpenRouterResult = OpenRouterSuccessResult | OpenRouterFailureResult;

export type OpenRouterClientOptions = {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  logger?: {
    info(payload: LogEvent): void;
    warn(payload: LogEvent): void;
    error(payload: LogEvent): void;
  };
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  timeoutMs?: number;
};

export type OpenRouterRequestOptions = {
  deadlineAt?: number;
  retryWithRetryAfter?: boolean;
  timeoutMs?: number;
};

const openRouterEndpoint = "https://openrouter.ai/api/v1/chat/completions";
const defaultTimeoutMs = 20_000;
const maxRetryAfterSeconds = 3;
const maxOutputTokens = 360;

export class OpenRouterClient {
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetcher: typeof fetch;
  private readonly logger: NonNullable<OpenRouterClientOptions["logger"]>;
  private readonly now: () => number;
  private readonly wait: (ms: number) => Promise<void>;
  private readonly timeoutMs: number;

  constructor(options: OpenRouterClientOptions = {}) {
    this.env = options.env ?? process.env;
    this.fetcher = options.fetch ?? fetch;
    this.logger = options.logger ?? serverLogger;
    this.now = options.now ?? Date.now;
    this.wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  }

  async createDiagnosisJson(
    prompt: CompactDiagnosisPrompt,
    requestOptions: OpenRouterRequestOptions = {}
  ): Promise<OpenRouterResult> {
    const apiKey = this.env.OPENROUTER_API_KEY?.trim();
    const models = this.createModelPlan();

    if (!apiKey) {
      return openRouterFailure("OPENROUTER_MISSING_API_KEY");
    }

    if (!models.length) {
      return openRouterFailure("OPENROUTER_MISSING_MODEL");
    }

    let latestFailure: OpenRouterFailureResult | undefined;

    for (const model of models) {
      const remainingMs = remainingDeadlineMs(this.now(), requestOptions.deadlineAt);
      if (remainingMs !== undefined && remainingMs <= 0) {
        return latestFailure ?? openRouterFailure("OPENROUTER_TIMEOUT", {
          invalidResponseReason: "deadline_exhausted_before_model"
        });
      }

      const result = await this.createDiagnosisJsonWithModel(apiKey, model, prompt, requestOptions);
      if (result.success) {
        return result;
      }
      latestFailure = result;
    }

    return latestFailure ?? openRouterFailure("OPENROUTER_PROVIDER_ERROR");
  }

  private async createDiagnosisJsonWithModel(
    apiKey: string,
    model: string,
    prompt: CompactDiagnosisPrompt,
    requestOptions: OpenRouterRequestOptions
  ): Promise<OpenRouterResult> {
    return this.createDiagnosisJsonAttempt(apiKey, model, prompt, false, requestOptions);
  }

  private async createDiagnosisJsonAttempt(
    apiKey: string,
    model: string,
    prompt: CompactDiagnosisPrompt,
    isRetry: boolean,
    requestOptions: OpenRouterRequestOptions
  ): Promise<OpenRouterResult> {
    const startedAt = this.now();
    const abortController = new AbortController();
    const timeoutMs = timeoutForAttempt(this.now(), this.timeoutMs, requestOptions);
    if (timeoutMs <= 0) {
      return openRouterFailure("OPENROUTER_TIMEOUT", {
        invalidResponseReason: "deadline_exhausted_before_request"
      });
    }

    const timeout = setTimeout(() => abortController.abort(), timeoutMs);

    this.logger.info({
      event: "chatbot.openrouter.started",
      api_http_status: "started",
      model,
      retry: isRetry
    });

    try {
      const response = await this.fetcher(openRouterEndpoint, {
        method: "POST",
        headers: this.createHeaders(apiKey),
        body: JSON.stringify(createRequestBody(model, prompt)),
        signal: abortController.signal
      });
      const apiHttpStatus = String(response.status);

      if (!response.ok) {
        const errorMetadata = await parseOpenRouterErrorResponse(response);
        const errorCode = openRouterErrorCodeForStatus(response.status);
        const retryAfterSeconds = parseRetryAfter(response.headers.get("Retry-After"));
        const failureResult = openRouterFailure(errorCode, {
          apiHttpStatus,
          retryAfterSeconds,
          ...errorMetadata
        });

        this.logFailure(errorCode, startedAt, model, failureResult);

        if (
          !isRetry &&
          requestOptions.retryWithRetryAfter !== false &&
          shouldRetryWithRetryAfter(response.status, retryAfterSeconds)
        ) {
          await this.wait(retryAfterSeconds * 1000);
          return this.createDiagnosisJsonAttempt(apiKey, model, prompt, true, requestOptions);
        }

        return failureResult;
      }

      const parsedResponse = await parseProviderResponse(response);
      if (parsedResponse.success === false && parsedResponse.errorCode === "OPENROUTER_TIMEOUT") {
        const failureResult = openRouterFailure("OPENROUTER_TIMEOUT", {
          apiHttpStatus,
          invalidResponseReason: parsedResponse.reason
        });
        this.logFailure("OPENROUTER_TIMEOUT", startedAt, model, failureResult);
        return failureResult;
      }

      if (!parsedResponse.success) {
        const failureResult = openRouterFailure(parsedResponse.errorCode, {
          apiHttpStatus,
          providerModel: parsedResponse.providerModel,
          invalidResponseReason: parsedResponse.reason,
          responsePreview: parsedResponse.responsePreview
        });
        this.logFailure(parsedResponse.errorCode, startedAt, model, failureResult);
        return failureResult;
      }

      return {
        success: true,
        json: parsedResponse.json,
        apiHttpStatus,
        providerModel: parsedResponse.providerModel
      };
    } catch (error) {
      const errorCode = isAbortError(error) ? "OPENROUTER_TIMEOUT" : "OPENROUTER_PROVIDER_ERROR";
      this.logFailure(errorCode, startedAt, model);
      return openRouterFailure(errorCode);
    } finally {
      clearTimeout(timeout);
    }
  }

  private createModelPlan(): string[] {
    const primaryModel = this.env.OPENROUTER_MODEL?.trim();
    const fallbackModel = this.env.OPENROUTER_FALLBACK_MODEL?.trim();
    const fallbackEnabled = this.env.OPENROUTER_ENABLE_MODEL_FALLBACK?.trim().toLowerCase() === "true";
    const models = [primaryModel];

    if (fallbackEnabled) {
      models.push(fallbackModel);
    }

    return [...new Set(models.filter((model): model is string => Boolean(model)))];
  }

  private createHeaders(apiKey: string): Headers {
    const headers = new Headers({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    });
    const siteUrl = this.env.OPENROUTER_SITE_URL?.trim();
    const appTitle = this.env.OPENROUTER_APP_TITLE?.trim();

    if (siteUrl) {
      headers.set("HTTP-Referer", siteUrl);
    }

    if (appTitle) {
      headers.set("X-Title", appTitle);
    }

    return headers;
  }

  private logFailure(
    errorCode: OpenRouterErrorCode,
    startedAt: number,
    model: string,
    failure?: OpenRouterFailureResult
  ) {
    this.logger.warn({
      event: "chatbot.openrouter.failed",
      error_code: errorCode,
      api_http_status: failure?.apiHttpStatus,
      retry_after: failure?.retryAfterSeconds,
      openrouter_error_code: failure?.openRouterErrorCode,
      openrouter_error_type: failure?.openRouterErrorType,
      provider_name: failure?.providerName,
      provider_model: failure?.providerModel,
      invalid_response_reason: failure?.invalidResponseReason,
      response_preview: failure?.responsePreview,
      latency_ms: this.now() - startedAt,
      model
    });
  }
}

export const openRouterClient = new OpenRouterClient();

function createRequestBody(model: string, prompt: CompactDiagnosisPrompt): Record<string, unknown> {
  return {
    model,
    provider: {
      require_parameters: true
    },
    messages: prompt.messages,
    temperature: 0.2,
    max_tokens: maxOutputTokens,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "careonroad_core_diagnosis",
        strict: true,
        schema: diagnosisJsonSchema
      }
    }
  };
}

async function parseProviderResponse(
  response: Response
): Promise<
  | { success: true; json: unknown; providerModel?: string }
  | {
      success: false;
      errorCode:
        | "OPENROUTER_TIMEOUT"
        | "OPENROUTER_INVALID_PROVIDER_RESPONSE"
        | "OPENROUTER_INVALID_JSON_CONTENT";
      reason: string;
      providerModel?: string;
      responsePreview?: string;
    }
> {
  let providerJson: unknown;

  try {
    providerJson = await response.json();
  } catch (error) {
    if (isAbortError(error)) {
      return {
        success: false,
        errorCode: "OPENROUTER_TIMEOUT",
        reason: "provider_body_read_aborted"
      };
    }

    return {
      success: false,
      errorCode: "OPENROUTER_INVALID_PROVIDER_RESPONSE",
      reason: "provider_response_not_json"
    };
  }

  if (!isRecord(providerJson)) {
    return {
      success: false,
      errorCode: "OPENROUTER_INVALID_PROVIDER_RESPONSE",
      reason: "provider_response_not_object"
    };
  }

  const chatResponse = providerJson as OpenRouterChatCompletionResponse;
  const providerModel = typeof chatResponse.model === "string" ? chatResponse.model : undefined;
  const content = chatResponse.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    return {
      success: false,
      errorCode: "OPENROUTER_INVALID_PROVIDER_RESPONSE",
      reason: "missing_message_content",
      providerModel
    };
  }

  const parsedContent = parseJsonObjectContent(content);
  if (!parsedContent.success) {
    return {
      success: false,
      errorCode: "OPENROUTER_INVALID_JSON_CONTENT",
      reason: parsedContent.reason,
      providerModel,
      responsePreview: sanitizePreview(content)
    };
  }

  return {
    success: true,
    json: parsedContent.json,
    providerModel
  };
}

function openRouterFailure(errorCode: OpenRouterErrorCode, metadata: FailureMetadata = {}): OpenRouterFailureResult {
  return {
    success: false,
    errorCode,
    message: "AI provider unavailable. Using safe fallback diagnosis.",
    ...metadata
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

type OpenRouterChatCompletionResponse = {
  model?: unknown;
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

type FailureMetadata = {
  apiHttpStatus?: string;
  retryAfterSeconds?: number;
  openRouterErrorCode?: string;
  openRouterErrorType?: string;
  providerName?: string;
  providerModel?: string;
  invalidResponseReason?: string;
  responsePreview?: string;
};

type OpenRouterErrorResponse = {
  error?: {
    code?: unknown;
    metadata?: {
      error_type?: unknown;
      provider_name?: unknown;
    };
  };
};

function openRouterErrorCodeForStatus(status: number): OpenRouterErrorCode {
  if (status === 429) {
    return "OPENROUTER_RATE_LIMITED";
  }

  if (status === 402) {
    return "OPENROUTER_PAYMENT_REQUIRED";
  }

  return "OPENROUTER_PROVIDER_ERROR";
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const retryAfterSeconds = Number(value);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds;
  }

  const retryAfterDate = Date.parse(value);
  if (!Number.isNaN(retryAfterDate)) {
    return Math.max(1, Math.ceil((retryAfterDate - Date.now()) / 1000));
  }

  return undefined;
}

function shouldRetryWithRetryAfter(status: number, retryAfterSeconds: number | undefined): retryAfterSeconds is number {
  return (
    (status === 429 || status === 503) &&
    typeof retryAfterSeconds === "number" &&
    retryAfterSeconds <= maxRetryAfterSeconds
  );
}

function remainingDeadlineMs(now: number, deadlineAt: number | undefined): number | undefined {
  return typeof deadlineAt === "number" ? deadlineAt - now : undefined;
}

function timeoutForAttempt(
  now: number,
  defaultTimeout: number,
  requestOptions: OpenRouterRequestOptions
): number {
  const configuredTimeout = requestOptions.timeoutMs ?? defaultTimeout;
  const remainingMs = remainingDeadlineMs(now, requestOptions.deadlineAt);

  if (remainingMs === undefined) {
    return configuredTimeout;
  }

  return Math.min(configuredTimeout, remainingMs);
}

async function parseOpenRouterErrorResponse(response: Response): Promise<FailureMetadata> {
  try {
    const body = (await response.json()) as OpenRouterErrorResponse;
    const errorCode = body.error?.code;
    const errorType = body.error?.metadata?.error_type;
    const providerName = body.error?.metadata?.provider_name;

    return {
      ...(typeof errorCode === "string" || typeof errorCode === "number"
        ? { openRouterErrorCode: String(errorCode) }
        : {}),
      ...(typeof errorType === "string" ? { openRouterErrorType: errorType } : {}),
      ...(typeof providerName === "string" ? { providerName } : {})
    };
  } catch {
    return {};
  }
}
