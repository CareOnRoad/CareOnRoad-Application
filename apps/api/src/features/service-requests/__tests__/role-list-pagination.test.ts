import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AssignmentService } from "@/features/assignments/assignment.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { ServiceRequestService } from "../service-request.service";
import { createServiceRequestRouteHandlers } from "../service-request.route-handlers";
import { QuoteService } from "@/features/quotes/quote.service";

describe("role list pagination", () => {
  it("paginates tied timestamps with ownership, union visibility and independent quote authorization", async () => {
    const actorId = randomUUID(); const other = randomUUID(); const now = new Date("2026-10-02T00:00:00Z");
    const requests = Array.from({ length: 25 }, (_, index) => ({ id: randomUUID(), requestCode: `TEST-${index}`,
      riderId: index === 24 ? other : actorId, motorcycleId: randomUUID(), serviceType: "mobile_repair" as const,
      problemDescription: "Need repair", status: "submitted" as const, priority: "normal" as const, createdAt: now, updatedAt: now }));
    const uow = new InMemoryUnitOfWork({ users: [{ id: actorId, status: "active", createdAt: now, updatedAt: now }],
      userRoles: [{ userId: actorId, role: "rider" }, { userId: actorId, role: "mechanic" }], serviceRequests: requests,
      assignments: requests.map((request, index) => ({ id: randomUUID(), requestId: request.id, mechanicId: index === 24 ? actorId : other,
        acceptedCandidateId: randomUUID(), status: "completed", acceptedAt: now, createdAt: now, updatedAt: now })) });
    const identity = { subject: actorId, issuer: "test", audience: ["authenticated"] };
    const service = new ServiceRequestService(uow); const assignments = new AssignmentService(uow);
    const first = await service.listServiceRequests(identity); expect(first.items).toHaveLength(20); expect(first.page.has_more).toBe(true);
    const second = await service.listServiceRequests(identity, { cursor: first.page.next_cursor });
    expect(second.items).toHaveLength(4); expect(second.page).toEqual({ has_more: false, next_cursor: null });
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(24);
    expect([...first.items, ...second.items].some((item) => item.rider_id === other)).toBe(false);
    const page = await assignments.listAssignments(identity, { status: "completed", limit: 20 });
    const next = await assignments.listAssignments(identity, { cursor: page.page.next_cursor });
    expect(new Set([...page.items, ...next.items].map((item) => item.id)).size).toBe(25);
    expect((await assignments.listAssignments(identity, { status: "accepted" })).items).toHaveLength(0);
    await expect(new QuoteService(uow).listQuotes(identity, requests[24]!.id)).resolves.toEqual({ items: [] });
    const handlers = createServiceRequestRouteHandlers({ authenticate: async () => identity, serviceRequestService: service });
    for (const query of ["limit=101", "cursor=invalid", "status=invalid", "date_from=tomorrow", "date_from=2026-10-03T00:00:00Z&date_to=2026-10-02T00:00:00Z", "limit=1&limit=2", "rider_id=" + other]) {
      expect((await handlers.listServiceRequests(new Request("http://localhost/api/v1/service-requests?" + query))).status).toBe(400);
    }
  });
});
