import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type EncryptedPushToken = {
  ciphertext: string;
  iv: string;
  authTag: string;
  fingerprint: string;
};

export type PushTokenCipher = {
  encrypt(rawToken: string): EncryptedPushToken;
  decrypt(encrypted: EncryptedPushToken): string;
};

export function createPushTokenCipher(
  configuredKey = process.env.PUSH_TOKEN_ENCRYPTION_KEY ?? ""
): PushTokenCipher {
  const key = decodeKey(configuredKey);
  return {
    encrypt(rawToken) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(rawToken, "utf8"),
        cipher.final()
      ]);
      return {
        ciphertext: ciphertext.toString("base64"),
        iv: iv.toString("base64"),
        authTag: cipher.getAuthTag().toString("base64"),
        fingerprint: createHash("sha256").update(rawToken).digest("hex")
      };
    },
    decrypt(encrypted) {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(encrypted.iv, "base64")
      );
      decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
        decipher.final()
      ]).toString("utf8");
    }
  };
}

function decodeKey(configuredKey: string): Buffer {
  const key = Buffer.from(configuredKey, "base64");
  if (!configuredKey || key.length !== 32) {
    throw new Error("Push token encryption configuration is invalid.");
  }
  return key;
}
