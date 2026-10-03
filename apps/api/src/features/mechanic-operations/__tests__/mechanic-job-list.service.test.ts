import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { MechanicJobListService } from "../mechanic-job-list.service";
import {
  COMPLETED_ASSIGNMENT_ID,
  ASSIGNMENT_ID,
  REQUEST_ID,
  RIDER_ID,
  OTHER_MECHANIC_ID,
  NOW,
  createMechanicOperationsUnitOfWork,
  identity,
  MECHANIC_ID,
  OTHER_ASSIGNMENT_ID
} from "./mechanic-operations-test-fixtures";

describe("MechanicJobListService", () => {
  it("restores an owned job after rebuilding the service without offers, with bounded verified references and redacted private fields", async () => {
    const state = createMechanicOperationsUnitOfWork().snapshot();
    state.dispatchCandidates = []; state.dispatchRounds = [];
    state.serviceRequests.find((r) => r.id === REQUEST_ID)!.addressText = "Địa điểm phục vụ";
    state.motorcycles[0]!.notes = "PRIVATE_MOTORCYCLE_NOTE";
    state.motorcycles[0]!.licensePlate = "TEST-123";
    state.adminInternalNotes.push({ id: randomUUID(), adminId: RIDER_ID, serviceRequestId: REQUEST_ID, noteText: "PRIVATE_ADMIN_NOTE", createdAt: NOW });
    const quoteId = randomUUID();
    state.quotes.push({ id: quoteId, requestId: REQUEST_ID, assignmentId: ASSIGNMENT_ID, purpose: "rescue_labor", version: 1,
      status: "approved", currency: "VND", subtotalAmount: 100_000, discountAmount: 0, totalAmount: 100_000, createdBy: MECHANIC_ID, createdAt: NOW, lines: [] });
    state.assignments.find((a) => a.id === ASSIGNMENT_ID)!.rescueLaborQuoteId = quoteId;
    state.assignments.find((a) => a.id === ASSIGNMENT_ID)!.rescuePaymentTiming = "after_repair";
    state.quotes.push({ ...state.quotes.find((q) => q.id === quoteId)!, id: randomUUID(), assignmentId: OTHER_ASSIGNMENT_ID, version: 99 });
    state.assignmentCompletionChecklists.push({ id: randomUUID(), assignmentId: ASSIGNMENT_ID, requestId: REQUEST_ID,
      mechanicId: MECHANIC_ID, revision: 2, workSummary: "Đã kiểm tra", safetyChecklist: { testRideCompleted: true, toolsRemoved: true,
        areaSafe: true, riderBriefed: true, noFluidLeak: true }, notes: "PRIVATE_CHECKLIST_NOTE", createdBy: MECHANIC_ID, createdAt: NOW });
    for (let i = 0; i < 25; i++) state.mediaUploadIntents.push({ id: randomUUID(), actorId: RIDER_ID, actorRole: "rider", requestId: REQUEST_ID,
      resourceType: "service_request", purpose: "request_photo", storageBucket: "PRIVATE_BUCKET", objectKey: `PRIVATE_PATH/${i}`,
      contentType: "image/jpeg", sizeBytes: 10, sha256: "PRIVATE_CHECKSUM", status: "finalized", mediaMetadataId: randomUUID(),
      finalizedResponse: { secret: "PRIVATE_PROVIDER_RESPONSE" }, expiresAt: NOW, createdAt: NOW, updatedAt: NOW });
    state.mediaUploadIntents.push({ ...state.mediaUploadIntents[0]!, id: randomUUID(), status: "pending" });
    state.mediaUploadIntents.push({ ...state.mediaUploadIntents[0]!, id: randomUUID(), resourceType: "assignment", assignmentId: OTHER_ASSIGNMENT_ID });
    const detail = await new MechanicJobListService(new InMemoryUnitOfWork(state)).getJob(identity(MECHANIC_ID), ASSIGNMENT_ID);
    expect(detail).toMatchObject({ assignment: { id: ASSIGNMENT_ID }, request: { problem_description: expect.any(String),
      address_text: "Địa điểm phục vụ", location: { latitude: 10.762622, longitude: 106.660172 } }, motorcycle: { brand_text: "Honda", license_plate: "TEST-123" },
      latest_quote: { id: quoteId }, agreements: { rescue_labor: { id: quoteId }, rescue_payment_timing: "after_repair" },
      completion_checklist: { revision: 2, work_summary: "Đã kiểm tra" }, sensitive_details_redacted: false });
    expect(detail.media.items).toHaveLength(20); expect(detail.media.has_more).toBe(true);
    expect(JSON.stringify(detail)).not.toMatch(/PRIVATE_|objectKey|storageBucket|finalizedResponse|notes/);
  });

  it("requires active current mechanic ownership and keeps terminal summaries without location/media/license plate", async () => {
    const uow = createMechanicOperationsUnitOfWork(); const service = new MechanicJobListService(uow);
    await expect(service.getJob(identity(OTHER_MECHANIC_ID), ASSIGNMENT_ID)).rejects.toMatchObject({ status: 403 });
    await expect(service.getJob(identity(RIDER_ID), ASSIGNMENT_ID)).rejects.toMatchObject({ status: 403 });
    await expect(service.getJob(identity(MECHANIC_ID), "invalid")).rejects.toMatchObject({ status: 400 });
    await expect(service.getJob(identity(MECHANIC_ID), randomUUID())).rejects.toMatchObject({ status: 404 });
    const terminal = await service.getJob(identity(MECHANIC_ID), COMPLETED_ASSIGNMENT_ID);
    expect(terminal).toMatchObject({ assignment: { status: "completed" }, sensitive_details_redacted: true, media: { items: [], has_more: false } });
    expect(terminal.request).not.toHaveProperty("location"); expect(terminal.request).not.toHaveProperty("address_text");
    expect(terminal.motorcycle).not.toHaveProperty("license_plate");
    const state = uow.snapshot(); state.users.find((u) => u.id === MECHANIC_ID)!.status = "suspended";
    await expect(new MechanicJobListService(new InMemoryUnitOfWork(state)).getJob(identity(MECHANIC_ID), COMPLETED_ASSIGNMENT_ID)).rejects.toMatchObject({ status: 403 });
    state.users.find((u) => u.id === MECHANIC_ID)!.status = "active";
    state.userRoles = state.userRoles.filter((r) => r.userId !== MECHANIC_ID);
    await expect(new MechanicJobListService(new InMemoryUnitOfWork(state)).getJob(identity(MECHANIC_ID), COMPLETED_ASSIGNMENT_ID)).rejects.toMatchObject({ status: 403 });
  });
  it("filters active/status/date jobs and never returns another mechanic's job", async () => {
    const service = new MechanicJobListService(createMechanicOperationsUnitOfWork());

    const active = await service.listJobs(identity(MECHANIC_ID), { active_only: "true" });
    expect(active.items.map((item) => item.assignment_id)).toEqual([
      "99999999-9999-4999-8999-999999999999"
    ]);

    const completed = await service.listJobs(identity(MECHANIC_ID), {
      status: "completed",
      date_from: "2026-07-01T00:00:00.000Z",
      date_to: "2026-07-06T23:59:59.000Z"
    });
    expect(completed.items.map((item) => item.assignment_id)).toEqual([
      COMPLETED_ASSIGNMENT_ID
    ]);
    expect(JSON.stringify(completed)).not.toContain(OTHER_ASSIGNMENT_ID);
    expect(JSON.stringify(completed)).not.toContain("Private rider problem text");
  });

  it("uses stable cursor pagination and rejects malformed filters", async () => {
    const service = new MechanicJobListService(createMechanicOperationsUnitOfWork());
    const first = await service.listJobs(identity(MECHANIC_ID), { limit: "1" });
    expect(first.items).toHaveLength(1);
    expect(first.page.has_more).toBe(true);
    const second = await service.listJobs(identity(MECHANIC_ID), {
      limit: "10",
      cursor: first.page.next_cursor
    });
    expect(second.items.map((item) => item.assignment_id)).not.toContain(
      first.items[0]!.assignment_id
    );

    await expect(
      service.listJobs(identity(MECHANIC_ID), { status: "unknown" })
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
  });
});
