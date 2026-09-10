import { createHmac, timingSafeEqual } from "node:crypto";

export function createPayosSignature(
  data: Record<string, unknown>,
  checksumKey: string
): string {
  return createHmac("sha256", checksumKey).update(toPayosSignaturePayload(data)).digest("hex");
}

export function verifyPayosSignature(input: {
  data: Record<string, unknown>;
  signature: string;
  checksumKey: string;
}): boolean {
  const expected = createPayosSignature(input.data, input.checksumKey);
  const provided = input.signature.trim();
  if (expected.length !== provided.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
}

function toPayosSignaturePayload(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((key) => `${key}=${formatValue(data[key])}`)
    .join("&");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "undefined" || value === "null") {
    return "";
  }
  if (Array.isArray(value)) {
    return JSON.stringify(
      value.map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return Object.fromEntries(
            Object.entries(item as Record<string, unknown>).sort(([left], [right]) =>
              left.localeCompare(right)
            )
          );
        }
        return item;
      })
    );
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
