import { describe, expect, it } from "vitest";

import { InMemoryRateLimiter } from "@/lib/rate-limit";

import { createMessageResponse } from "../api-routes";
import { createVoiceRequest, responseJson, setupDiagnosisRoute } from "./api-route-test-helpers";

describe("POST /api/chatbot/sessions/[sessionId]/messages voice rate limiting", () => {
  it("returns 429 using stricter voice session limit before ASR execution", async () => {
    const { store, service, asr, openRouter } = setupDiagnosisRoute({});
    const records: unknown[] = [];
    const session = store.createSession();
    const rateLimiter = new InMemoryRateLimiter({ sessionLimit: 99, ipLimit: 99, voiceSessionLimit: 0 });

    const response = await createMessageResponse(createVoiceRequest(), session.session_id, {
      diagnosis: service,
      rateLimiter,
      logger: {
        info: () => undefined,
        warn: (payload) => records.push(payload),
        error: () => undefined
      }
    });
    const body = await responseJson(response);

    expect(response.status).toBe(429);
    expect(body.error_code).toBe("AI_SESSION_LIMIT_EXCEEDED");
    expect(asr.transcribe).not.toHaveBeenCalled();
    expect(openRouter.createDiagnosisJson).not.toHaveBeenCalled();
    expect(JSON.stringify(records)).not.toContain("1,2,3,4");
    expect(JSON.stringify(records)).not.toContain("audio_file");
    expect(JSON.stringify(records)).not.toContain("secret-openrouter-key");
  });
});
