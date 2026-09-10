import { describe, expect, it } from "vitest";

import { MechanicAssignmentMetadataService } from "../mechanic-assignment-metadata.service";
import {
  ASSIGNMENT_ID,
  COMPLETED_ASSIGNMENT_ID,
  MECHANIC_ID,
  NOW,
  OTHER_ASSIGNMENT_ID,
  identity,
  createMechanicOperationsUnitOfWork
} from "./mechanic-operations-test-fixtures";

const validMediaInput = {
  media_reference: "assignments/99999999/photo-1.jpg",
  purpose: "diagnosis",
  content_type: "image/jpeg",
  size_bytes: 125_000,
  checksum: "sha256:abc123"
} as const;

describe("MechanicAssignmentMetadataService media metadata", () => {
  it("stores media metadata for the assigned active mechanic with redacted audit and outbox", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const service = new MechanicAssignmentMetadataService(unitOfWork, { now: () => NOW });

    const response = await service.addMedia(
      identity(MECHANIC_ID),
      ASSIGNMENT_ID,
      validMediaInput,
      "media-key-1"
    );

    expect(response).toMatchObject({
      assignment_id: ASSIGNMENT_ID,
      mechanic_id: MECHANIC_ID,
      media_reference: validMediaInput.media_reference,
      purpose: "diagnosis",
      content_type: "image/jpeg",
      size_bytes: 125_000,
      checksum: "sha256:abc123",
      created_at: NOW.toISOString()
    });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.assignmentMediaMetadata).toHaveLength(1);
    expect(snapshot.assignments.find((assignment) => assignment.id === ASSIGNMENT_ID)).toMatchObject({
      status: "accepted"
    });
    expect(snapshot.auditLogs).toEqual([
      expect.objectContaining({
        action: "assignment.media_added",
        actorRole: "mechanic",
        metadata: expect.objectContaining({
          assignment_id: ASSIGNMENT_ID,
          media_metadata_id: response.id,
          media_purpose: "diagnosis",
          media_size_bytes: 125_000
        })
      })
    ]);
    expect(JSON.stringify(snapshot.auditLogs)).not.toMatch(/photo-1|base64|raw_media|provider_payload/);
    expect(snapshot.outboxEvents).toEqual([
      expect.objectContaining({
        topic: "assignment.media_added",
        payload: expect.objectContaining({
          assignment_id: ASSIGNMENT_ID,
          media_metadata_id: response.id,
          media_purpose: "diagnosis",
          content_type: "image/jpeg"
        })
      })
    ]);
    expect(JSON.stringify(snapshot.outboxEvents)).not.toMatch(/photo-1|base64|raw_media|provider_payload/);
  });

  it("supports idempotent replay and rejects same-key body conflicts", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const service = new MechanicAssignmentMetadataService(unitOfWork, { now: () => NOW });

    const first = await service.addMedia(
      identity(MECHANIC_ID),
      ASSIGNMENT_ID,
      validMediaInput,
      "media-key-2"
    );
    await expect(
      service.addMedia(identity(MECHANIC_ID), ASSIGNMENT_ID, validMediaInput, "media-key-2")
    ).resolves.toEqual(first);
    expect(unitOfWork.snapshot().assignmentMediaMetadata).toHaveLength(1);

    await expect(
      service.addMedia(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        { ...validMediaInput, media_reference: "assignments/99999999/photo-2.jpg" },
        "media-key-2"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  });

  it("rejects unowned assignments, terminal assignments, invalid metadata, raw payloads, and bad idempotency", async () => {
    const service = new MechanicAssignmentMetadataService(createMechanicOperationsUnitOfWork(), {
      now: () => NOW
    });

    await expect(
      service.addMedia(identity(MECHANIC_ID), OTHER_ASSIGNMENT_ID, validMediaInput, "media-key-3")
    ).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
    await expect(
      service.addMedia(
        identity(MECHANIC_ID),
        COMPLETED_ASSIGNMENT_ID,
        validMediaInput,
        "media-key-4"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    await expect(
      service.addMedia(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        { ...validMediaInput, size_bytes: 0 },
        "media-key-5"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.addMedia(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        { ...validMediaInput, media_reference: "data:image/jpeg;base64,abc" },
        "media-key-6"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.addMedia(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        { ...validMediaInput, raw_media: "base64-value" },
        "media-key-7"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.addMedia(identity(MECHANIC_ID), ASSIGNMENT_ID, validMediaInput, "")
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
  });
});
