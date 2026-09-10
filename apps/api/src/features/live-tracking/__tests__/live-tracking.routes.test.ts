import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";

import { createLiveTrackingRouteHandlers } from "../live-tracking.route-handlers";

describe("live tracking routes", () => {
  it("forwards authenticated PUT and returns create/replace status", async () => {
    let captured: unknown;
    const handlers = createLiveTrackingRouteHandlers({
      authenticate: async () => identity(),
      service: {
        publish: async (actor, assignmentId, input) => {
          captured = { actor, assignmentId, input };
          return { created: true, location: response() };
        },
        getLatest: async () => response()
      }
    });
    const input = {
      latitude: 10.77,
      longitude: 106.7,
      observed_at: "2026-08-23T06:59:55.000Z",
      accuracy_meters: 12
    };
    const result = await handlers.publish(
      new Request(`http://localhost/api/v1/assignments/${assignmentId}/live-location`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }),
      assignmentId
    );
    expect(result.status).toBe(201);
    expect(captured).toEqual({ actor: identity(), assignmentId, input });
  });

  it("returns the authenticated latest point and controls invalid JSON", async () => {
    const handlers = createLiveTrackingRouteHandlers({
      authenticate: async () => identity(),
      service: {
        publish: async () => ({ created: false, location: response() }),
        getLatest: async () => response()
      }
    });
    const getResponse = await handlers.getLatest(
      new Request(`http://localhost/api/v1/assignments/${assignmentId}/live-location`),
      assignmentId
    );
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toMatchObject({ assignment_id: assignmentId, freshness: "current" });

    const invalid = await handlers.publish(new Request("http://localhost", {
      method: "PUT", body: "{", headers: { "content-type": "application/json" }
    }), assignmentId);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error_code: "INVALID_INPUT" });
  });
});

const assignmentId = "66666666-6666-4666-8666-666666666666";
function identity(): VerifiedSupabaseIdentity {
  return { subject: "22222222-2222-4222-8222-222222222222", issuer: "test", audience: ["authenticated"] };
}
function response() {
  return {
    assignment_id: assignmentId,
    latitude: 10.77,
    longitude: 106.7,
    observed_at: "2026-08-23T06:59:55.000Z",
    accuracy_meters: 12,
    received_at: "2026-08-23T07:00:00.000Z",
    expires_at: "2026-08-23T07:15:00.000Z",
    freshness: "current" as const
  };
}
