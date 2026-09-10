import type { LogEvent } from "@/lib/server-logger";
import { serverLogger } from "@/lib/server-logger";

import type {
  AiDiagnosisJsonProvider,
  AiProviderFailureResult,
  AiProviderName,
  AiProviderResult
} from "./ai-provider.types";
import { geminiClient } from "./gemini.client";
import { openRouterClient } from "./openrouter.client";
import type { CompactDiagnosisPrompt } from "./prompts";
import { createCircuit } from "@/server/runtime-controls/runtime-control.factory";
import type { ProviderCircuitControl } from "@/server/runtime-controls/provider-circuit-breaker";

export { InMemoryProviderCircuitBreaker as ProviderCircuitBreaker } from "@/server/runtime-controls/provider-circuit-breaker";

export type AiDiagnosisClientOptions = {
  env?: NodeJS.ProcessEnv;
  gemini?: AiDiagnosisJsonProvider;
  openRouter?: AiDiagnosisJsonProvider;
  logger?: {
    info(payload: LogEvent): void;
    warn(payload: LogEvent): void;
    error(payload: LogEvent): void;
  };
  now?: () => number;
  circuitBreaker?: ProviderCircuitControl;
};

type ProviderPlanItem = {
  name: AiProviderName;
  client: AiDiagnosisJsonProvider;
  timeoutMs: number;
};

const defaultTotalTimeoutMs = 10_000;
const defaultGeminiTimeoutMs = 6_000;
const defaultOpenRouterTimeoutMs = 4_000;

export class AiDiagnosisClient {
  private readonly env: NodeJS.ProcessEnv;
  private readonly gemini: AiDiagnosisJsonProvider;
  private readonly openRouter: AiDiagnosisJsonProvider;
  private readonly logger: NonNullable<AiDiagnosisClientOptions["logger"]>;
  private readonly now: () => number;
  private readonly circuitBreaker: ProviderCircuitControl;

  constructor(options: AiDiagnosisClientOptions = {}) {
    this.env = options.env ?? process.env;
    this.gemini = options.gemini ?? geminiClient;
    this.openRouter = options.openRouter ?? openRouterClient;
    this.logger = options.logger ?? serverLogger;
    this.now = options.now ?? Date.now;
    this.circuitBreaker = options.circuitBreaker ?? createCircuit(this.env);
  }

  async createDiagnosisJson(prompt: CompactDiagnosisPrompt): Promise<AiProviderResult> {
    const deadlineAt = this.now() + readPositiveInt(this.env.AI_TOTAL_TIMEOUT_MS, defaultTotalTimeoutMs);
    let latestFailure: AiProviderResult | undefined;

    for (const provider of this.createProviderPlan()) {
      const remainingMs = deadlineAt - this.now();
      if (remainingMs <= 0) {
        return latestFailure ?? aiFailure("AI_TOTAL_TIMEOUT", {
          invalidResponseReason: "deadline_exhausted_before_provider"
        });
      }

      if (await this.circuitBreaker.isOpen(provider.name)) {
        const failure = aiFailure("AI_PROVIDER_CIRCUIT_OPEN", {
          provider: provider.name,
          invalidResponseReason: "provider_circuit_open"
        });
        latestFailure = failure;
        this.logger.warn({
          event: "chatbot.ai_provider.skipped",
          provider: provider.name,
          error_code: failure.errorCode,
          invalid_response_reason: failure.invalidResponseReason
        });
        continue;
      }

      const result = await provider.client.createDiagnosisJson(prompt, {
        deadlineAt,
        retryWithRetryAfter: false,
        timeoutMs: Math.min(provider.timeoutMs, remainingMs)
      });

      if (result.success) {
        await this.circuitBreaker.recordSuccess(provider.name);
        return {
          ...result,
          provider: result.provider ?? provider.name
        };
      }

      const providerFailure = {
        ...result,
        provider: result.provider ?? provider.name
      };
      latestFailure = providerFailure;
      await this.circuitBreaker.recordFailure(provider.name);
    }

    return latestFailure ?? aiFailure("AI_ALL_PROVIDERS_UNAVAILABLE");
  }

  private createProviderPlan(): ProviderPlanItem[] {
    return [
      {
        name: "gemini",
        client: this.gemini,
        timeoutMs: readPositiveInt(this.env.GEMINI_TIMEOUT_MS, defaultGeminiTimeoutMs)
      },
      {
        name: "openrouter",
        client: this.openRouter,
        timeoutMs: readPositiveInt(this.env.OPENROUTER_TIMEOUT_MS, defaultOpenRouterTimeoutMs)
      }
    ];
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
