import { describe, expect, it } from "vitest";

import { InMemorySessionStore } from "../session.store";
import { getLatestDiagnosisResponse } from "../api-routes";
import { modelDiagnosis, responseJson } from "./api-route-test-helpers";

describe("GET /api/chatbot/sessions/[sessionId]/diagnosis", () => {
  it("returns the latest saved diagnosis", async () => {
    const store = new InMemorySessionStore();
    const session = store.createSession();
    const diagnosis = modelDiagnosis();
    store.setLatestDiagnosis(session.session_id, diagnosis);

    const response = getLatestDiagnosisResponse(session.session_id, { store });
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      session_id: session.session_id,
      diagnosis
    });
  });

  it("returns 404 for unknown session", async () => {
    const store = new InMemorySessionStore();
    const response = getLatestDiagnosisResponse("missing-session", { store });
    const body = await responseJson(response);

    expect(response.status).toBe(404);
    expect(body.error_code).toBe("NOT_FOUND");
  });

  it("returns 404 before any diagnosis exists", async () => {
    const store = new InMemorySessionStore();
    const session = store.createSession();
    const response = getLatestDiagnosisResponse(session.session_id, { store });
    const body = await responseJson(response);

    expect(response.status).toBe(404);
    expect(body.error_code).toBe("NOT_FOUND");
  });
});
