import { describe, expect, it } from "vitest";

import { InMemorySessionStore } from "../session.store";
import { createSessionResponse } from "../api-routes";
import { responseJson } from "./api-route-test-helpers";

describe("POST /api/chatbot/sessions", () => {
  it("returns a session_id and creates a demo session", async () => {
    const store = new InMemorySessionStore();
    const response = createSessionResponse({ store });
    const body = await responseJson<{ session_id: string }>(response);

    expect(response.status).toBe(200);
    expect(body.session_id).toEqual(expect.any(String));
    expect(store.getSession(body.session_id)).not.toBeNull();
  });
});
