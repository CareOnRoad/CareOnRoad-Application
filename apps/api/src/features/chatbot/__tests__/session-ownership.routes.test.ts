import { describe, expect, it, vi } from "vitest";
import { claimOwnedSessionResponse, createOwnedMessageResponse, createOwnedSessionResponse, getOwnedLatestDiagnosisResponse } from "../api-routes";

describe("owned chatbot routes", () => {
  it("keeps creation JSON and sends an HttpOnly scoped cookie", async () => {
    const response = await createOwnedSessionResponse({ ownership: { createSession: async () => ({ session: { session_id: "session-a" }, token: "raw-owner-token" }) } as never });
    await expect(response.json()).resolves.toEqual({ session_id: "session-a" });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("SameSite=Lax"); expect(cookie).toContain("Path=/api/chatbot/sessions/session-a");
    expect(JSON.stringify(await createOwnedSessionResponse({ ownership: { createSession: async () => ({ session: { session_id: "session-b" }, token: "secret-b" }) } as never }).then((item) => item.json()))).not.toContain("secret-b");
  });

  it("returns identical 404 before message/diagnosis work for missing ownership", async () => {
    const diagnose = vi.fn(); const ownership = { authorize: async () => null } as never;
    const request = new Request("http://test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_mode: "text", text: "xe khong no" }) });
    const message = await createOwnedMessageResponse(request, "guessed", { ownership, diagnosis: { diagnose } });
    const diagnosis = await getOwnedLatestDiagnosisResponse(new Request("http://test"), "guessed", { ownership });
    expect(message.status).toBe(404); expect(diagnosis.status).toBe(404); expect(await message.clone().json()).toEqual(await diagnosis.clone().json()); expect(diagnose).not.toHaveBeenCalled();
  });

  it("maps successful claim without returning credential material", async () => {
    const response = await claimOwnedSessionResponse(new Request("http://test", { method: "POST" }), "session-a", { ownership: { claim: async () => ({ claimed: true, session: { session_id: "session-a", owner_user_id: "user-a" } }) } as never });
    await expect(response.json()).resolves.toEqual({ session_id: "session-a", owner_user_id: "user-a", claimed: true });
  });
});
