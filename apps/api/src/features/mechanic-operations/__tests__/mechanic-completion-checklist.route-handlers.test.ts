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

const validChecklistInput = {
  work_summary: "Completed field checks and confirmed the motorcycle is safe to hand back.",
  safety_checklist: {
    test_ride_completed: true,
    tools_removed: true,
    area_safe: true,
    rider_briefed: true,
    no_fluid_leak: true
  }
} as const;

describe("mechanic completion checklist route handlers", () => {
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
      mediaService: assignmentMetadataService,
      completionChecklistService: assignmentMetadataService
    });

    const missingAuth = await handlers.submitCompletionChecklist(
      post("/completion-checklist", validChecklistInput),
      ASSIGNMENT_ID
    );
    expect(missingAuth.status).toBe(401);

    const missingKey = await handlers.submitCompletionChecklist(
      post("/completion-checklist", validChecklistInput, { token: "mechanic" }),
      ASSIGNMENT_ID
    );
    expect(missingKey.status).toBe(400);

    const invalidUuid = await handlers.submitCompletionChecklist(
      post("/completion-checklist", validChecklistInput, {
        token: "mechanic",
        key: "checklist-route-1"
      }),
      "not-a-uuid"
    );
    expect(invalidUuid.status).toBe(400);

    const invalidPayload = await handlers.submitCompletionChecklist(
      post("/completion-checklist", {}, { token: "mechanic", key: "checklist-route-2" }),
      ASSIGNMENT_ID
    );
    expect(invalidPayload.status).toBe(400);

    const rider = await handlers.submitCompletionChecklist(
      post("/completion-checklist", validChecklistInput, {
        token: "rider",
        key: "checklist-route-3"
      }),
      ASSIGNMENT_ID
    );
    expect(rider.status).toBe(403);

    const ok = await handlers.submitCompletionChecklist(
      post("/completion-checklist", validChecklistInput, {
        token: "mechanic",
        key: "checklist-route-4"
      }),
      ASSIGNMENT_ID
    );
    expect(ok.status).toBe(201);
    await expect(ok.json()).resolves.toMatchObject({
      assignment_id: ASSIGNMENT_ID,
      mechanic_id: MECHANIC_ID,
      revision: 1,
      safety_checklist: validChecklistInput.safety_checklist
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
