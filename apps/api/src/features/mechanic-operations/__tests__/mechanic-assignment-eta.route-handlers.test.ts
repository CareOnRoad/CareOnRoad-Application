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

describe("mechanic assignment ETA route handlers", () => {
  it("enforces auth, idempotency, UUID, payload, ownership, and success responses", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const handlers = createMechanicOperationsRouteHandlers({
      authenticate,
      dashboardService: { getDashboard: async () => ({}) as never },
      jobListService: { listJobs: async () => ({}) as never },
      performanceService: { getPerformance: async () => ({}) as never },
      etaService: new MechanicAssignmentMetadataService(unitOfWork, { now: () => NOW })
    });
    const etaAt = new Date(NOW.getTime() + 5 * 60_000).toISOString();

    const missingAuth = await handlers.updateEta(post("/eta", { eta_at: etaAt }), ASSIGNMENT_ID);
    expect(missingAuth.status).toBe(401);

    const missingKey = await handlers.updateEta(
      post("/eta", { eta_at: etaAt }, { token: "mechanic" }),
      ASSIGNMENT_ID
    );
    expect(missingKey.status).toBe(400);

    const invalidUuid = await handlers.updateEta(
      post("/eta", { eta_at: etaAt }, { token: "mechanic", key: "eta-route-1" }),
      "not-a-uuid"
    );
    expect(invalidUuid.status).toBe(400);

    const invalidPayload = await handlers.updateEta(
      post("/eta", {}, { token: "mechanic", key: "eta-route-2" }),
      ASSIGNMENT_ID
    );
    expect(invalidPayload.status).toBe(400);

    const rider = await handlers.updateEta(
      post("/eta", { eta_at: etaAt }, { token: "rider", key: "eta-route-3" }),
      ASSIGNMENT_ID
    );
    expect(rider.status).toBe(403);

    const ok = await handlers.updateEta(
      post("/eta", { eta_at: etaAt }, { token: "mechanic", key: "eta-route-4" }),
      ASSIGNMENT_ID
    );
    expect(ok.status).toBe(201);
    await expect(ok.json()).resolves.toMatchObject({
      assignment_id: ASSIGNMENT_ID,
      mechanic_id: MECHANIC_ID,
      eta_at: etaAt
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
