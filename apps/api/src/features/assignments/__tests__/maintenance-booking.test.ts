import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import { QuoteService } from "@/features/quotes/quote.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { OutboxWorker } from "@/server/workers/outbox.worker";
import { DispatchWorker } from "@/server/workers/dispatch.worker";
import { AcceptAssignmentService } from "../accept-assignment.service";
import { AssignmentService } from "../assignment.service";
import { AdminServiceRequestService } from "@/features/admin/admin-service-request.service";
import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";

const rider = "11111111-1111-4111-8111-111111111111";
const mechanic = "22222222-2222-4222-8222-222222222222";
const motorcycle = "33333333-3333-4333-8333-333333333333";
const identity = (subject: string) => ({ subject, issuer: "test", audience: ["authenticated"], expiresAt: 9_999_999_999, claims: {} });
const location = { latitude: 10.77, longitude: 106.69 };
const appointment = new Date("2026-10-03T10:00:00Z");

function setup(serviceType: ServiceType = "periodic_maintenance") {
  let time = new Date("2026-10-01T09:00:00Z");
  const now = () => time;
  const uow = new InMemoryUnitOfWork({
    users: [rider, mechanic].map((id) => ({ id, status: "active", createdAt: time, updatedAt: time })),
    userRoles: [{ userId: rider, role: "rider" }, { userId: mechanic, role: "mechanic" }],
    motorcycles: [{ id: motorcycle, riderId: rider, brandText: "Honda", modelText: "Wave", createdAt: time, updatedAt: time }],
    mechanicProfiles: [{ userId: mechanic, profileStatus: "active", isAvailable: true, serviceRadiusKm: 10,
      latestLocation: location, locationUpdatedAt: time, availabilityUpdatedAt: time, ratingAvg: 4, ratingCount: 1,
      serviceTypes: ["periodic_maintenance", "mobile_repair", "at_home_service", "other"], createdAt: time, updatedAt: time }]
  });
  const requests = new ServiceRequestService(uow, { now });
  const dispatch = new DispatchService(uow, { now });
  const accept = new AcceptAssignmentService(uow, { now });
  const assignments = new AssignmentService(uow, { now });
  const quotes = new QuoteService(uow, { now });
  async function book(start = appointment, key = randomUUID()) {
    const request = await requests.createServiceRequest(identity(rider), {
      motorcycle_id: motorcycle, service_type: serviceType, problem_description: "Cần phục vụ theo lịch",
      ...(serviceType === "other" ? { fulfillment_mode: "scheduled_visit" } : {}),
      location, address_text: "Địa chỉ phục vụ", scheduled_start_at: start.toISOString()
    }, key);
    return request;
  }
  async function offer(start = appointment) {
    const request = await book(start);
    if (serviceType === "periodic_maintenance") await dispatch.restartRecoveredRequest(request.id);
    else await dispatch.startDispatch(identity(rider), request.id);
    const candidate = uow.snapshot().dispatchCandidates.find((item) => item.requestId === request.id)!;
    return { request, candidate };
  }
  return { uow, now, tick: (value: Date) => { time = value; }, requests, dispatch, accept, assignments, quotes, book, offer };
}

