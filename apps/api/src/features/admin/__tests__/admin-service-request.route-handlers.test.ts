import { describe, expect, it, vi } from "vitest";

import { AuthError } from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { createAdminServiceRequestRouteHandlers } from "../admin-service-request.route-handlers";
import { AdminServiceRequestService } from "../admin-service-request.service";
import {
  adminIdentity,
  ADMIN_USER_ID,
  createAdminRequest,
  expectApiError,
  RIDER_USER_ID
} from "./admin-route-test-helpers";

const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_REQUEST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MOTORCYCLE_ID = "44444444-4444-4444-8444-444444444444";
const MECHANIC_ID = "55555555-5555-4555-8555-555555555555";
const ASSIGNMENT_ID = "66666666-6666-4666-8666-666666666666";
const CANDIDATE_ID = "77777777-7777-4777-8777-777777777777";
const timestamp = new Date("2026-07-06T06:00:00.000Z");
const reason = { reason: "Administrator approved request operation" };

describe("admin service-request route handlers", () => {
  it("enforces authentication and active-admin authorization", async () => {
    await expectApiError(
      await createHandlers().listRequests(
        createAdminRequest("/api/v1/admin/service-requests")
      ),
      401,
      "UNAUTHORIZED"
    );
    await expectApiError(
      await createHandlers(RIDER_USER_ID).listRequests(
        authorized("/api/v1/admin/service-requests")
      ),
      403,
      "FORBIDDEN"
    );
  });

  it("validates filters, reason, idempotency, and rejects arbitrary status input", async () => {
    const handlers = createHandlers();
    await expectApiError(
      await handlers.listRequests(
        authorized("/api/v1/admin/service-requests?status=invalid")
      ),
      400,
      "INVALID_INPUT"
    );
    await expectApiError(
      await handlers.cancel(
        createAdminRequest(
          `/api/v1/admin/service-requests/${REQUEST_ID}/cancel`,
          { method: "POST", token: "valid-token", body: reason }
        ),
        REQUEST_ID
      ),
      400,
      "INVALID_INPUT"
    );
    await expectApiError(
      await handlers.cancel(
        command(
          "cancel",
          { reason: "short", status: "completed" },
          "request-status-key"
        ),
        REQUEST_ID
      ),
      400,
      "INVALID_INPUT"
    );
  });

  it("exposes Patch D reads and metadata-only media with bounded pagination", async () => {
    const handlers = createHandlers();
    const firstPage = await (
      await handlers.listRequests(
        authorized("/api/v1/admin/service-requests?limit=1")
      )
    ).json();
    expect(firstPage.page).toMatchObject({ limit: 1, has_more: true });
    const secondPage = await (
      await handlers.listRequests(
        authorized(
          `/api/v1/admin/service-requests?limit=1&cursor=${encodeURIComponent(firstPage.page.next_cursor)}`
        )
      )
    ).json();
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);

    const list = await (
      await handlers.listRequests(
        authorized(
          `/api/v1/admin/service-requests?status=offered&rider_id=${RIDER_USER_ID}&limit=10`
        )
      )
    ).json();
    expect(list).toMatchObject({
      items: [{ id: REQUEST_ID, status: "offered" }],
      page: { limit: 10, has_more: false }
    });
    expect(
      (
        await handlers.getRequest(
          authorized(`/api/v1/admin/service-requests/${REQUEST_ID}`),
          REQUEST_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.listTimeline(
          authorized(
            `/api/v1/admin/service-requests/${REQUEST_ID}/timeline?limit=10`
          ),
          REQUEST_ID
        )
      ).status
    ).toBe(200);
    const media = await (
      await handlers.listMedia(
        authorized(
          `/api/v1/admin/service-requests/${REQUEST_ID}/media?limit=10`
        ),
        REQUEST_ID
      )
    ).json();
    expect(media.items[0]).toMatchObject({
      media_type: "image",
      content_type: "image/jpeg"
    });
    expect(JSON.stringify(media)).not.toMatch(/object_reference|checksum|raw-photo/);
    expect(
      (
        await handlers.getAssignment(
          authorized(
            `/api/v1/admin/service-requests/${REQUEST_ID}/assignment`
          ),
          REQUEST_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.listQuotes(
          authorized(
            `/api/v1/admin/service-requests/${REQUEST_ID}/quotes?limit=10`
          ),
          REQUEST_ID
        )
      ).status
    ).toBe(200);
  });

  it("runs cancel, escalation, and note commands through explicit routes only", async () => {
    const cancelHandlers = createHandlers();
    const canceled = await cancelHandlers.cancel(
      command("cancel", reason, "request-cancel-route-key"),
      REQUEST_ID
    );
    const replay = await cancelHandlers.cancel(
      command("cancel", reason, "request-cancel-route-key"),
      REQUEST_ID
    );
    expect(canceled.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(await canceled.json());

    const escalationHandlers = createHandlers();
    expect(
      (
        await escalationHandlers.manualEscalate(
          command(
            "manual-escalate",
            reason,
            "request-escalate-route-key"
          ),
          REQUEST_ID
        )
      ).status
    ).toBe(200);

    const noteHandlers = createHandlers();
    expect(
      (
        await noteHandlers.addNote(
          command(
            "notes",
            { ...reason, note: "Private operations note" },
            "request-note-route-key"
          ),
          REQUEST_ID
        )
      ).status
    ).toBe(201);
    expect(noteHandlers).not.toHaveProperty("setStatus");
    expect(noteHandlers).not.toHaveProperty("updateStatus");
  });
});

function createHandlers(subject = ADMIN_USER_ID) {
  const unitOfWork = new InMemoryUnitOfWork({
    users: [user(ADMIN_USER_ID), user(RIDER_USER_ID), user(MECHANIC_ID)],
    userRoles: [
      { userId: ADMIN_USER_ID, role: "admin" },
      { userId: RIDER_USER_ID, role: "rider" },
      { userId: MECHANIC_ID, role: "mechanic" }
    ],
    serviceRequests: [
      {
        id: REQUEST_ID,
        requestCode: "COR-MOB-20260706-1",
        riderId: RIDER_USER_ID,
        motorcycleId: MOTORCYCLE_ID,
        serviceType: "mobile_repair",
        problemDescription: "Private rider problem",
        status: "offered",
        priority: "high",
        addressText: "Private address",
        createdAt: new Date("2026-07-06T03:00:00Z"),
        updatedAt: new Date("2026-07-06T05:00:00Z")
      },
      {
        id: OTHER_REQUEST_ID,
        requestCode: "COR-MNT-20260705-1",
        riderId: RIDER_USER_ID,
        motorcycleId: MOTORCYCLE_ID,
        serviceType: "periodic_maintenance",
        problemDescription: "Routine service",
        status: "submitted",
        priority: "normal",
        createdAt: new Date("2026-07-05T03:00:00Z"),
        updatedAt: new Date("2026-07-05T03:00:00Z")
      }
    ],
    requestStatusHistory: [
      {
        id: "88888888-8888-4888-8888-888888888888",
        requestId: REQUEST_ID,
        fromStatus: "dispatching",
        toStatus: "offered",
        createdAt: new Date("2026-07-06T05:00:00Z")
      }
    ],
    requestMediaMetadata: [
      {
        id: "99999999-9999-4999-8999-999999999999",
        requestId: REQUEST_ID,
        mediaType: "image",
        objectReference: "private/raw-photo.jpg",
        contentType: "image/jpeg",
        checksum: "private",
        createdBy: RIDER_USER_ID,
        createdAt: new Date("2026-07-06T04:00:00Z")
      }
    ],
    assignments: [
      {
        id: ASSIGNMENT_ID,
        requestId: REQUEST_ID,
        mechanicId: MECHANIC_ID,
        acceptedCandidateId: CANDIDATE_ID,
        status: "canceled",
        acceptedAt: new Date("2026-07-06T04:00:00Z"),
        canceledAt: new Date("2026-07-06T04:30:00Z"),
        createdAt: new Date("2026-07-06T04:00:00Z"),
        updatedAt: new Date("2026-07-06T04:30:00Z")
      }
    ],
    quotes: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        requestId: REQUEST_ID,
        assignmentId: ASSIGNMENT_ID,
        version: 1,
        status: "rejected",
        currency: "VND",
        subtotalAmount: 100000,
        discountAmount: 0,
        totalAmount: 100000,
        createdBy: MECHANIC_ID,
        createdAt: new Date("2026-07-06T04:15:00Z"),
        lines: []
      }
    ]
  });
  return createAdminServiceRequestRouteHandlers({
    authenticate: vi.fn(async (request: Request) => {
      if (!request.headers.has("authorization")) {
        throw new AuthError("UNAUTHORIZED", "Authentication is required.", 401);
      }
      return { ...adminIdentity, subject };
    }),
    service: new AdminServiceRequestService(unitOfWork, {
      now: () => timestamp
    })
  });
}

function authorized(path: string) {
  return createAdminRequest(path, { token: "valid-token" });
}

function command(action: string, body: unknown, idempotencyKey: string) {
  return createAdminRequest(
    `/api/v1/admin/service-requests/${REQUEST_ID}/${action}`,
    { method: "POST", token: "valid-token", body, idempotencyKey }
  );
}

function user(id: string) {
  return {
    id,
    status: "active" as const,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
