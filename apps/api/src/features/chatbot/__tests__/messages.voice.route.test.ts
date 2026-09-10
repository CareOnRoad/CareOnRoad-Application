import { describe, expect, it } from "vitest";

import { createMessageResponse } from "../api-routes";
import { createVoiceRequest, modelDiagnosis, responseJson, setupDiagnosisRoute } from "./api-route-test-helpers";

describe("POST /api/chatbot/sessions/[sessionId]/messages voice", () => {
  it("uses mocked ASR and returns transcribed_text", async () => {
    const transcribedText = "xe kho de va den yeu";
    const { store, service, asr, openRouter } = setupDiagnosisRoute({
      asrResult: { success: true, text: transcribedText },
      openRouterResult: {
        success: true,
        json: modelDiagnosis({ transcribed_text: transcribedText }),
        apiHttpStatus: "200"
      }
    });
    const session = store.createSession();
    const response = await createMessageResponse(createVoiceRequest(), session.session_id, {
      diagnosis: service
    });
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(asr.transcribe).toHaveBeenCalledOnce();
    expect(openRouter.createDiagnosisJson).toHaveBeenCalledOnce();
    expect(body.transcribed_text).toBe(transcribedText);
  });

  it("returns 400 for missing voice audio", async () => {
    const { store, service, asr, openRouter } = setupDiagnosisRoute({});
    const session = store.createSession();
    const response = await createMessageResponse(
      createVoiceRequest({ includeAudio: false }),
      session.session_id,
      { diagnosis: service }
    );
    const body = await responseJson(response);

    expect(response.status).toBe(400);
    expect(body.error_code).toBe("INVALID_INPUT");
    expect(asr.transcribe).not.toHaveBeenCalled();
    expect(openRouter.createDiagnosisJson).not.toHaveBeenCalled();
  });
});
