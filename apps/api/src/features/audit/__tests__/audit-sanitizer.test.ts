import { describe, expect, it } from "vitest";

import { sanitizeAuditMetadata } from "../audit-sanitizer";

describe("audit metadata sanitizer", () => {
  it("retains allowlisted operational metadata", () => {
    expect(
      sanitizeAuditMetadata({
        status: "created",
        previous_status: "pending",
        next_status: "created",
        resource_id: "resource-1",
        request_code: "COR-EMR-20260625-1",
        attempt_count: 2
      })
    ).toEqual({
      status: "created",
      previous_status: "pending",
      next_status: "created",
      resource_id: "resource-1",
      request_code: "COR-EMR-20260625-1",
      attempt_count: 2
    });
  });

  it("removes secrets, tokens, raw audio, full text, contact, and payment data", () => {
    const sanitized = sanitizeAuditMetadata({
      authorization: "Bearer secret-token",
      api_key: "sk-secret",
      service_role_key: "service-secret",
      access_token: "token-secret",
      raw_audio: new Uint8Array([1, 2, 3]),
      audio_file: "voice.wav",
      symptom_text: "full rider symptom",
      transcribed_text: "full transcript",
      phone: "0909123456",
      email: "rider@example.com",
      payment_card: "4111111111111111",
      bank_account: "123456789",
      amount: 500000,
      status: "rejected"
    });
    const serialized = JSON.stringify(sanitized);

    for (const prohibited of [
      "secret-token",
      "sk-secret",
      "service-secret",
      "token-secret",
      "voice.wav",
      "full rider symptom",
      "full transcript",
      "0909123456",
      "rider@example.com",
      "4111111111111111",
      "123456789",
      "500000"
    ]) {
      expect(serialized).not.toContain(prohibited);
    }
    expect(sanitized).toEqual({ status: "rejected" });
  });

  it("keeps audit-export access evidence (filter hash and exported row count)", () => {
    const filterHash = "a".repeat(64);
    expect(sanitizeAuditMetadata({ filter_hash: filterHash, exported_count: 2 })).toEqual({
      filter_hash: filterHash,
      exported_count: 2
    });
  });

  it("keeps changed_fields only as a list of names", () => {
    expect(sanitizeAuditMetadata({ changed_fields: ["frame_number", "color"] })).toEqual({
      changed_fields: ["frame_number", "color"]
    });
    expect(sanitizeAuditMetadata({ changed_fields: "frame_number" })).toEqual({});
    expect(sanitizeAuditMetadata({ changed_fields: [{ frame_number: "RLH1" }] })).toEqual({});
    expect(sanitizeAuditMetadata({ changed_fields: ["color", 32000000] })).toEqual({});
  });

  it("drops changed_fields when any entry is not a column-style name", () => {
    // Drop the whole key (not just the bad entry) so a value can never ride along.
    expect(sanitizeAuditMetadata({ changed_fields: ["color", "RLHJF1234"] })).toEqual({});
    expect(sanitizeAuditMetadata({ changed_fields: ["color", "has space"] })).toEqual({});
    expect(sanitizeAuditMetadata({ changed_fields: ["1color"] })).toEqual({});
    expect(sanitizeAuditMetadata({ changed_fields: ["a".repeat(65)] })).toEqual({});
    // Real emitters: mechanic availability/location audits and the motorcycle details audit.
    const names = ["is_available", "availability_updated_at", "latest_location", "purchase_price_vnd", "a".repeat(64)];
    expect(sanitizeAuditMetadata({ changed_fields: names })).toEqual({ changed_fields: names });
  });

  it("sanitizes nested objects and arrays using the same allowlist", () => {
    expect(
      sanitizeAuditMetadata({
        status: "processed",
        context: {
          error_code: "PROVIDER_REJECTED",
          token: "secret"
        },
        changes: [
          { field: "status", previous_status: "pending", next_status: "processed" },
          { field: "email", email: "private@example.com" }
        ]
      })
    ).toEqual({
      status: "processed",
      context: {
        error_code: "PROVIDER_REJECTED"
      },
      changes: [
        { field: "status", previous_status: "pending", next_status: "processed" },
        { field: "email" }
      ]
    });
  });
});
