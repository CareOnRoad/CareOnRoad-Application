import { describe, expect, it } from "vitest";

import type { DiagnosisResult } from "../diagnosis.schema";
import { createMessageResponse } from "../api-routes";
import { createJsonRequest, modelDiagnosis, responseJson, setupDiagnosisRoute } from "./api-route-test-helpers";

describe("POST /api/chatbot/sessions/[sessionId]/messages text", () => {
  it("returns valid compact diagnosis for text input", async () => {
    const { store, service, openRouter } = setupDiagnosisRoute({});
    const session = store.createSession();
    const response = await createMessageResponse(
      createJsonRequest({ input_mode: "text", content_text: "xe kho de va den yeu" }),
      session.session_id,
      { diagnosis: service }
    );
    const body = await responseJson<DiagnosisResult>(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      fallback_used: false,
      risk_level: "medium",
      can_continue_riding: true
    });
    expect(openRouter.createDiagnosisJson).toHaveBeenCalledOnce();
    expect(JSON.stringify(body)).not.toContain("secret-openrouter-key");
  });

  it("returns high-risk output for dangerous text input", async () => {
    const { store, service } = setupDiagnosisRoute({
      openRouterResult: {
        success: true,
        json: modelDiagnosis({
          risk_level: "low",
          can_continue_riding: true,
          recommended_next_actions: [{ type: "safe_to_monitor", label: "Theo doi" }]
        }),
        apiHttpStatus: "200"
      }
    });
    const session = store.createSession();
    const response = await createMessageResponse(
      createJsonRequest({ input_mode: "text", content_text: "mat phanh khi dang chay" }),
      session.session_id,
      { diagnosis: service }
    );
    const body = await responseJson<DiagnosisResult>(response);

    expect(response.status).toBe(200);
    expect(["high", "critical"]).toContain(body.risk_level);
    expect(body.can_continue_riding).toBe(false);
    expect(body.recommended_next_actions[0].type).toBe("emergency_rescue");
  });

  it("returns 400 for invalid text request", async () => {
    const { service, store } = setupDiagnosisRoute({});
    const session = store.createSession();
    const response = await createMessageResponse(
      createJsonRequest({ input_mode: "text", content_text: "" }),
      session.session_id,
      { diagnosis: service }
    );
    const body = await responseJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error_code: "INVALID_INPUT"
    });
  });

  it("does not log the full symptom text", async () => {
    const { store, service, records } = setupDiagnosisRoute({});
    const session = store.createSession();
    const fullText = "xe kho de va den yeu full symptom text";

    const response = await createMessageResponse(
      createJsonRequest({ input_mode: "text", content_text: fullText }),
      session.session_id,
      { diagnosis: service }
    );

    expect(response.status).toBe(200);
    const serializedLogs = JSON.stringify(records);
    expect(serializedLogs).not.toContain(fullText);
    expect(serializedLogs).toContain("text_hash");
  });
});
