import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";

import { createRouteEtaRouteHandlers } from "../route-eta.route-handlers";

describe("route ETA endpoint", () => {
  it("authenticates and returns the provider-neutral service response", async () => {
    let captured: unknown;
    const handlers = createRouteEtaRouteHandlers({
      authenticate: async () => identity(),
      service: {
        getRouteEta: async (actor, assignmentId) => {
          captured = { actor, assignmentId };
          return {
            assignment_id: assignmentId,
            status: "available",
            source: "google_routes",
            distance_meters: 2500,
            duration_seconds: 480,
            calculated_at: now,
            expires_at: later,
            advisory: {
              code: "TWO_WHEELER_ROUTE_ESTIMATE",
              message: "ETA chi mang tinh tham khao."
            }
          };
        }
      }
    });

    const response = await handlers.getRouteEta(
      new Request(`http://localhost/api/v1/assignments/${assignmentId}/route-eta`),
      assignmentId
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ assignment_id: assignmentId, status: "available" });
    expect(captured).toEqual({ actor: identity(), assignmentId });
  });
});

const assignmentId = "66666666-6666-4666-8666-666666666666";
const now = "2026-08-23T07:00:00.000Z";
const later = "2026-08-23T07:01:00.000Z";

function identity(): VerifiedSupabaseIdentity {
  return { subject: "11111111-1111-4111-8111-111111111111", issuer: "test", audience: ["authenticated"] };
}
