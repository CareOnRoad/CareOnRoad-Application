import { describe, expect, it } from "vitest";

import { createServiceRequestRouteHandlers } from "@/features/service-requests/service-request.route-handlers";
import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import type { InMemoryFoundationState } from "@/server/repositories/testing/in-memory-unit-of-work";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { AdminServiceRequestService } from "../admin-service-request.service";
import {
  adminIdentity,
  ADMIN_USER_ID,
  RIDER_USER_ID
} from "./admin-route-test-helpers";

const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_REQUEST_ID = "44444444-4444-4444-8444-444444444444";
const MOTORCYCLE_ID = "55555555-5555-4555-8555-555555555555";
const MECHANIC_ID = "66666666-6666-4666-8666-666666666666";
const ROUND_ID = "77777777-7777-4777-8777-777777777777";
const CANDIDATE_ID = "88888888-8888-4888-8888-888888888888";
const ASSIGNMENT_ID = "99999999-9999-4999-8999-999999999999";
const QUOTE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEDIA_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const HISTORY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const now = new Date("2026-07-06T06:00:00.000Z");
const reason = { reason: "Administrator approved request recovery" };

describe("AdminServiceRequestService", () => {
  it("returns bounded filtered views with safe detail and standalone relationships", async () => {
    const service = createService(createState({ withRelationships: true }));
    const page = await service.listRequests(adminIdentity, {
      status: "offered",
      service_type: "mobile_repair",
      priority: "high",
      rider_id: RIDER_USER_ID,
      mechanic_id: MECHANIC_ID,
      request_code: "COR-MOB-20260706-1",
      from: "2026-07-05T00:00:00.000Z",
      to: "2026-07-07T00:00:00.000Z",
      limit: "1"
    });
    expect(page.items).toEqual([
      expect.objectContaining({
        id: REQUEST_ID,
        mechanic_id: MECHANIC_ID,
        status: "offered"
      })
    ]);
    const detail = await service.getRequest(adminIdentity, REQUEST_ID);
    expect(detail).toMatchObject({
      id: REQUEST_ID,
      dispatch: { round_id: ROUND_ID, open_candidate_count: 0 },
      assignment: { id: ASSIGNMENT_ID, mechanic_id: MECHANIC_ID },
      latest_quote: { id: QUOTE_ID, version: 1, total_amount: 120000 },
      reminder: {
        reminder_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        occurrence_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
      }
    });
    expect(JSON.stringify(detail)).not.toMatch(
      /problem_description|safety_answers|address_text|latitude|longitude|secret/
    );

    await expect(
      service.getAssignment(adminIdentity, REQUEST_ID)
    ).resolves.toMatchObject({ id: ASSIGNMENT_ID });
    const quotes = await service.listQuotes(adminIdentity, REQUEST_ID, {
      limit: "10"
    });
    expect(quotes.items).toEqual([
      expect.objectContaining({ id: QUOTE_ID, total_amount: 120000 })
    ]);
    expect(JSON.stringify(quotes)).not.toMatch(/replace the battery|line|notes/);
  });

  it("returns deterministic sanitized timeline and metadata-only media", async () => {
    const service = createService(createState());
    const timeline = await service.listTimeline(adminIdentity, REQUEST_ID, {
      limit: "10"
    });
    expect(timeline.items).toEqual([
      expect.objectContaining({
        id: HISTORY_ID,
        kind: "status",
        to_status: "offered"
      })
    ]);
    expect(JSON.stringify(timeline)).not.toMatch(
      /problem_description|safety_answers|address_text/
    );

    const media = await service.listMedia(adminIdentity, REQUEST_ID, {
      limit: "10"
    });
    expect(media.items).toEqual([
      {
        id: MEDIA_ID,
        request_id: REQUEST_ID,
        media_type: "image",
        content_type: "image/jpeg",
        size_bytes: 2048,
        created_by: RIDER_USER_ID,
        created_at: "2026-07-06T04:00:00.000Z"
      }
    ]);
    expect(JSON.stringify(media)).not.toMatch(/object_reference|checksum|bucket/);
  });

  it("cancels with idempotent replay and reconciles open dispatch atomically", async () => {
    const unitOfWork = createState({ activeDispatch: true });
    const service = createService(unitOfWork);
    const response = await service.cancel(
      adminIdentity,
      REQUEST_ID,
      reason,
      "admin-request-cancel-key"
    );
    const replay = await service.cancel(
      adminIdentity,
      REQUEST_ID,
      reason,
      "admin-request-cancel-key"
    );
    expect(response.status).toBe("canceled");
    expect(replay).toEqual(response);

    const snapshot = unitOfWork.snapshot();
    expect(
      snapshot.dispatchRounds.find((round) => round.id === ROUND_ID)?.status
    ).toBe("canceled");
    expect(
      snapshot.dispatchCandidates.find((item) => item.id === CANDIDATE_ID)?.status
    ).toBe("cancelled");
    expect(snapshot.requestStatusHistory.at(-1)).toMatchObject({
      fromStatus: "offered",
      toStatus: "canceled",
      actorId: ADMIN_USER_ID
    });
    expect(snapshot.auditLogs).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(JSON.stringify(snapshot.auditLogs[0]?.metadata)).not.toMatch(
      /problem|address|safety|reason/
    );
  });

  it("manually escalates only eligible states and rejects active assignment conflicts", async () => {
    const service = createService(createState());
    await expect(
      service.manualEscalate(
        adminIdentity,
        REQUEST_ID,
        reason,
        "admin-request-escalate-key"
      )
    ).resolves.toMatchObject({ status: "manual_escalation" });

    const assignedService = createService(
      createState({ withRelationships: true, requestStatus: "assigned" })
    );
    await expect(
      assignedService.cancel(
        adminIdentity,
        REQUEST_ID,
        reason,
        "admin-request-assigned-cancel-key"
      )
    ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });
  });

  it("isolates note text from audit/outbox and rider-owned responses", async () => {
    const unitOfWork = createState();
    const service = createService(unitOfWork);
    const noteText = "Private escalation context: rider prefers phone follow-up";
    await expect(
      service.addNote(
        adminIdentity,
        REQUEST_ID,
        { ...reason, note: noteText },
        "admin-request-note-key"
      )
    ).resolves.toMatchObject({ request_id: REQUEST_ID, note: noteText });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.adminInternalNotes[0]?.noteText).toBe(noteText);
    expect(JSON.stringify(snapshot.auditLogs)).not.toContain(noteText);
    expect(JSON.stringify(snapshot.outboxEvents)).not.toContain(noteText);

    const riderHandlers = createServiceRequestRouteHandlers({
      authenticate: async () => ({ ...adminIdentity, subject: RIDER_USER_ID }),
      serviceRequestService: new ServiceRequestService(unitOfWork)
    });
    const riderRouteResponse = await riderHandlers.getServiceRequest(
      new Request(`http://localhost/api/v1/service-requests/${REQUEST_ID}`),
      REQUEST_ID
    );
    expect(riderRouteResponse.status).toBe(200);
    const riderResponse = await riderRouteResponse.json();
    expect(JSON.stringify(riderResponse)).not.toContain(noteText);
    expect(riderResponse).not.toHaveProperty("admin_notes");
  });

  it("rolls back request, dispatch, history, and idempotency on outbox failure", async () => {
    const occurrenceId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const unitOfWork = createState({
      activeDispatch: true,
      outboxEvents: [
        {
          id: "12121212-1212-4212-8212-121212121212",
          topic: "admin.service_request.canceled",
          aggregateType: "service_request",
          aggregateId: REQUEST_ID,
          dedupeKey: `admin.service_request.canceled:${REQUEST_ID}:${occurrenceId}`,
          payload: {},
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: now,
          createdAt: now
        }
      ]
    });
    const ids = [
      "13131313-1313-4313-8313-131313131313",
      "14141414-1414-4414-8414-141414141414",
      occurrenceId,
      "15151515-1515-4515-8515-151515151515"
    ];
    const service = new AdminServiceRequestService(unitOfWork, {
      now: () => now,
      createId: () => ids.shift()!
    });
    await expect(
      service.cancel(
        adminIdentity,
        REQUEST_ID,
        reason,
        "admin-request-rollback-key"
      )
    ).rejects.toThrow("OUTBOX_DEDUPE_KEY_EXISTS");
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.serviceRequests[0]?.status).toBe("offered");
    expect(snapshot.dispatchRounds[0]?.status).toBe("active");
    expect(snapshot.dispatchCandidates[0]?.status).toBe("offered");
    expect(snapshot.requestStatusHistory).toHaveLength(1);
    expect(snapshot.idempotencyRecords).toHaveLength(0);
    expect(snapshot.auditLogs).toHaveLength(0);
  });
});

