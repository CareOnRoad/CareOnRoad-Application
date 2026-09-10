import { describe, expect, it } from "vitest";

import { checkChatbotRateLimit, createRateLimitHeaders, InMemoryRateLimiter } from "../rate-limit";

describe("InMemoryRateLimiter", () => {
  it("allows diagnosis requests under the session limit", () => {
    const limiter = new InMemoryRateLimiter({ now: () => 0, sessionLimit: 10 });

    for (let index = 0; index < 10; index += 1) {
      const decision = limiter.check({
        sessionId: "session-1",
        inputMode: "text"
      });

      expect(decision.allowed).toBe(true);
    }
  });

  it("blocks diagnosis requests over the session limit", () => {
    const limiter = new InMemoryRateLimiter({ now: () => 0, sessionLimit: 10 });

    for (let index = 0; index < 10; index += 1) {
      limiter.check({ sessionId: "session-1", inputMode: "text" });
    }

    const blocked = limiter.check({ sessionId: "session-1", inputMode: "text" });

    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe("AI_SESSION_LIMIT_EXCEEDED");
    expect(blocked.scope).toBe("session");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("uses a stricter per-session voice limit", () => {
    const limiter = new InMemoryRateLimiter({ now: () => 0, voiceSessionLimit: 5 });

    for (let index = 0; index < 5; index += 1) {
      expect(limiter.check({ sessionId: "session-voice", inputMode: "voice" }).allowed).toBe(true);
    }

    const blocked = limiter.check({ sessionId: "session-voice", inputMode: "voice" });

    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe("AI_SESSION_LIMIT_EXCEEDED");
    expect(blocked.scope).toBe("voice_session");
  });

  it("uses a separate per-session transcription limit", () => {
    const limiter = new InMemoryRateLimiter({
      now: () => 0,
      sessionLimit: 1,
      voiceSessionLimit: 1,
      transcriptionSessionLimit: 2
    });

    expect(limiter.checkTranscriptionRequest({ sessionId: "session-asr", inputMode: "voice" }).allowed).toBe(
      true
    );
    expect(limiter.checkTranscriptionRequest({ sessionId: "session-asr", inputMode: "voice" }).allowed).toBe(
      true
    );

    const blocked = limiter.checkTranscriptionRequest({ sessionId: "session-asr", inputMode: "voice" });

    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe("AI_SESSION_LIMIT_EXCEEDED");
    expect(blocked.scope).toBe("transcription_session");
  });

  it("resets after the configured time window", () => {
    let now = 0;
    const limiter = new InMemoryRateLimiter({
      now: () => now,
      windowMs: 1000,
      sessionLimit: 1
    });

    expect(limiter.check({ sessionId: "session-reset", inputMode: "text" }).allowed).toBe(true);
    expect(limiter.check({ sessionId: "session-reset", inputMode: "text" }).allowed).toBe(false);

    now = 1001;

    expect(limiter.check({ sessionId: "session-reset", inputMode: "text" }).allowed).toBe(true);
  });

  it("enforces IP fallback limit when IP is available", () => {
    const limiter = new InMemoryRateLimiter({ now: () => 0, ipLimit: 2 });

    expect(limiter.check({ ip: "127.0.0.1", inputMode: "text" }).allowed).toBe(true);
    expect(limiter.check({ ip: "127.0.0.1", inputMode: "text" }).allowed).toBe(true);

    const blocked = limiter.check({ ip: "127.0.0.1", inputMode: "text" });

    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe("RATE_LIMITED");
    expect(blocked.scope).toBe("ip");
  });

  it("provides a route-friendly helper and headers for 429 mapping", () => {
    const limiter = new InMemoryRateLimiter({ now: () => 0, sessionLimit: 1 });

    expect(checkChatbotRateLimit({ sessionId: "session-helper", inputMode: "text" }, limiter).allowed).toBe(
      true
    );

    const blocked = checkChatbotRateLimit({ sessionId: "session-helper", inputMode: "text" }, limiter);
    const headers = createRateLimitHeaders(blocked);

    expect(blocked.allowed).toBe(false);
    expect(headers.get("Retry-After")).toBeTruthy();
    expect(headers.get("X-RateLimit-Limit")).toBe("1");
  });
});
