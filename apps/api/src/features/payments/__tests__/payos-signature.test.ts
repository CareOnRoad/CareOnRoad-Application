import { describe, expect, it } from "vitest";

import { createPayosSignature, verifyPayosSignature } from "../payos-signature";
import { PayosClient } from "../payos.client";

describe("payOS signature helpers", () => {
  it("reports provider outages, quota and network failure as retryable service errors", async () => {
    for (const failure of [503, 429, "network"] as const) {
      const client = new PayosClient({ PAYMENTS_ENABLED: "true", PAYOS_CLIENT_ID: "test", PAYOS_API_KEY: "test", PAYOS_CHECKSUM_KEY: "test" }, async () => {
        if (failure === "network") throw new TypeError("Network failure");
        return new Response(JSON.stringify({ code: "99" }), { status: failure });
      });
      await expect(client.createPaymentLink({ orderCode: 123, amount: 3000, description: "COR000123", returnUrl: "https://example.test/return", cancelUrl: "https://example.test/cancel" }))
        .rejects.toMatchObject({ status: 503, errorCode: "INTERNAL_ERROR" });
    }
  });
  it("authenticates a signed currency mismatch for review while rejecting tampering and malformed currency", () => {
    const checksumKey = "test-checksum-key";
    const client = new PayosClient({ PAYMENTS_ENABLED: "true", PAYOS_CLIENT_ID: "test", PAYOS_API_KEY: "test", PAYOS_CHECKSUM_KEY: checksumKey });
    const data = { orderCode: 123, amount: 3000, currency: "USD", code: "00" };
    const signature = createPayosSignature(data, checksumKey);
    expect(client.verifyWebhookPayload({ success: true, data, signature })).toMatchObject({ kind: "valid", currency: "USD" });
    expect(client.verifyWebhookPayload({ success: true, data: { ...data, amount: 3001 }, signature })).toMatchObject({ kind: "invalid", reason: "invalid_signature" });
    const malformed = { ...data, currency: "" };
    expect(client.verifyWebhookPayload({ data: malformed, signature: createPayosSignature(malformed, checksumKey) })).toMatchObject({ kind: "invalid", reason: "invalid_payload" });
  });
  it("sorts keys and verifies HMAC SHA-256 signatures", () => {
    const checksumKey = "test-checksum-key";
    const data = {
      orderCode: 123,
      amount: 3000,
      description: "COR000123",
      currency: "VND"
    };

    const signature = createPayosSignature(data, checksumKey);

    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(
      verifyPayosSignature({
        data: {
          currency: "VND",
          description: "COR000123",
          amount: 3000,
          orderCode: 123
        },
        signature,
        checksumKey
      })
    ).toBe(true);
    expect(
      verifyPayosSignature({
        data: { ...data, amount: 3001 },
        signature,
        checksumKey
      })
    ).toBe(false);
  });
});
