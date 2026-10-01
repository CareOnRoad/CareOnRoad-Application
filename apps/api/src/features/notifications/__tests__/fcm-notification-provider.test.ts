import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  FcmNotificationProvider,
  createFcmNotificationProvider
} from "../fcm-notification-provider";

const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();

describe("FcmNotificationProvider", () => {
  it.each(["UNREGISTERED", "SENDER_ID_MISMATCH"])("prioritizes typed %s over a generic HTTP error", async (code) => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: "access-value", expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ error: { status: "NOT_FOUND", details: [
        { "@type": "type.googleapis.com/google.rpc.BadRequest", errorCode: "IGNORE_THIS" },
        { "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: code }
      ] } }, { status: 404 }));
    const provider = new FcmNotificationProvider({ projectId: "test", clientEmail: "service@example.test", privateKey }, { fetch: fetchMock });
    expect(await provider.send({ provider: "fcm", credential: "private", title: "Title", body: "Body", data: {}, deliveryId: "delivery" }))
      .toEqual({ kind: "invalid_credential", errorCode: `FCM_${code}` });
  });

  it("mints OAuth access once and sends a sanitized FCM v1 request", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: "access-value", expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ name: "projects/test/messages/message-1" }))
      .mockResolvedValueOnce(Response.json({ name: "projects/test/messages/message-2" }));
    const provider = new FcmNotificationProvider(
      {
        projectId: "test-project",
        clientEmail: "service@test-project.iam.gserviceaccount.com",
        privateKey
      },
      { fetch: fetchMock, now: () => new Date("2026-08-23T00:00:00Z") }
    );

    const input = {
      provider: "fcm" as const,
      credential: "device-token-secret",
      title: "Cập nhật cứu hộ",
      body: "Mở ứng dụng để xem chi tiết.",
      data: { request_id: "request-1", nested: { safe: true } },
      deliveryId: "delivery-1"
    };
    await expect(provider.send(input)).resolves.toEqual({
      kind: "success",
      providerMessageId: "projects/test/messages/message-1"
    });
    await expect(provider.send({ ...input, deliveryId: "delivery-2" })).resolves.toMatchObject({
      kind: "success"
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const sendInit = fetchMock.mock.calls[1]![1] as RequestInit;
    expect(sendInit.headers).toMatchObject({ Authorization: "Bearer access-value" });
    expect(String(sendInit.body)).toContain("device-token-secret");
  });

  it.each([
    [404, "UNREGISTERED", "invalid_credential"],
    [429, "QUOTA_EXCEEDED", "throttled"],
    [503, "UNAVAILABLE", "temporary_failure"],
    [400, "INVALID_ARGUMENT", "permanent_failure"]
  ] as const)("classifies HTTP %s/%s as %s", async (status, code, kind) => {
    const provider = new FcmNotificationProvider(
      {
        projectId: "test-project",
        clientEmail: "service@test-project.iam.gserviceaccount.com",
        privateKey
      },
      {
        fetch: vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(Response.json({ access_token: "access-value", expires_in: 3600 }))
          .mockResolvedValueOnce(
            Response.json({ error: { status: code, message: "raw sensitive provider text" } }, { status })
          )
      }
    );
    const result = await provider.send({
      provider: "fcm",
      credential: "private-device-token",
      title: "Title",
      body: "Body",
      data: {},
      deliveryId: "delivery-1"
    });
    expect(result.kind).toBe(kind);
    expect(JSON.stringify(result)).not.toMatch(/private-device-token|raw sensitive/i);
  });

  it("fails closed with a sanitized outcome when provider config is absent", async () => {
    const provider = createFcmNotificationProvider({});
    await expect(
      provider.send({
        provider: "fcm",
        credential: "never-exposed",
        title: "Title",
        body: "Body",
        data: {},
        deliveryId: "delivery-1"
      })
    ).resolves.toEqual({
      kind: "temporary_failure",
      errorCode: "PUSH_PROVIDER_NOT_CONFIGURED"
    });
  });
});
