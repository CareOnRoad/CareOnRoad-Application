import { describe, expect, it } from "vitest";

import { createPayosSignature, verifyPayosSignature } from "../payos-signature";

describe("payOS signature helpers", () => {
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
