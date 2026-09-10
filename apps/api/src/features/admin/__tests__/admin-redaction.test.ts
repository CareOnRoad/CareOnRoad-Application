import { describe, expect, it } from "vitest";

import {
  pickAdminSafeDto,
  redactAdminResponse,
  sanitizeAdminReason,
  sanitizeAdminAuditMetadata,
  sanitizeAdminOutboxPayload
} from "../admin-redaction";

const privatePayload = {
  id: "resource-1",
  status: "active",
  password: "private-password",
  access_token: "private-access",
  refreshToken: "private-refresh",
  authorization: "Bearer private-bearer",
  provider_token: "private-provider-token",
  service_role_key: "private-service-role",
  apiKey: "private-api-key",
  device_key: "private-device-key",
  raw_audio: "private-audio",
  chatbot_text: "private chatbot text",
  diagnosis_text: "private diagnosis text",
  diagnosis: { text: "private nested diagnosis" },
  provider_payload: { private: true },
  payment_provider_payload: { secret: "private-payment" },
  nested: [{ bearer_value: "private-bearer", safe: "visible" }]
};

describe("admin redaction", () => {
  it("recursively removes sensitive response fields without mutating input", () => {
    const original = structuredClone(privatePayload);
    const redacted = redactAdminResponse(privatePayload);
    const serialized = JSON.stringify(redacted);

    expect(redacted).toMatchObject({
      id: "resource-1",
      status: "active",
      nested: [{ safe: "visible" }]
    });
    for (const secret of [
      "private-password",
      "private-access",
      "private-refresh",
      "private-bearer",
      "private-provider-token",
      "private-service-role",
      "private-api-key",
      "private-device-key",
      "private-audio",
      "private chatbot text",
      "private diagnosis text",
      "private nested diagnosis",
      "private-payment"
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(privatePayload).toEqual(original);
  });

  it("supports explicit allowlist-first response DTOs", () => {
    expect(pickAdminSafeDto(privatePayload, ["id", "status", "access_token"])).toEqual({
      id: "resource-1",
      status: "active"
    });
  });

  it("uses strict audit and outbox allowlists after recursive redaction", () => {
    expect(
      sanitizeAdminAuditMetadata({
        resource_id: "resource-1",
        status: "active",
        diagnosis_text: "private",
        arbitrary: "not allowlisted"
      })
    ).toEqual({ resource_id: "resource-1", status: "active" });

    expect(
      sanitizeAdminOutboxPayload({
        resource_id: "resource-1",
        status: "active",
        provider_payload: { secret: "private" },
        arbitrary: "not allowlisted"
      })
    ).toEqual({ resource_id: "resource-1", status: "active" });
  });

  it("redacts inline credentials from the dedicated audit reason", () => {
    const reason = sanitizeAdminReason(
      "Investigate Bearer private-token and api_key=private-key"
    );
    expect(reason).toBe(
      "Investigate Bearer [REDACTED] and api_key=[REDACTED]"
    );
    expect(reason).not.toContain("private-token");
    expect(reason).not.toContain("private-key");
  });
});
