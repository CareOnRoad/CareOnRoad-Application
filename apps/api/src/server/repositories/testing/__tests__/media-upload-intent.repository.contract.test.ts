import { describe, expect, it } from "vitest";

import type { MediaUploadIntent } from "../../contracts/media-upload-intent.repository";
import { InMemoryMediaUploadIntentRepository } from "../in-memory-media-upload-intent.repository";

const NOW = new Date("2026-08-23T03:00:00.000Z");

describe("media upload intent repository contract", () => {
  it("counts only live pending reservations and preserves terminal finalize", async () => {
    const rows: MediaUploadIntent[] = [
      intent("11111111-1111-4111-8111-111111111111", "pending", new Date(NOW.getTime() + 1)),
      intent("22222222-2222-4222-8222-222222222222", "pending", new Date(NOW.getTime() - 1)),
      intent("33333333-3333-4333-8333-333333333333", "finalized", new Date(NOW.getTime() - 1))
    ];
    const repository = new InMemoryMediaUploadIntentRepository(rows);
    await expect(
      repository.countForResource({
        resourceType: "service_request",
        requestId: rows[0]!.requestId,
        now: NOW
      })
    ).resolves.toBe(1);
    const finalized = await repository.markFinalized({
      id: rows[0]!.id,
      mediaMetadataId: "44444444-4444-4444-8444-444444444444",
      finalizedResponse: { status: "finalized" },
      finalizedAt: NOW
    });
    expect(finalized).toMatchObject({ status: "finalized" });
    await expect(
      repository.markFinalized({
        id: rows[0]!.id,
        mediaMetadataId: "55555555-5555-4555-8555-555555555555",
        finalizedResponse: {},
        finalizedAt: NOW
      })
    ).resolves.toBeUndefined();
  });

  it("leases expired rows once and requires lease ownership to expire", async () => {
    const rows = [intent("11111111-1111-4111-8111-111111111111", "pending", new Date(NOW.getTime() - 1))];
    const repository = new InMemoryMediaUploadIntentRepository(rows);
    await expect(
      repository.claimExpired({
        workerId: "worker-1",
        now: NOW,
        leaseExpiresAt: new Date(NOW.getTime() + 60_000),
        limit: 10
      })
    ).resolves.toHaveLength(1);
    await expect(
      repository.claimExpired({
        workerId: "worker-2",
        now: NOW,
        leaseExpiresAt: new Date(NOW.getTime() + 60_000),
        limit: 10
      })
    ).resolves.toHaveLength(0);
    await expect(repository.markExpired({ id: rows[0]!.id, workerId: "worker-2", updatedAt: NOW })).resolves.toBe(false);
    await expect(repository.markExpired({ id: rows[0]!.id, workerId: "worker-1", updatedAt: NOW })).resolves.toBe(true);
  });
});

function intent(id: string, status: MediaUploadIntent["status"], expiresAt: Date): MediaUploadIntent {
  const finalized = status === "finalized";
  return {
    id,
    actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    actorRole: "rider",
    resourceType: "service_request",
    requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    purpose: "problem_photo",
    storageBucket: "bucket",
    objectKey: `${id}.jpg`,
    contentType: "image/jpeg",
    sizeBytes: 1,
    sha256: "a".repeat(64),
    status,
    ...(finalized
      ? {
          mediaMetadataId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          finalizedResponse: { status: "finalized" },
          finalizedAt: NOW
        }
      : {}),
    expiresAt,
    createdAt: new Date(NOW.getTime() - 60_000),
    updatedAt: new Date(NOW.getTime() - 60_000)
  };
}
