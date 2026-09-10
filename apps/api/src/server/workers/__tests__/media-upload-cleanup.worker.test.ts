import { describe, expect, it } from "vitest";

import { FakeMediaStorageProvider } from "@/features/media-uploads/fake-media-storage.provider";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { MediaUploadCleanupWorker } from "../media-upload-cleanup.worker";

const NOW = new Date("2026-08-23T03:00:00.000Z");

describe("MediaUploadCleanupWorker", () => {
  it("removes only expired exact objects and is replay safe", async () => {
    const expired = intent("11111111-1111-4111-8111-111111111111", new Date(NOW.getTime() - 1));
    const live = intent("22222222-2222-4222-8222-222222222222", new Date(NOW.getTime() + 60_000));
    const unitOfWork = new InMemoryUnitOfWork({ mediaUploadIntents: [expired, live] });
    const storage = new FakeMediaStorageProvider();
    storage.put(expired.storageBucket, expired.objectKey, new Uint8Array([1]), expired.contentType);
    storage.put(live.storageBucket, live.objectKey, new Uint8Array([2]), live.contentType);
    const worker = new MediaUploadCleanupWorker(unitOfWork, storage, {
      workerId: "cleanup-1",
      now: () => NOW
    });

    await expect(worker.processBatch()).resolves.toEqual({ claimed: 1, expired: 1, failed: 0 });
    await expect(worker.processBatch()).resolves.toEqual({ claimed: 0, expired: 0, failed: 0 });
    expect(storage.removed).toEqual([`bucket/${expired.objectKey}`]);
    expect(storage.objects.has(`bucket/${live.objectKey}`)).toBe(true);
  });
});

function intent(id: string, expiresAt: Date) {
  return {
    id,
    actorId: "33333333-3333-4333-8333-333333333333",
    actorRole: "rider" as const,
    resourceType: "service_request" as const,
    requestId: "44444444-4444-4444-8444-444444444444",
    purpose: "problem_photo",
    storageBucket: "bucket",
    objectKey: `service-requests/request/actor/${id}.jpg`,
    contentType: "image/jpeg" as const,
    sizeBytes: 1,
    sha256: "a".repeat(64),
    status: "pending" as const,
    expiresAt,
    createdAt: new Date(NOW.getTime() - 120_000),
    updatedAt: new Date(NOW.getTime() - 120_000)
  };
}
