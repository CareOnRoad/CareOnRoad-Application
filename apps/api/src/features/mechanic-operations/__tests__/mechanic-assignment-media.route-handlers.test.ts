import { describe, expect, it } from "vitest";

import { MechanicAssignmentMetadataService } from "../mechanic-assignment-metadata.service";
import { createMechanicOperationsRouteHandlers } from "../mechanic-operations.route-handlers";
import {
  ASSIGNMENT_ID,
  MECHANIC_ID,
  NOW,
  authenticate,
  createMechanicOperationsUnitOfWork
} from "./mechanic-operations-test-fixtures";

const validMediaInput = {
  media_reference: "assignments/99999999/photo-1.jpg",
  purpose: "work_proof",
  content_type: "image/jpeg",
  size_bytes: 125_000
} as const;

describe("mechanic assignment media route handlers", () => {
  it("enforces auth, idempotency, UUID, payload, ownership, and success responses", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const assignmentMetadataService = new MechanicAssignmentMetadataService(unitOfWork, {
      now: () => NOW
    });
    const handlers = createMechanicOperationsRouteHandlers({
      authenticate,
      dashboardService: { getDashboard: async () => ({}) as never },
      jobListService: { listJobs: async () => ({}) as never },
      performanceService: { getPerformance: async () => ({}) as never },
      etaService: assignmentMetadataService,
      mediaService: assignmentMetadataService
    });

    const missingAuth = await handlers.addMedia(post("/media", validMediaInput), ASSIGNMENT_ID);
    expect(missingAuth.status).toBe(401);

    const missingKey = await handlers.addMedia(
      post("/media", validMediaInput, { token: "mechanic" }),
      ASSIGNMENT_ID
    );
    expect(missingKey.status).toBe(400);

    const invalidUuid = await handlers.addMedia(
      post("/media", validMediaInput, { token: "mechanic", key: "media-route-1" }),
      "not-a-uuid"
    );
    expect(invalidUuid.status).toBe(400);

    const invalidPayload = await handlers.addMedia(
      post("/media", {}, { token: "mechanic", key: "media-route-2" }),
      ASSIGNMENT_ID
    );
    expect(invalidPayload.status).toBe(400);

    const rider = await handlers.addMedia(
      post("/media", validMediaInput, { token: "rider", key: "media-route-3" }),
      ASSIGNMENT_ID
    );
    expect(rider.status).toBe(403);

    const ok = await handlers.addMedia(
      post("/media", validMediaInput, { token: "mechanic", key: "media-route-4" }),
      ASSIGNMENT_ID
    );
    expect(ok.status).toBe(201);
    await expect(ok.json()).resolves.toMatchObject({
      assignment_id: ASSIGNMENT_ID,
      mechanic_id: MECHANIC_ID,
      media_reference: validMediaInput.media_reference,
      purpose: "work_proof"
    });
  });
});

function post(
  path: string,
  body: unknown,
  options: { token?: string; key?: string } = {}
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  if (options.key) headers.set("x-idempotency-key", options.key);
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}
