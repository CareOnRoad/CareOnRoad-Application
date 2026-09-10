import { describe, expect, it } from "vitest";

import { InMemoryRateLimiter } from "@/lib/rate-limit";

import { createTranscriptionResponse } from "../api-routes";
import { createVoiceRequest, responseJson, setupDiagnosisRoute } from "./api-route-test-helpers";

describe("POST /api/chatbot/sessions/[sessionId]/transcriptions", () => {
  it("uses ASR only and returns transcribed text", async () => {
    const transcribedText = "xe kho de va den yeu";
    const { store, asr, openRouter } = setupDiagnosisRoute({
      asrResult: { success: true, text: transcribedText }
    });
    const session = store.createSession();

    const response = await createTranscriptionResponse(createVoiceRequest(), session.session_id, {
      store,
      asr
    });
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(asr.transcribe).toHaveBeenCalledOnce();
    expect(openRouter.createDiagnosisJson).not.toHaveBeenCalled();
    expect(body.transcribed_text).toBe(transcribedText);
  });

  it("returns 400 for missing audio", async () => {
    const { store, asr, openRouter } = setupDiagnosisRoute({});
    const session = store.createSession();

    const response = await createTranscriptionResponse(
      createVoiceRequest({ includeAudio: false }),
      session.session_id,
      { store, asr }
    );
    const body = await responseJson(response);

    expect(response.status).toBe(400);
    expect(body.error_code).toBe("INVALID_INPUT");
    expect(asr.transcribe).not.toHaveBeenCalled();
    expect(openRouter.createDiagnosisJson).not.toHaveBeenCalled();
  });

  it("uses the transcription rate limit instead of the voice diagnosis limit", async () => {
    const { store, asr } = setupDiagnosisRoute({
      asrResult: { success: true, text: "xe kho de" }
    });
    const session = store.createSession();
    const rateLimiter = new InMemoryRateLimiter({
      sessionLimit: 0,
      voiceSessionLimit: 0,
      transcriptionSessionLimit: 1,
      ipLimit: 99
    });

    const allowed = await createTranscriptionResponse(createVoiceRequest(), session.session_id, {
      store,
      asr,
      rateLimiter,
      logger: testLogger()
    });
    const blocked = await createTranscriptionResponse(createVoiceRequest(), session.session_id, {
      store,
      asr,
      rateLimiter,
      logger: testLogger()
    });
    const body = await responseJson(blocked);

    expect(allowed.status).toBe(200);
    expect(blocked.status).toBe(429);
    expect(body.error_code).toBe("AI_SESSION_LIMIT_EXCEEDED");
    expect(asr.transcribe).toHaveBeenCalledOnce();
  });
});

function testLogger() {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  };
}
