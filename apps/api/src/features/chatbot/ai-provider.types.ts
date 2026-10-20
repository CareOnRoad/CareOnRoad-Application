import type { CompactDiagnosisPrompt } from "./prompts";

export type AiProviderName = "gemini";

export type AiProviderSuccessResult = {
  success: true;
  json: unknown;
  apiHttpStatus: string;
  provider?: AiProviderName;
  providerModel?: string;
};

export type AiProviderFailureResult = {
  success: false;
  errorCode: string;
  message: string;
  apiHttpStatus?: string;
  retryAfterSeconds?: number;
  provider?: AiProviderName;
  providerName?: string;
  providerModel?: string;
  invalidResponseReason?: string;
  responsePreview?: string;
};

export type AiProviderResult = AiProviderSuccessResult | AiProviderFailureResult;

export type AiProviderRequestOptions = {
  deadlineAt?: number;
  retryWithRetryAfter?: boolean;
  timeoutMs?: number;
};

export type AiDiagnosisJsonProvider = {
  createDiagnosisJson(
    prompt: CompactDiagnosisPrompt,
    options?: AiProviderRequestOptions
  ): Promise<AiProviderResult>;
};