describe("maintenance appointments", () => {
  it.each(["at_home_service", "other"] as const)("reserves %s with required duration, correct notifications and strict activation boundaries", async (type) => {
    const s = setup(type); const booked = await s.offer();
    await expect(s.accept.acceptOffer(identity(mechanic), booked.candidate.id)).rejects.toMatchObject({ status: 400 });
    for (const duration of [14, 481]) expect(() => s.accept.acceptOffer(identity(mechanic), booked.candidate.id,
      { estimated_duration_minutes: duration })).toThrowError(expect.objectContaining({ status: 400 }));
    const job = await s.accept.acceptOffer(identity(mechanic), booked.candidate.id, { estimated_duration_minutes: 60 });
    expect(job).toMatchObject({ scheduled_start_at: appointment.toISOString(), appointment_status: "confirmed" });
    expect(await s.uow.execute(({ assignments }) => assignments.findActiveByMechanicForUpdate(mechanic))).toBeUndefined();
    expect(s.uow.snapshot().notifications.some((n) => n.type === "appointment.booking.confirmed")).toBe(true);
    expect(s.uow.snapshot().outboxEvents.some((e) => e.topic === "maintenance.dispatch.requested")).toBe(false);
    s.tick(new Date(appointment.getTime() - 30 * 60_000 - 1));
    await expect(s.assignments.transitionAssignment(identity(mechanic), job.id, { status: "en_route" })).rejects.toMatchObject({ status: 409 });
    s.tick(new Date(appointment.getTime() - 30 * 60_000));
    const worker = new DispatchWorker(s.uow, { now: s.now }); await worker.processBatch(); await worker.processBatch();
    expect(s.uow.snapshot().notifications.filter((n) => n.type === "appointment.prepare")).toHaveLength(2);
    expect((await s.assignments.transitionAssignment(identity(mechanic), job.id, { status: "en_route" })).appointment_status).toBe("active");
  });

  it("allows activation exactly at appointment start and rejects overdue activation without dropping reservation", async () => {
    const s = setup("at_home_service"); const booked = await s.offer();
    const job = await s.accept.acceptOffer(identity(mechanic), booked.candidate.id, { estimated_duration_minutes: 60 });
    const state = s.uow.snapshot(); s.tick(appointment);
    expect((await s.assignments.transitionAssignment(identity(mechanic), job.id, { status: "en_route" })).status).toBe("en_route");
    const overdue = new InMemoryUnitOfWork(state);
    await expect(new AssignmentService(overdue, { now: () => new Date(appointment.getTime() + 1) })
      .transitionAssignment(identity(mechanic), job.id, { status: "en_route" })).rejects.toMatchObject({ status: 409 });
    expect(overdue.snapshot().assignments[0]).toMatchObject({ status: "accepted", reservationEndAt: expect.any(Date) });
    await new DispatchWorker(overdue, { now: () => new Date(appointment.getTime() + 1) }).processBatch();
    expect(overdue.snapshot().notifications.some((n) => n.type === "appointment.prepare")).toBe(false);
  });

  it("rejects accepting at the appointment start and releases a canceled scheduled reservation", async () => {
    const s = setup("other"); const booked = await s.offer(); const state = s.uow.snapshot();
    state.dispatchCandidates[0]!.expiresAt = new Date(appointment.getTime() + 60_000);
    await expect(new AcceptAssignmentService(new InMemoryUnitOfWork(state), { now: () => appointment }).acceptOffer(identity(mechanic),
      booked.candidate.id, { estimated_duration_minutes: 60 })).rejects.toMatchObject({ status: 409 });
    await s.accept.acceptOffer(identity(mechanic), booked.candidate.id, { estimated_duration_minutes: 60 });
    await s.requests.cancelServiceRequest(identity(rider), booked.request.id, { reason: "Changed plan" });
    const replacement = await s.offer();
    await expect(s.accept.acceptOffer(identity(mechanic), replacement.candidate.id, { estimated_duration_minutes: 60 })).resolves.toMatchObject({ status: "accepted" });
  });

  it.each(["at_home_service", "other"] as const)("repairs only uncommitted legacy %s bookings with explicit duration and dry-run", async (type) => {
    const s = setup(type); const booked = await s.offer();
    const job = await s.accept.acceptOffer(identity(mechanic), booked.candidate.id, { estimated_duration_minutes: 60 });
    const state = s.uow.snapshot(); state.userRoles.push({ userId: rider, role: "admin" });
    state.assignments[0]!.scheduledStartAt = undefined;
    state.assignments[0]!.reservationStartAt = s.now();
    state.assignments[0]!.reservationEndAt = new Date(s.now().getTime() + 150 * 60_000);
    const legacy = new InMemoryUnitOfWork(state); const admin = new AdminServiceRequestService(legacy, { now: s.now });
    const input = { assignment_id: job.id, estimated_duration_minutes: 60, reason: "Confirm duration with mechanic" };
    expect(() => admin.repairReservation(identity(rider), booked.request.id, { assignment_id: job.id, reason: input.reason }, "repair-key"))
      .toThrowError(expect.objectContaining({ status: 400 }));
    expect(await admin.repairReservation(identity(rider), booked.request.id, input, "repair-key")).toMatchObject({ dry_run: true, repairable: true });
    expect(legacy.snapshot().assignments[0]!.scheduledStartAt).toBeUndefined();
    const repaired = await admin.repairReservation(identity(rider), booked.request.id, { ...input, dry_run: false }, "repair-key");
    expect(await admin.repairReservation(identity(rider), booked.request.id, { ...input, dry_run: false }, "repair-key")).toEqual(repaired);
    expect(legacy.snapshot().assignmentStatusHistory).toEqual(state.assignmentStatusHistory);
    expect(legacy.snapshot().auditLogs.filter((a) => a.action === "admin.service_request.reservation_repaired")).toHaveLength(1);
    const locationless = structuredClone(state); locationless.serviceRequests[0]!.serviceLocation = undefined;
    expect(await new AdminServiceRequestService(new InMemoryUnitOfWork(locationless), { now: s.now })
      .repairReservation(identity(rider), booked.request.id, input, "repair-locationless"))
      .toMatchObject({ repairable: false, reason_code: "location_required" });
    state.assignmentStatusHistory.push({ id: randomUUID(), assignmentId: job.id, toStatus: "en_route", createdAt: s.now() });
    const traveled = new AdminServiceRequestService(new InMemoryUnitOfWork(state), { now: s.now });
    expect(await traveled.repairReservation(identity(rider), booked.request.id, input, "repair-key")).toMatchObject({ repairable: false, reason_code: "travel_already_started" });
  });
  it("refuses legacy location-less offer acceptance and activation without changing workflow", async () => {
    const s = setup("at_home_service"); const booked = await s.offer(); const offered = s.uow.snapshot();
    offered.serviceRequests[0]!.serviceLocation = undefined;
    await expect(new AcceptAssignmentService(new InMemoryUnitOfWork(offered), { now: s.now })
      .acceptOffer(identity(mechanic), booked.candidate.id, { estimated_duration_minutes: 60 })).rejects.toMatchObject({ status: 409 });
    const job = await s.accept.acceptOffer(identity(mechanic), booked.candidate.id, { estimated_duration_minutes: 60 });
    const accepted = s.uow.snapshot(); accepted.serviceRequests[0]!.serviceLocation = undefined;
    const legacy = new InMemoryUnitOfWork(accepted);
    await expect(new AssignmentService(legacy, { now: () => new Date(appointment.getTime() - 30 * 60_000) })
      .transitionAssignment(identity(mechanic), job.id, { status: "en_route" })).rejects.toMatchObject({ status: 409 });
    expect(legacy.snapshot()).toEqual(accepted);
  });

  it("withdraws canceled offers and informs the rider when matching is exhausted", async () => {
    const s = setup(); const canceled = await s.offer();
    await s.requests.cancelServiceRequest(identity(rider), canceled.request.id, { reason: "changed_plan" });
    expect(s.uow.snapshot().notifications.find((n) => n.type === "maintenance.booking.canceled")).toMatchObject({ userId: mechanic });
    await expect(s.accept.acceptOffer(identity(mechanic), canceled.candidate.id, { estimated_duration_minutes: 60 })).rejects.toMatchObject({ status: 409 });
    const pending = await s.offer();
    const worker = new DispatchWorker(s.uow, { now: s.now });
    for (let i = 0; i < 4; i++) { s.tick(new Date(s.now().getTime() + 60_001)); await worker.processBatch(); }
    await worker.processBatch();
    expect(s.uow.snapshot().serviceRequests.find((r) => r.id === pending.request.id)?.status).toBe("manual_escalation");
    expect(s.uow.snapshot().notifications.filter((n) => n.type === "maintenance.booking.needs_support")).toMatchObject([
      { userId: rider, data: { request_id: pending.request.id, status: "manual_escalation" } }
    ]);
    expect(s.uow.snapshot().assignments).toHaveLength(0);
  });

  it("starts matching from durable creation and confirms only after a mechanic accepts with an estimate", async () => {
    const s = setup();
    const request = await s.book();
    expect(request.status).toBe("submitted");
    expect(s.uow.snapshot().assignments).toHaveLength(0);
    const worker = new OutboxWorker(s.uow, { now: s.now, consumers: { handlers: {
      "maintenance.dispatch.requested": async (event) => { await s.dispatch.restartRecoveredRequest(event.aggregateId); },
      "notification.created": async () => ({ notificationStatus: "failed", errorCode: "NO_ACTIVE_DEVICE" })
    } } });
    await worker.processBatch();
    const offer = s.uow.snapshot().dispatchCandidates[0]!;
    expect((await s.dispatch.listMyOffers(identity(mechanic))).items[0]).toMatchObject({
      service_type: "periodic_maintenance", scheduled_start_at: appointment.toISOString(), location
    });
    expect(s.uow.snapshot().serviceRequests[0]?.status).toBe("offered");
    await expect(s.accept.acceptOffer(identity(mechanic), offer.id)).rejects.toMatchObject({ status: 400 });
    const assignment = await s.accept.acceptOffer(identity(mechanic), offer.id, { estimated_duration_minutes: 90 });
    expect(assignment).toMatchObject({ appointment_status: "confirmed", status: "accepted",
      reservation_start_at: "2026-10-03T09:30:00.000Z", reservation_end_at: "2026-10-03T12:00:00.000Z" });
    expect(s.uow.snapshot().notifications.filter((n) => n.type === "maintenance.booking.confirmed")).toHaveLength(1);
    expect(await s.uow.execute(({ assignments }) => assignments.findActiveByMechanicForUpdate(mechanic))).toBeUndefined();
    expect(await s.accept.acceptOffer(identity(mechanic), offer.id, { estimated_duration_minutes: 90 })).toEqual(assignment);
  });

  it.each(["periodic_maintenance", "at_home_service", "other"] as const)("serializes overlapping %s acceptances, permits adjacent buffered windows and preserves the losing offer", async (type) => {
    const s = setup(type);
    const first = await s.offer();
    const overlap = await s.offer(new Date("2026-10-03T11:00:00Z"));
    const results = await Promise.allSettled([first, overlap].map(({ candidate }) =>
      s.accept.acceptOffer(identity(mechanic), candidate.id, { estimated_duration_minutes: 90 })));
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
    expect(s.uow.snapshot().assignments).toHaveLength(1);
    expect(s.uow.snapshot().dispatchCandidates.find((c) => c.id === overlap.candidate.id)?.status).toBe("offered");
    const adjacent = await s.offer(new Date("2026-10-03T12:30:00Z"));
    await s.accept.acceptOffer(identity(mechanic), adjacent.candidate.id, { estimated_duration_minutes: 30 });
    expect(s.uow.snapshot().assignments).toHaveLength(2);
  });

  it.each(["periodic_maintenance", "at_home_service", "other"] as const)("allows unrelated current work for %s, blocks early or busy activation, and starts travel when available", async (type) => {
    const s = setup(type); const booked = await s.offer();
    const appointmentAssignment = await s.accept.acceptOffer(identity(mechanic), booked.candidate.id, { estimated_duration_minutes: 90 });
    if (type === "periodic_maintenance") {
      const labor = await s.quotes.createQuote(identity(mechanic), booked.request.id, {
        assignment_id: appointmentAssignment.id, purpose: "maintenance_labor",
        lines: [{ line_type: "labor", description: "Công bảo dưỡng", quantity: 1, unit_amount: 100_000 }]
      });
      await s.quotes.approveQuote(identity(rider), labor.id);
    }
    await expect(s.assignments.transitionAssignment(identity(mechanic), appointmentAssignment.id, { status: "en_route" })).rejects.toMatchObject({ status: 409 });
    const current = await s.requests.createServiceRequest(identity(rider), {
      motorcycle_id: motorcycle, service_type: "mobile_repair", location, problem_description: "Cần sửa ngay"
    }, randomUUID());
    const round = await s.dispatch.startDispatch(identity(rider), current.id);
    const currentAssignment = await s.accept.acceptOffer(identity(mechanic), round.candidates[0]!.id);
    s.tick(new Date("2026-10-03T09:30:00Z"));
    await expect(s.assignments.transitionAssignment(identity(mechanic), appointmentAssignment.id, { status: "en_route" })).rejects.toMatchObject({ status: 409 });
    await s.assignments.transitionAssignment(identity(mechanic), currentAssignment.id, { status: "canceled" });
    const started = await s.assignments.transitionAssignment(identity(mechanic), appointmentAssignment.id, { status: "en_route" });
    expect(started.appointment_status).toBe("active");
    expect(started.activated_at).toBe(s.now().toISOString());
  });

  it("sends preparation reminders once to both parties at the 30-minute boundary", async () => {
    const s = setup(); const booked = await s.offer();
    await s.accept.acceptOffer(identity(mechanic), booked.candidate.id, { estimated_duration_minutes: 90 });
    const worker = new DispatchWorker(s.uow, { now: s.now });
    s.tick(new Date("2026-10-03T09:29:59Z")); await worker.processBatch();
    expect(s.uow.snapshot().notifications.filter((n) => n.type === "maintenance.appointment.prepare")).toHaveLength(0);
    s.tick(new Date("2026-10-03T09:30:00Z"));
    await Promise.all([worker.processBatch(), worker.processBatch()]);
    const notifications = s.uow.snapshot().notifications.filter((n) => n.type === "maintenance.appointment.prepare");
    expect(notifications.map((n) => n.userId).sort()).toEqual([rider, mechanic].sort());
  });

  it("repairs submitted legacy locations with owner/idempotency checks and rejects edits after matching", async () => {
    const s = setup(); const created = await s.book();
    const state = s.uow.snapshot(); state.serviceRequests[0]!.serviceLocation = undefined;
    const legacy = new InMemoryUnitOfWork(state);
    const service = new ServiceRequestService(legacy, { now: s.now });
    await expect(service.updateAppointment(identity(mechanic), created.id, { location }, "legacy-repair")).rejects.toMatchObject({ status: 403 });
    const repaired = await service.updateAppointment(identity(rider), created.id, { location }, "legacy-repair");
    s.tick(new Date("2026-10-04T09:00:00Z"));
    expect(await service.updateAppointment(identity(rider), created.id, { location }, "legacy-repair")).toEqual(repaired);
    expect(legacy.snapshot().serviceRequests).toHaveLength(1);
    const offered = await s.offer(new Date("2026-10-05T10:00:00Z"));
    await expect(s.requests.updateAppointment(identity(rider), offered.request.id, { location }, randomUUID())).rejects.toMatchObject({ status: 409 });
  });
});
