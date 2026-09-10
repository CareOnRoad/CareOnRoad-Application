import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { FakeMediaStorageProvider } from "../fake-media-storage.provider";
import { MediaUploadService } from "../media-upload.service";

const RIDER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const MOTORCYCLE_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-08-23T03:00:00.000Z");
const BYTES = new TextEncoder().encode("verified-image-bytes");
const SHA256 = createHash("sha256").update(BYTES).digest("hex");

describe("MediaUploadService", () => {
  it("creates a server-bound rider intent and finalizes exact bytes once", async () => {
    const unitOfWork = createUnitOfWork();
    const storage = new FakeMediaStorageProvider();
    const service = new MediaUploadService(unitOfWork, storage, "private-media", { now: () => NOW });

    const intent = await service.createIntent(identity(RIDER_ID), validInput(), "create-media-1");
    expect(intent).toMatchObject({
      resource_type: "service_request",
      resource_id: REQUEST_ID,
      upload_method: "PUT",
      required_headers: { "content-type": "image/jpeg" }
    });
    expect(intent.object_key).toMatch(
      new RegExp(`^service-requests/${REQUEST_ID}/${RIDER_ID}/[0-9a-f-]+\\.jpg$`)
    );
    expect(JSON.stringify(intent)).not.toContain(SHA256);

    storage.put("private-media", intent.object_key, BYTES, "image/jpeg");
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        service.finalizeIntent(identity(RIDER_ID), intent.intent_id, `finalize-${index}`)
      )
    );
    expect(new Set(results.map((result) => result.media.id)).size).toBe(1);
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.requestMediaMetadata).toHaveLength(1);
    expect(snapshot.mediaUploadIntents).toEqual([
      expect.objectContaining({ status: "finalized", mediaMetadataId: results[0]!.media.id })
    ]);
    expect(snapshot.auditLogs).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(JSON.stringify([...snapshot.auditLogs, ...snapshot.outboxEvents])).not.toMatch(
      new RegExp(`${SHA256}|token=fake|storage://`)
    );
  });

  it("rejects client path overrides, cross-owner access, invalid types, and mismatched objects", async () => {
    const unitOfWork = createUnitOfWork();
    const storage = new FakeMediaStorageProvider();
    const service = new MediaUploadService(unitOfWork, storage, "private-media", { now: () => NOW });

    await expect(
      service.createIntent(identity(RIDER_ID), { ...validInput(), object_key: "../../other" }, "bad-path-1")
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.createIntent(identity(RIDER_ID), { ...validInput(), content_type: "image/svg+xml" }, "bad-type-1")
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.createIntent(identity(OTHER_ID), validInput(), "other-owner-1")
    ).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });

    const intent = await service.createIntent(identity(RIDER_ID), validInput(), "mismatch-create");
    storage.put("private-media", intent.object_key, new TextEncoder().encode("wrong"), "image/jpeg");
    await expect(
      service.finalizeIntent(identity(RIDER_ID), intent.intent_id, "mismatch-finalize")
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    expect(storage.removed).toEqual([`private-media/${intent.object_key}`]);
    expect(unitOfWork.snapshot().requestMediaMetadata).toHaveLength(0);
  });

  it("re-signs the same intent on create replay without storing signed URLs", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new MediaUploadService(
      unitOfWork,
      new FakeMediaStorageProvider(),
      "private-media",
      { now: () => NOW }
    );
    const first = await service.createIntent(identity(RIDER_ID), validInput(), "replay-create-1");
    const replay = await service.createIntent(identity(RIDER_ID), validInput(), "replay-create-1");
    expect(replay.intent_id).toBe(first.intent_id);
    expect(unitOfWork.snapshot().mediaUploadIntents).toHaveLength(1);
    expect(JSON.stringify(unitOfWork.snapshot().idempotencyRecords)).not.toContain("token=fake");
  });
});

function validInput() {
  return {
    resource_type: "service_request",
    resource_id: REQUEST_ID,
    purpose: "problem_photo",
    content_type: "image/jpeg",
    size_bytes: BYTES.byteLength,
    sha256: SHA256
  } as const;
}

function identity(subject: string) {
  return { subject, issuer: "https://test.supabase.co/auth/v1", audience: ["authenticated"] };
}

function createUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [
      { id: RIDER_ID, status: "active", createdAt: NOW, updatedAt: NOW },
      { id: OTHER_ID, status: "active", createdAt: NOW, updatedAt: NOW }
    ],
    userRoles: [
      { userId: RIDER_ID, role: "rider" },
      { userId: OTHER_ID, role: "rider" }
    ],
    serviceRequests: [
      {
        id: REQUEST_ID,
        requestCode: "COR-MR-20260823-0001",
        riderId: RIDER_ID,
        motorcycleId: MOTORCYCLE_ID,
        serviceType: "mobile_repair",
        problemDescription: "Xe khong no may",
        status: "submitted",
        priority: "normal",
        createdAt: NOW,
        updatedAt: NOW
      }
    ]
  });
}
