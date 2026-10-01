import { createHmac } from "node:crypto";
import { expect, it } from "vitest";
import { PayosClient } from "../payos.client";

it("signs the five payOS creation fields while sending expiry separately", async () => {
  let body: Record<string, unknown> = {};
  const client = new PayosClient({ PAYMENTS_ENABLED: "true", PAYOS_CLIENT_ID: "test", PAYOS_API_KEY: "test", PAYOS_CHECKSUM_KEY: "test-checksum" }, async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ code: "00", data: { paymentLinkId: "test-link", checkoutUrl: "https://example.test/pay", qrCode: "test-qr", status: "PENDING" } });
  });
  await client.createPaymentLink({ orderCode: 100001, amount: 160000, description: "COR100001", cancelUrl: "https://example.test/cancel", returnUrl: "https://example.test/return", expiredAt: 1800000000 });
  expect(body.expiredAt).toBe(1800000000);
  expect(body.signature).toBe(createHmac("sha256", "test-checksum")
    .update("amount=160000&cancelUrl=https://example.test/cancel&description=COR100001&orderCode=100001&returnUrl=https://example.test/return").digest("hex"));
});

it("recovers a timed-out or duplicate creation using the same provider order code", async () => {
  const requests: string[] = [];
  const client = new PayosClient({ PAYMENTS_ENABLED: "true", PAYOS_CLIENT_ID: "test", PAYOS_API_KEY: "test", PAYOS_CHECKSUM_KEY: "test" }, async (url, init) => {
    requests.push(`${init?.method} ${String(url)}`);
    if (init?.method === "POST") throw new Error("timeout after provider committed");
    return Response.json({ code: "00", data: { id: "existing-link", orderCode: 100001, amount: 160000, amountPaid: 0, status: "PENDING" } });
  });
  expect(await client.createPaymentLink({ orderCode: 100001, amount: 160000, description: "COR100001", cancelUrl: "https://example.test/cancel", returnUrl: "https://example.test/return" }))
    .toMatchObject({ paymentLinkId: "existing-link", checkoutUrl: "https://pay.payos.vn/web/existing-link", status: "PENDING" });
  expect(requests).toEqual(["POST https://api-merchant.payos.vn/v2/payment-requests", "GET https://api-merchant.payos.vn/v2/payment-requests/100001"]);
});
