import type { LogEvent } from "@/lib/server-logger";
import { serverLogger } from "@/lib/server-logger";

import type { AiProviderFailureResult, AiProviderRequestOptions, AiProviderResult } from "./ai-provider.types";
import type { CompactDiagnosisPrompt } from "./prompts";
import { diagnosisJsonSchema, isRecord, parseJsonObjectContent, sanitizePreview } from "./provider-json";

export type GeminiErrorCode =
  | "GEMINI_MISSING_API_KEY"
  | "GEMINI_MISSING_MODEL"
  | "GEMINI_TIMEOUT"
  | "GEMINI_RATE_LIMITED"
  | "GEMINI_QUOTA_EXCEEDED"
  | "GEMINI_PROVIDER_ERROR"
  | "GEMINI_INVALID_PROVIDER_RESPONSE"
  | "GEMINI_INVALID_JSON_CONTENT";

export type GeminiClientOptions = {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  logger?: {
    info(payload: LogEvent): void;
    warn(payload: LogEvent): void;
    error(payload: LogEvent): void;
  };
  now?: () => number;
  timeoutMs?: number;
};

const geminiEndpointBase = "https://generativelanguage.googleapis.com/v1beta/models";
const defaultTimeoutMs = 6_000;
const maxOutputTokens = 360;

export class GeminiClient {
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetcher: typeof fetch;
  private readonly logger: NonNullable<GeminiClientOptions["logger"]>;
  private readonly now: () => number;
  private readonly timeoutMs: number;

  constructor(options: GeminiClientOptions = {}) {
    this.env = options.env ?? process.env;
    this.fetcher = options.fetch ?? fetch;
    this.logger = options.logger ?? serverLogger;
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  }

  async createDiagnosisJson(
    prompt: CompactDiagnosisPrompt,
    requestOptions: AiProviderRequestOptions = {}
  ): Promise<AiProviderResult> {
    const apiKey = this.env.GEMINI_API_KEY?.trim();
    const model = this.env.GEMINI_MODEL?.trim();

    if (!apiKey) {
      return geminiFailure("GEMINI_MISSING_API_KEY");
    }

    if (!model) {
      return geminiFailure("GEMINI_MISSING_MODEL");
    }

    return this.createDiagnosisJsonWithModel(apiKey, model, prompt, requestOptions);
  }

