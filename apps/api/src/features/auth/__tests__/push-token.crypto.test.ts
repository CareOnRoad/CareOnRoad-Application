import { describe, expect, it } from "vitest";

import { createPushTokenCipher } from "../push-token.crypto";

const key = Buffer.alloc(32, 7).toString("base64");

describe("push token crypto", () => {
  it("encrypts with randomized authenticated encryption and stable fingerprinting", () => {
    const cipher = createPushTokenCipher(key);
    const raw = "provider-token-private-123456789";

    const first = cipher.encrypt(raw);
    const second = cipher.encrypt(raw);

    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.ciphertext).not.toBe(first.ciphertext);
    expect(cipher.decrypt(first)).toBe(raw);
    expect(JSON.stringify(first)).not.toContain(raw);
  });

  it("fails safely for missing or malformed key configuration", () => {
    expect(() => createPushTokenCipher("")).toThrow("configuration");
    expect(() => createPushTokenCipher("not-base64")).toThrow("configuration");
  });

  it("rejects tampered authenticated ciphertext", () => {
    const cipher = createPushTokenCipher(key);
    const encrypted = cipher.encrypt("provider-token-private-123456789");
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.from("tampered").toString("base64")
    };

    expect(() => cipher.decrypt(tampered)).toThrow();
  });
});
