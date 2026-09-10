import { describe, expect, it, vi } from "vitest";

import type { LogEvent } from "@/lib/server-logger";

import { GeminiClient } from "../gemini.client";

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
  GEMINI_API_KEY: "secret-gemini-key",
  GEMINI_MODEL: "gemini-2.5-flash-lite"
};

describe("GeminiClient", () => {
  it("returns controlled failure when API key is missing", async () => {
    const fetch = vi.fn();
    const { client } = createClient({
      env: { NODE_ENV: "test", GEMINI_MODEL: "gemini-2.5-flash-lite" },
      fetch: fetch as unknown as typeof globalThis.fetch
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toMatchObject({
      success: false,
      errorCode: "GEMINI_MISSING_API_KEY"
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends structured-output request and parses valid candidate JSON", async () => {
    let requestInit: RequestInit | undefined;
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init;
      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ short_answer: "Can kiem tra binh." }) }]
            }
          }
        ]
      });
    });
    const { client } = createClient({ fetch: fetch as unknown as typeof globalThis.fetch });

    const result = await client.createDiagnosisJson(prompt);
    const requestBody = JSON.parse(String(requestInit?.body));
    const headers = new Headers(requestInit?.headers);

    expect(fetch).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
      expect.any(Object)
    );
    expect(headers.get("x-goog-api-key")).toBe("secret-gemini-key");
    expect(result).toEqual({
      success: true,
      json: { short_answer: "Can kiem tra binh." },
      apiHttpStatus: "200",
      provider: "gemini",
      providerModel: "gemini-2.5-flash-lite"
    });
    expect(requestBody).toMatchObject({
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: expect.any(Number),
        responseFormat: {
          text: {
            mimeType: "application/json"
          }
        }
      }
    });
    expect(requestBody.generationConfig.maxOutputTokens).toBeLessThanOrEqual(650);
  });

  it("returns controlled failure for quota and invalid candidate content", async () => {
    const quotaClient = createClient({
      fetch: async () =>
        Response.json(
          {
            error: {
              code: 429,
              status: "RESOURCE_EXHAUSTED"
            }
          },
          { status: 429 }
        )
    }).client;

    await expect(quotaClient.createDiagnosisJson(prompt)).resolves.toMatchObject({
      success: false,
      errorCode: "GEMINI_QUOTA_EXCEEDED",
      apiHttpStatus: "429",
      providerName: "RESOURCE_EXHAUSTED"
    });

    const invalidClient = createClient({
      fetch: async () =>
        Response.json({
          candidates: [{ content: { parts: [{ text: "not-json" }] } }]
        })
    }).client;

    await expect(invalidClient.createDiagnosisJson(prompt)).resolves.toMatchObject({
      success: false,
      errorCode: "GEMINI_INVALID_JSON_CONTENT",
      invalidResponseReason: "no_json_object_found",
      responsePreview: "not-json"
    });
  });

  it("does not expose API key in returned objects or logs", async () => {
    const { client, records } = createClient({
      fetch: async () => new Response("provider error", { status: 500 })
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(JSON.stringify(result)).not.toContain("secret-gemini-key");
    expect(JSON.stringify(records)).not.toContain("secret-gemini-key");
    expect(records.map((record) => record.event)).toEqual([
      "chatbot.gemini.started",
      "chatbot.gemini.failed"
    ]);
  });
});

function createClient(options: {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
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
    client: new GeminiClient({
      env: options.env ?? env,
      fetch: options.fetch ?? (async () => Response.json({ candidates: [] })),
      logger,
      timeoutMs: options.timeoutMs,
      now: () => 1000
    })
  };
}
