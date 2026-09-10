import { describe, expect, it } from "vitest";

import {
  createServerLogger,
  createTextLogMetadata,
  sanitizeLogPayload,
  type StructuredLogRecord
} from "../server-logger";

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

describe("server logger", () => {
  it("outputs structured log objects", () => {
    const records: StructuredLogRecord[] = [];
    const logger = createServerLogger({
      info: (record) => records.push(record),
      warn: (record) => records.push(record),
      error: (record) => records.push(record)
    });

    logger.info({
      event: "chatbot.diagnosis.completed",
      session_id: "session-1",
      fallback_used: true,
      risk_level: "medium"
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      level: "info",
      event: "chatbot.diagnosis.completed",
      session_id: "session-1",
      fallback_used: true,
      risk_level: "medium"
    });
    expect(typeof records[0]?.timestamp).toBe("string");
  });

  it("does not include raw symptom text and derives text metadata", () => {
    const payload = sanitizeLogPayload({
      event: "chatbot.message.received",
      content_text: "Xe đang chạy bị mất phanh",
      request_id: "req-1"
    });
    const serialized = stringify(payload);

    expect(serialized).not.toContain("Xe đang chạy bị mất phanh");
    expect(payload).toMatchObject({
      event: "chatbot.message.received",
      request_id: "req-1",
      text_length: "Xe đang chạy bị mất phanh".length
    });
    expect(typeof payload.text_hash).toBe("string");
  });

  it("does not include API keys, tokens, raw audio, phone, email, or payment fields", () => {
    const payload = sanitizeLogPayload({
      event: "chatbot.openrouter.started",
      openrouter_api_key: "sk-secret",
      token: "token-secret",
      raw_audio: new Uint8Array([1, 2, 3]),
      phone: "0909123456",
      email: "rider@example.com",
      payment_card: "4111111111111111",
      nested: {
        audio_file: "voice.wav",
        authorization: "Bearer abc"
      }
    });
    const serialized = stringify(payload);

    expect(serialized).not.toContain("sk-secret");
    expect(serialized).not.toContain("token-secret");
    expect(serialized).not.toContain("0909123456");
    expect(serialized).not.toContain("rider@example.com");
    expect(serialized).not.toContain("4111111111111111");
    expect(payload).not.toHaveProperty("raw_audio");
    expect(payload).not.toHaveProperty("openrouter_api_key");
    expect(payload).not.toHaveProperty("payment_card");
    expect(payload.nested).toEqual({});
  });

  it("includes allowed metadata", () => {
    const metadata = createTextLogMetadata("Xe hao xăng");
    const payload = sanitizeLogPayload({
      event: "chatbot.fallback.used",
      session_id: "session-2",
      input_mode: "text",
      request_id: "req-2",
      fallback_used: true,
      risk_level: "low",
      latency_ms: 120,
      api_http_status: "skipped",
      error_code: "MISSING_API_KEY",
      ...metadata
    });

    expect(payload).toMatchObject({
      event: "chatbot.fallback.used",
      session_id: "session-2",
      input_mode: "text",
      request_id: "req-2",
      fallback_used: true,
      risk_level: "low",
      latency_ms: 120,
      api_http_status: "skipped",
      error_code: "MISSING_API_KEY",
      text_length: "Xe hao xăng".length,
      text_hash: metadata.text_hash
    });
  });

  it("can record chatbot.rate_limited events", () => {
    const records: StructuredLogRecord[] = [];
    const logger = createServerLogger({
      info: (record) => records.push(record),
      warn: (record) => records.push(record),
      error: (record) => records.push(record)
    });

    logger.warn({
      event: "chatbot.rate_limited",
      session_id: "session-3",
      input_mode: "voice",
      request_id: "req-3",
      error_code: "AI_SESSION_LIMIT_EXCEEDED"
    });

    expect(records[0]).toMatchObject({
      level: "warn",
      event: "chatbot.rate_limited",
      error_code: "AI_SESSION_LIMIT_EXCEEDED"
    });
  });
});