  private async createDiagnosisJsonWithModel(
    apiKey: string,
    model: string,
    prompt: CompactDiagnosisPrompt,
    requestOptions: AiProviderRequestOptions
  ): Promise<AiProviderResult> {
    const startedAt = this.now();
    const timeoutMs = timeoutForAttempt(this.now(), this.timeoutMs, requestOptions);
    if (timeoutMs <= 0) {
      return geminiFailure("GEMINI_TIMEOUT", {
        providerModel: model,
        invalidResponseReason: "deadline_exhausted_before_request"
      });
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);

    this.logger.info({
      event: "chatbot.gemini.started",
      api_http_status: "started",
      model
    });

    try {
      const response = await this.fetcher(createEndpoint(model), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(createRequestBody(prompt)),
        signal: abortController.signal
      });
      const apiHttpStatus = String(response.status);

      if (!response.ok) {
        const errorMetadata = await parseGeminiErrorResponse(response);
        const errorCode = geminiErrorCodeForStatus(response.status, errorMetadata.geminiErrorStatus);
        const failureResult = geminiFailure(errorCode, {
          apiHttpStatus,
          providerModel: model,
          ...errorMetadata
        });
        this.logFailure(errorCode, startedAt, model, failureResult);
        return failureResult;
      }

      const parsedResponse = await parseGeminiProviderResponse(response);
      if (!parsedResponse.success) {
        const failureResult = geminiFailure(parsedResponse.errorCode, {
          apiHttpStatus,
          providerModel: model,
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
        provider: "gemini",
        providerModel: model
      };
    } catch (error) {
      const errorCode = isAbortError(error) ? "GEMINI_TIMEOUT" : "GEMINI_PROVIDER_ERROR";
      this.logFailure(errorCode, startedAt, model);
      return geminiFailure(errorCode, { providerModel: model });
    } finally {
      clearTimeout(timeout);
    }
  }

  private logFailure(
    errorCode: GeminiErrorCode,
    startedAt: number,
    model: string,
    failure?: AiProviderFailureResult
  ) {
    this.logger.warn({
      event: "chatbot.gemini.failed",
      error_code: errorCode,
      api_http_status: failure?.apiHttpStatus,
      provider_status: failure?.providerName,
      provider_model: failure?.providerModel,
      invalid_response_reason: failure?.invalidResponseReason,
      response_preview: failure?.responsePreview,
      latency_ms: this.now() - startedAt,
      model
    });
  }
}

export const geminiClient = new GeminiClient();

function createEndpoint(model: string): string {
  return `${geminiEndpointBase}/${encodeURIComponent(model)}:generateContent`;
}

function createRequestBody(prompt: CompactDiagnosisPrompt): Record<string, unknown> {
  return {
    contents: [
      {
        parts: [
          {
            text: prompt.messages
              .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
              .join("\n\n")
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens,
      responseFormat: {
        text: {
          mimeType: "application/json",
          schema: diagnosisJsonSchema
        }
      }
    }
  };
}

async function parseGeminiProviderResponse(response: Response): Promise<
  | { success: true; json: unknown }
  | {
      success: false;
      errorCode: "GEMINI_TIMEOUT" | "GEMINI_INVALID_PROVIDER_RESPONSE" | "GEMINI_INVALID_JSON_CONTENT";
      reason: string;
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
        errorCode: "GEMINI_TIMEOUT",
        reason: "provider_body_read_aborted"
      };
    }

    return {
      success: false,
      errorCode: "GEMINI_INVALID_PROVIDER_RESPONSE",
      reason: "provider_response_not_json"
    };
  }

  if (!isRecord(providerJson)) {
    return {
      success: false,
      errorCode: "GEMINI_INVALID_PROVIDER_RESPONSE",
      reason: "provider_response_not_object"
    };
  }

  const text = extractCandidateText(providerJson as GeminiGenerateContentResponse);
  if (!text) {
    return {
      success: false,
      errorCode: "GEMINI_INVALID_PROVIDER_RESPONSE",
      reason: "missing_candidate_text",
      responsePreview: sanitizePreview(JSON.stringify(providerJson).slice(0, 480))
    };
  }

  const parsedContent = parseJsonObjectContent(text);
  if (!parsedContent.success) {
    return {
      success: false,
      errorCode: "GEMINI_INVALID_JSON_CONTENT",
      reason: parsedContent.reason,
      responsePreview: sanitizePreview(text)
    };
  }

  return {
    success: true,
    json: parsedContent.json
  };
}

function extractCandidateText(response: GeminiGenerateContentResponse): string | undefined {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return undefined;
  }

  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  return text || undefined;
}

function geminiFailure(errorCode: GeminiErrorCode, metadata: GeminiFailureMetadata = {}): AiProviderFailureResult {
  return {
    success: false,
    provider: "gemini",
    errorCode,
    message: "Gemini unavailable. Trying fallback provider or safe fallback diagnosis.",
    ...metadata
  };
}

function geminiErrorCodeForStatus(status: number, geminiStatus?: string): GeminiErrorCode {
  if (status === 429 || geminiStatus === "RESOURCE_EXHAUSTED") {
    return "GEMINI_QUOTA_EXCEEDED";
  }

  if (status === 503 || status === 504) {
    return "GEMINI_TIMEOUT";
  }

  return "GEMINI_PROVIDER_ERROR";
}

async function parseGeminiErrorResponse(response: Response): Promise<GeminiFailureMetadata> {
  try {
    const body = (await response.json()) as GeminiErrorResponse;
    const status = body.error?.status;
    const code = body.error?.code;

    return {
      ...(typeof status === "string" ? { providerName: status, geminiErrorStatus: status } : {}),
      ...(typeof code === "number" ? { provider_status_code: String(code) } : {})
    };
  } catch {
    return {};
  }
}

function timeoutForAttempt(now: number, defaultTimeout: number, requestOptions: AiProviderRequestOptions): number {
  const configuredTimeout = requestOptions.timeoutMs ?? defaultTimeout;
  const remainingMs = typeof requestOptions.deadlineAt === "number" ? requestOptions.deadlineAt - now : undefined;

  if (remainingMs === undefined) {
    return configuredTimeout;
  }

  return Math.min(configuredTimeout, remainingMs);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
      }>;
    };
  }>;
};

type GeminiErrorResponse = {
  error?: {
    code?: unknown;
    status?: unknown;
  };
};

type GeminiFailureMetadata = {
  apiHttpStatus?: string;
  providerName?: string;
  providerModel?: string;
  invalidResponseReason?: string;
  responsePreview?: string;
  geminiErrorStatus?: string;
  [key: string]: unknown;
};
