import { describe, expect, it } from "vitest";
import { InMemorySessionStore } from "../session.store";
import { SessionOwnershipService, hashCredential } from "../session-ownership.service";

describe("SessionOwnershipService", () => {
  it("rejects guessed/cross-session access and legacy sessions", async () => {
    const store = new InMemorySessionStore(); let token = "owner-token-a";
    const service = new SessionOwnershipService(store, { createToken: () => token });
    const first = await service.createSession(); token = "owner-token-b"; const second = await service.createSession();
    const request = (value?: string) => new Request("http://test", { headers: value ? { "x-chatbot-session-token": value } : {} });
    await expect(service.authorize(request("owner-token-a"), first.session.session_id)).resolves.not.toBeNull();
    await expect(service.authorize(request("owner-token-b"), first.session.session_id)).resolves.toBeNull();
    await expect(service.authorize(request(), second.session.session_id)).resolves.toBeNull();
    const legacy = store.createSession(); await expect(service.authorize(request("anything"), legacy.session_id)).resolves.toBeNull();
    expect(first.session.owner_credential_hash).toBe(hashCredential("owner-token-a"));
    expect(JSON.stringify(first.session)).not.toContain("owner-token-a");
  });

  it("claims once for the credential holder and rejects a different owner", async () => {
    const store = new InMemorySessionStore(); let subject = "user-a";
    const service = new SessionOwnershipService(store, { createToken: () => "owner-token", authenticate: async () => ({ subject, issuer: "test", audience: [] }) });
    const { session } = await service.createSession();
    const request = new Request("http://test", { headers: { authorization: "Bearer jwt", "x-chatbot-session-token": "owner-token" } });
    await expect(service.claim(request, session.session_id)).resolves.toMatchObject({ claimed: true, session: { owner_user_id: "user-a" } });
    await expect(service.claim(request, session.session_id)).resolves.toMatchObject({ claimed: false });
    await expect(service.authorize(new Request("http://test", { headers: { "x-chatbot-session-token": "owner-token" } }), session.session_id)).resolves.toBeNull();
    subject = "user-b"; await expect(service.claim(request, session.session_id)).resolves.toBeNull();
  });
});
