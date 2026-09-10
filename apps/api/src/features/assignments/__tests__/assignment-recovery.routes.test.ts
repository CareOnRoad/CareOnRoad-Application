import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";

import { createAssignmentRouteHandlers } from "../assignment.route-handlers";

describe("assignment recovery route", () => {
  it("forwards authenticated JSON and idempotency key to the recovery service", async () => {
    let captured: unknown;
    const handlers = createAssignmentRouteHandlers({
      authenticate: async () => identity(),
      acceptService: { acceptOffer: async () => { throw new Error("unused"); } },
      assignmentService: {
        listAssignments: async () => ({ items: [] }),
        transitionAssignment: async () => { throw new Error("unused"); }
      },
      recoveryService: {
        recover: async (_identity, assignmentId, input, key) => {
          captured = { assignmentId, input, key };
          return {
            assignment_id: assignmentId,
            request_id: "22222222-2222-4222-8222-222222222222",
            status: "recovery_canceled",
            reason_code: "cannot_continue",
            redispatch_status: "queued",
            recovered_at: "2026-08-23T03:00:00.000Z"
          };
        }
      }
    });
    const response = await handlers.recoverAssignment(new Request(
      "http://localhost/api/v1/assignments/11111111-1111-4111-8111-111111111111/recover",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "recover-route-001" },
        body: JSON.stringify({ reason_code: "cannot_continue" })
      }
    ), "11111111-1111-4111-8111-111111111111");

    expect(response.status).toBe(200);
    expect(captured).toEqual({
      assignmentId: "11111111-1111-4111-8111-111111111111",
      input: { reason_code: "cannot_continue" },
      key: "recover-route-001"
    });
  });
});

function identity(): VerifiedSupabaseIdentity {
  return { subject: "33333333-3333-4333-8333-333333333333", issuer: "test", audience: ["authenticated"] };
}
