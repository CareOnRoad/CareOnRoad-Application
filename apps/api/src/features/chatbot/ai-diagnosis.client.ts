import type { LogEvent } from "@/lib/server-logger";
import { serverLogger } from "@/lib/server-logger";

import type {
  AiDiagnosisJsonProvider,
  AiProviderFailureResult,
  AiProviderResult
} from "./ai-provider.types";
import { geminiClient } from "./gemini.client";
import type { CompactDiagnosisPrompt } from "./prompts";
import { createCircuit } from "@/server/runtime-controls/runtime-control.factory";
import type { ProviderCircuitControl } from "@/server/runtime-controls/provider-circuit-breaker";

export { InMemoryProviderCircuitBreaker as ProviderCircuitBreaker } from "@/server/runtime-controls/provider-circuit-breaker";

export type AiDiagnosisClientOptions = {
  env?: NodeJS.ProcessEnv;
  gemini?: AiDiagnosisJsonProvider;
  logger?: {
    info(payload: LogEvent): void;
    warn(payload: LogEvent): void;
    error(payload: LogEvent): void;
  };
  now?: () => number;
  circuitBreaker?: ProviderCircuitControl;
};

const defaultTotalTimeoutMs = 10_000;
const defaultGeminiTimeoutMs = 6_000;

export class AiDiagnosisClient {
  private readonly env: NodeJS.ProcessEnv;
  private readonly gemini: AiDiagnosisJsonProvider;
  private readonly logger: NonNullable<AiDiagnosisClientOptions["logger"]>;
  private readonly now: () => number;
  private readonly circuitBreaker: ProviderCircuitControl;

  constructor(options: AiDiagnosisClientOptions = {}) {
    this.env = options.env ?? process.env;
    this.gemini = options.gemini ?? geminiClient;
    this.logger = options.logger ?? serverLogger;
    this.now = options.now ?? Date.now;
    this.circuitBreaker = options.circuitBreaker ?? createCircuit(this.env);
  }

  async createDiagnosisJson(prompt: CompactDiagnosisPrompt): Promise<AiProviderResult> {
    const deadlineAt = this.now() + readPositiveInt(this.env.AI_TOTAL_TIMEOUT_MS, defaultTotalTimeoutMs);

    if (await this.circuitBreaker.isOpen("gemini")) {
      const failure = aiFailure("AI_PROVIDER_CIRCUIT_OPEN", {
        provider: "gemini",
        invalidResponseReason: "provider_circuit_open"
      });
      this.logger.warn({
        event: "chatbot.ai_provider.skipped",
        provider: "gemini",
        error_code: failure.errorCode,
        invalid_response_reason: failure.invalidResponseReason
      });
      return failure;
    }

    const result = await this.gemini.createDiagnosisJson(prompt, {
      deadlineAt,
      retryWithRetryAfter: false,
      timeoutMs: Math.min(readPositiveInt(this.env.GEMINI_TIMEOUT_MS, defaultGeminiTimeoutMs), deadlineAt - this.now())
    });

    if (result.success) {
      await this.circuitBreaker.recordSuccess("gemini");
    } else {
      await this.circuitBreaker.recordFailure("gemini");
    }

    return { ...result, provider: result.provider ?? "gemini" };
  }
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function aiFailure(errorCode: string, metadata: Partial<AiProviderFailureResult> = {}): AiProviderFailureResult {
  return {
    success: false,
    errorCode,
    message: "AI providers unavailable. Using safe fallback diagnosis.",
    ...metadata
  };
}

export const aiDiagnosisClient = new AiDiagnosisClient();