function createService(unitOfWork: InMemoryUnitOfWork) {
  return new AdminServiceRequestService(unitOfWork, { now: () => now });
}

function createState(
  options: {
    activeDispatch?: boolean;
    withRelationships?: boolean;
    requestStatus?: "offered" | "assigned";
    outboxEvents?: InMemoryFoundationState["outboxEvents"];
  } = {}
) {
  const requestStatus = options.requestStatus ?? "offered";
  const relationships = options.withRelationships;
  return new InMemoryUnitOfWork({
    users: [
      user(ADMIN_USER_ID),
      user(RIDER_USER_ID),
      user(MECHANIC_ID)
    ],
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
        problemDescription: "Engine stopped. secret=do-not-copy",
        status: requestStatus,
        priority: "high",
        serviceLocation: { latitude: 10.75, longitude: 106.67 },
        addressText: "Full private rider address",
        safetyAnswers: { raw_text: "private safety answer" },
        reminderId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        reminderContextId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        createdAt: new Date("2026-07-06T03:00:00Z"),
        updatedAt: new Date("2026-07-06T05:00:00Z")
      },
      {
        id: OTHER_REQUEST_ID,
        requestCode: "COR-MNT-20260705-1",
        riderId: RIDER_USER_ID,
        motorcycleId: MOTORCYCLE_ID,
        serviceType: "periodic_maintenance",
        problemDescription: "Scheduled maintenance",
        status: "submitted",
        priority: "normal",
        createdAt: new Date("2026-07-05T03:00:00Z"),
        updatedAt: new Date("2026-07-05T03:00:00Z")
      }
    ],
    requestStatusHistory: [
      {
        id: HISTORY_ID,
        requestId: REQUEST_ID,
        fromStatus: "dispatching",
        toStatus: "offered",
        actorId: RIDER_USER_ID,
        reason: "Offer created",
        createdAt: new Date("2026-07-06T05:00:00Z")
      }
    ],
    requestMediaMetadata: [
      {
        id: MEDIA_ID,
        requestId: REQUEST_ID,
        mediaType: "image",
        objectReference: "private-bucket/raw-photo.jpg",
        contentType: "image/jpeg",
        sizeBytes: 2048,
        checksum: "private-checksum",
        createdBy: RIDER_USER_ID,
        createdAt: new Date("2026-07-06T04:00:00Z")
      }
    ],
    dispatchRounds:
      options.activeDispatch || relationships
        ? [
            {
              id: ROUND_ID,
              requestId: REQUEST_ID,
              roundNumber: 1,
              radiusMeters: 5000,
              status: options.activeDispatch ? "active" : "accepted",
              startedAt: new Date("2026-07-06T04:30:00Z"),
              expiresAt: new Date("2026-07-06T04:31:00Z"),
              ...(options.activeDispatch
                ? {}
                : { completedAt: new Date("2026-07-06T04:31:00Z") })
            }
          ]
        : [],
    dispatchCandidates:
      options.activeDispatch || relationships
        ? [
            {
              id: CANDIDATE_ID,
              roundId: ROUND_ID,
              requestId: REQUEST_ID,
              mechanicId: MECHANIC_ID,
              rank: 1,
              status: options.activeDispatch ? "offered" : "accepted",
              offeredAt: new Date("2026-07-06T04:30:00Z"),
              expiresAt: new Date("2026-07-06T04:31:00Z"),
              createdAt: new Date("2026-07-06T04:30:00Z")
            }
          ]
        : [],
    assignments: relationships
      ? [
          {
            id: ASSIGNMENT_ID,
            requestId: REQUEST_ID,
            mechanicId: MECHANIC_ID,
            acceptedCandidateId: CANDIDATE_ID,
            status: "accepted",
            acceptedAt: new Date("2026-07-06T04:31:00Z"),
            createdAt: new Date("2026-07-06T04:31:00Z"),
            updatedAt: new Date("2026-07-06T04:31:00Z")
          }
        ]
      : [],
    quotes: relationships
      ? [
          {
            id: QUOTE_ID,
            requestId: REQUEST_ID,
            assignmentId: ASSIGNMENT_ID,
            version: 1,
            status: "pending",
            currency: "VND",
            subtotalAmount: 120000,
            discountAmount: 0,
            totalAmount: 120000,
            notes: "replace the battery",
            createdBy: MECHANIC_ID,
            createdAt: new Date("2026-07-06T04:45:00Z"),
            lines: [
              {
                id: "16161616-1616-4616-8616-161616161616",
                quoteId: QUOTE_ID,
                lineType: "part",
                description: "replace the battery",
                quantity: 1,
                unitAmount: 120000,
                lineTotalAmount: 120000,
                sortOrder: 0
              }
            ]
          }
        ]
      : [],
    outboxEvents: options.outboxEvents ?? []
  });
}

function user(id: string) {
  return {
    id,
    status: "active" as const,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z")
  };
}
