import { describe, expect, it, vi } from "vitest";

import type { LogEvent } from "@/lib/server-logger";

import { OpenRouterClient } from "../openrouter.client";

const prompt = {
  messages: [
    {
      role: "system" as const,
      content: "JSON only"
    },
    {
      role: "user" as const,
      content: "xe kho de"
    }
  ]
};

const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  OPENROUTER_API_KEY: "secret-test-key",
  OPENROUTER_MODEL: "openrouter/test-model",
  OPENROUTER_SITE_URL: "http://localhost:3000",
  OPENROUTER_APP_TITLE: "CareOnRoad"
};

describe("OpenRouterClient", () => {
  it("returns controlled failure when API key is missing", async () => {
    const fetch = vi.fn();
    const { client } = createClient({
      env: { NODE_ENV: "test", OPENROUTER_MODEL: "openrouter/test-model" },
      fetch: fetch as unknown as typeof globalThis.fetch
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toMatchObject({
      success: false,
      errorCode: "OPENROUTER_MISSING_API_KEY"
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns controlled failure when request times out", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(
      () =>
        new Promise<Response>((_resolve, reject) => {
          setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 20);
        })
    );
    const { client } = createClient({ fetch, timeoutMs: 10 });

    const promise = client.createDiagnosisJson(prompt);
    await vi.advanceTimersByTimeAsync(20);
    const result = await promise;
    vi.useRealTimers();

    expect(result).toMatchObject({
      success: false,
      errorCode: "OPENROUTER_TIMEOUT"
    });
  });

  it("returns controlled failure for non-200 provider response", async () => {
    const { client } = createClient({
      fetch: async () =>
        Response.json(
          {
            error: {
              code: 429,
              metadata: {
                error_type: "rate_limit_exceeded",
                provider_name: "Qwen"
              }
            }
          },
          {
            status: 429,
            statusText: "Too Many Requests",
            headers: {
              "Retry-After": "10"
            }
          }
        )
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toMatchObject({
      success: false,
      errorCode: "OPENROUTER_RATE_LIMITED",
      apiHttpStatus: "429",
      retryAfterSeconds: 10,
      openRouterErrorCode: "429",
      openRouterErrorType: "rate_limit_exceeded",
      providerName: "Qwen"
    });
  });

  it("retries once when Retry-After is short", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [{ message: { content: JSON.stringify({ short_answer: "Da on." }) } }]
        })
      );
    const wait = vi.fn(async () => undefined);
    const { client } = createClient({ fetch: fetch as unknown as typeof globalThis.fetch, wait });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toEqual({
      success: true,
      json: { short_answer: "Da on." },
      apiHttpStatus: "200"
    });
    expect(wait).toHaveBeenCalledWith(2000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("tries configured fallback model after primary model failure", async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      if (requestBodies.length === 1) {
        return new Response("busy", { status: 503 });
      }

      return Response.json({
        choices: [{ message: { content: JSON.stringify({ short_answer: "Fallback ok." }) } }]
      });
    });
    const { client } = createClient({
      env: {
        ...env,
        OPENROUTER_ENABLE_MODEL_FALLBACK: "true",
        OPENROUTER_FALLBACK_MODEL: "openrouter/free"
      },
      fetch: fetch as unknown as typeof globalThis.fetch
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toMatchObject({
      success: true,
      apiHttpStatus: "200"
    });
    expect(requestBodies.map((body) => body.model)).toEqual(["openrouter/test-model", "openrouter/free"]);
  });

  it("returns controlled failure for missing provider content", async () => {
    const { client } = createClient({
      fetch: async () =>
        Response.json({
          model: "provider/test-model",
          choices: [{ message: {} }]
        })
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toMatchObject({
      success: false,
      errorCode: "OPENROUTER_INVALID_PROVIDER_RESPONSE",
      providerModel: "provider/test-model",
      invalidResponseReason: "missing_message_content"
    });
  });

  it("returns controlled failure for invalid JSON response content", async () => {
    const { client } = createClient({
      fetch: async () =>
        Response.json({
          model: "provider/test-model",
          choices: [{ message: { content: "not-json" } }]
        })
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toMatchObject({
      success: false,
      errorCode: "OPENROUTER_INVALID_JSON_CONTENT",
      providerModel: "provider/test-model",
      invalidResponseReason: "no_json_object_found",
      responsePreview: "not-json"
    });
  });

  it("returns timeout when provider body read is aborted", async () => {
    const response = Response.json({ choices: [] });
    vi.spyOn(response, "json").mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const { client } = createClient({
      fetch: async () => response
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toMatchObject({
      success: false,
      errorCode: "OPENROUTER_TIMEOUT",
      apiHttpStatus: "200",
      invalidResponseReason: "provider_body_read_aborted"
    });
  });

  it("extracts JSON object from fenced provider content", async () => {
    const { client } = createClient({
      fetch: async () =>
        Response.json({
          model: "provider/test-model",
          choices: [
            {
              message: {
                content: '```json\n{"short_answer":"Can kiem tra binh."}\n```'
              }
            }
          ]
        })
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toEqual({
      success: true,
      json: { short_answer: "Can kiem tra binh." },
      apiHttpStatus: "200",
      providerModel: "provider/test-model"
    });
  });

  it("repairs provider content with a missing final JSON object brace", async () => {
    const { client } = createClient({
      fetch: async () =>
        Response.json({
          model: "liquid/lfm-2.5-1.2b-instruct-20260120:free",
          choices: [
            {
              message: {
                content:
                  '{"actions":["Kiem tra binh"],"answer":"Can kiem tra nhanh.","issue":"Pin yeu","part":"BATTERY","questions":[],"ride":true'
              }
            }
          ]
        })
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toEqual({
      success: true,
      json: {
        actions: ["Kiem tra binh"],
        answer: "Can kiem tra nhanh.",
        issue: "Pin yeu",
        part: "BATTERY",
        questions: [],
        ride: true
      },
      apiHttpStatus: "200",
      providerModel: "liquid/lfm-2.5-1.2b-instruct-20260120:free"
    });
  });

  it("parses valid JSON content and sends compact structured-output request", async () => {
    let requestInit: RequestInit | undefined;
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init;
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({ short_answer: "Can kiem tra binh." })
            }
          }
        ]
      });
    });
    const { client } = createClient({ fetch: fetch as unknown as typeof globalThis.fetch });

    const result = await client.createDiagnosisJson(prompt);
    const requestBody = JSON.parse(String(requestInit?.body));
    const headers = new Headers(requestInit?.headers);

    expect(result).toEqual({
      success: true,
      json: { short_answer: "Can kiem tra binh." },
      apiHttpStatus: "200"
    });
    expect(fetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.any(Object));
    expect(headers.get("Authorization")).toBe("Bearer secret-test-key");
    expect(headers.get("HTTP-Referer")).toBe("http://localhost:3000");
    expect(headers.get("X-Title")).toBe("CareOnRoad");
    expect(requestBody).toMatchObject({
      model: "openrouter/test-model",
      provider: {
        require_parameters: true
      },
      temperature: 0.2,
      max_tokens: expect.any(Number),
      response_format: {
        type: "json_schema"
      }
    });
    expect(requestBody.response_format.json_schema).toMatchObject({
      name: "careonroad_core_diagnosis",
      strict: true,
      schema: {
        required: ["v", "risk", "ride", "part", "issue", "answer", "actions", "questions"]
      }
    });
    expect(requestBody.max_tokens).toBeLessThanOrEqual(650);
  });

  it("does not expose API key in returned objects or logs", async () => {
    const { client, records } = createClient({
      fetch: async () => new Response("provider error", { status: 500 })
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(JSON.stringify(result)).not.toContain("secret-test-key");
    expect(JSON.stringify(records)).not.toContain("secret-test-key");
    expect(records.map((record) => record.event)).toEqual([
      "chatbot.openrouter.started",
      "chatbot.openrouter.failed"
    ]);
  });
});

function createClient(options: {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  timeoutMs?: number;
} = {}) {
  const records: LogEvent[] = [];
  const logger = {
    info: (payload: LogEvent) => records.push(payload),
    warn: (payload: LogEvent) => records.push(payload),
    error: (payload: LogEvent) => records.push(payload)
  };

  return {
    records,
    client: new OpenRouterClient({
      env: options.env ?? env,
      fetch: options.fetch ?? (async () => Response.json({ choices: [] })),
      logger,
      wait: options.wait,
      timeoutMs: options.timeoutMs,
      now: () => 1000
    })
  };
}
