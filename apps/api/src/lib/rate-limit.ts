import type { ApiErrorCode } from "./api-error";

export type ChatbotInputMode = "text" | "voice";

export type RateLimitDecision = {
  allowed: boolean;
  code?: ApiErrorCode;
  message?: string;
  retryAfterSeconds?: number;
  limit?: number;
  remaining?: number;
  resetAt?: number;
  scope?: "session" | "ip" | "voice_session" | "transcription_session";
};

export type RateLimitRequest = {
  sessionId?: string;
  ip?: string;
  inputMode: ChatbotInputMode;
};

export type RateLimiter = {
  checkDiagnosisRequest(request: RateLimitRequest): RateLimitDecision | Promise<RateLimitDecision>;
  checkTranscriptionRequest(request: RateLimitRequest): RateLimitDecision | Promise<RateLimitDecision>;
};

export type RateLimiterOptions = {
  now?: () => number;
  windowMs?: number;
  sessionLimit?: number;
  ipLimit?: number;
  voiceSessionLimit?: number;
  transcriptionSessionLimit?: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_SESSION_LIMIT = 10;
const DEFAULT_IP_LIMIT = 30;
const DEFAULT_VOICE_SESSION_LIMIT = 5;
const DEFAULT_TRANSCRIPTION_SESSION_LIMIT = 30;

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly now: () => number;
  private readonly windowMs: number;
  private readonly sessionLimit: number;
  private readonly ipLimit: number;
  private readonly voiceSessionLimit: number;
  private readonly transcriptionSessionLimit: number;

  constructor(options: RateLimiterOptions = {}) {
    this.now = options.now ?? Date.now;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.sessionLimit = options.sessionLimit ?? DEFAULT_SESSION_LIMIT;
    this.ipLimit = options.ipLimit ?? DEFAULT_IP_LIMIT;
    this.voiceSessionLimit = options.voiceSessionLimit ?? DEFAULT_VOICE_SESSION_LIMIT;
    this.transcriptionSessionLimit =
      options.transcriptionSessionLimit ?? DEFAULT_TRANSCRIPTION_SESSION_LIMIT;
  }

  check(request: RateLimitRequest): RateLimitDecision {
    const decisions: RateLimitDecision[] = [];

    if (request.sessionId) {
      decisions.push(this.consume(`session:${request.sessionId}`, this.sessionLimit, "session"));
    }

    if (request.ip) {
      decisions.push(this.consume(`ip:${request.ip}`, this.ipLimit, "ip"));
    }

    if (request.inputMode === "voice" && request.sessionId) {
      decisions.push(
        this.consume(`voice_session:${request.sessionId}`, this.voiceSessionLimit, "voice_session")
      );
    }

    return decisions.find((decision) => !decision.allowed) ?? this.allowedDecision(decisions);
  }

  checkDiagnosisRequest(request: RateLimitRequest): RateLimitDecision {
    return this.check(request);
  }

  checkTranscriptionRequest(request: RateLimitRequest): RateLimitDecision {
    const decisions: RateLimitDecision[] = [];

    if (request.sessionId) {
      decisions.push(
        this.consume(
          `transcription_session:${request.sessionId}`,
          this.transcriptionSessionLimit,
          "transcription_session"
        )
      );
    }

    if (request.ip) {
      decisions.push(this.consume(`ip:${request.ip}`, this.ipLimit, "ip"));
    }

    return decisions.find((decision) => !decision.allowed) ?? this.allowedDecision(decisions);
  }

  reset() {
    this.buckets.clear();
  }

  private consume(
    key: string,
    limit: number,
    scope: NonNullable<RateLimitDecision["scope"]>
  ): RateLimitDecision {
    const now = this.now();
    const existing = this.buckets.get(key);
    const bucket =
      existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + this.windowMs };

    bucket.count += 1;
    this.buckets.set(key, bucket);

    const remaining = Math.max(limit - bucket.count, 0);
    const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);

    if (bucket.count > limit) {
      const message =
        scope === "ip"
          ? "Too many requests from this IP."
          : scope === "transcription_session"
            ? "Too many transcription requests for this session."
            : "Too many diagnosis requests for this session.";

      return {
        allowed: false,
        code: scope === "ip" ? "RATE_LIMITED" : "AI_SESSION_LIMIT_EXCEEDED",
        message,
        retryAfterSeconds,
        limit,
        remaining: 0,
        resetAt: bucket.resetAt,
        scope
      };
    }

    return {
      allowed: true,
      limit,
      remaining,
      resetAt: bucket.resetAt,
      scope
    };
  }

  private allowedDecision(decisions: RateLimitDecision[]): RateLimitDecision {
    const remaining = decisions.reduce<number | undefined>((lowest, decision) => {
      if (decision.remaining === undefined) return lowest;
      return lowest === undefined ? decision.remaining : Math.min(lowest, decision.remaining);
    }, undefined);

    return {
      allowed: true,
      remaining
    };
  }
}

export const chatbotRateLimiter = new InMemoryRateLimiter();

export function checkChatbotRateLimit(
  request: RateLimitRequest,
  limiter: InMemoryRateLimiter = chatbotRateLimiter
): RateLimitDecision {
  return limiter.checkDiagnosisRequest(request);
}

export function createRateLimitHeaders(decision: RateLimitDecision): Headers {
  const headers = new Headers();

  if (decision.limit !== undefined) {
    headers.set("X-RateLimit-Limit", String(decision.limit));
  }

  if (decision.remaining !== undefined) {
    headers.set("X-RateLimit-Remaining", String(decision.remaining));
  }

  if (decision.resetAt !== undefined) {
    headers.set("X-RateLimit-Reset", String(Math.ceil(decision.resetAt / 1000)));
  }

  if (!decision.allowed && decision.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(decision.retryAfterSeconds));
  }

  return headers;
}
