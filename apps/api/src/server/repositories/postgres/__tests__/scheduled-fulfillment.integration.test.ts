import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import { AcceptAssignmentService } from "@/features/assignments/accept-assignment.service";
import { AssignmentService } from "@/features/assignments/assignment.service";
import { AdminServiceRequestService } from "@/features/admin/admin-service-request.service";
import { AdminUserManagementService } from "@/features/admin/admin-user-management.service";
import { MechanicJobListService } from "@/features/mechanic-operations/mechanic-job-list.service";
import { createMechanicOperationsRouteHandlers } from "@/features/mechanic-operations/mechanic-operations.route-handlers";
import { MechanicDashboardService } from "@/features/mechanic-operations/mechanic-dashboard.service";
import { MechanicPerformanceService } from "@/features/mechanic-operations/mechanic-performance.service";
import { cleanupPostgresTables, createIsolatedPostgresTestContext, hasPostgresTestDatabase, type IsolatedPostgresTestContext } from "@/server/testing/postgres-test-context";
import { PostgresUnitOfWork } from "../postgres-unit-of-work";

describe.skipIf(!hasPostgresTestDatabase())("scheduled fulfillment and location guards", () => {
  let context: IsolatedPostgresTestContext;
  const rider = randomUUID(), mechanic = randomUUID(), motorcycle = randomUUID();
  const now = new Date("2026-10-01T09:00:00Z");
  const appointment = new Date("2026-10-03T10:00:00Z");
  const identity = (subject: string) => ({ subject, issuer: "test", audience: ["authenticated"] });
  const location = { latitude: 10.77, longitude: 106.69 };
  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 4 });
    const directory = resolve(process.cwd(), "../../supabase/migrations");
    for (const file of readdirSync(directory).filter((f) => f.endsWith(".sql")).sort()) await context.sql.unsafe(readFileSync(resolve(directory, file), "utf8"));
    for (const id of [rider, mechanic]) await context.sql`insert into auth.users (id) values (${id})`;
  }, 180_000);
  beforeEach(async () => {
    const sql = context.sql;
    await cleanupPostgresTables(sql, ["app_users", "audit_logs", "outbox_events", "idempotency_records"], { resetAppendOnlyTables: true });
    for (const [id, role] of [[rider, "rider"], [mechanic, "mechanic"]]) {
      await sql`insert into app_users (id, status) values (${id}, 'active')`;
      await sql`insert into user_roles (user_id, role) values (${id}, ${role})`;
    }
    await sql`insert into user_roles (user_id, role) values (${rider}, 'admin')`;
    await sql`insert into motorcycles (id, rider_id, brand_text, model_text) values (${motorcycle}, ${rider}, 'Honda', 'Wave')`;
    await sql`insert into mechanic_profiles (user_id, profile_status, is_available, service_radius_km, latest_location, location_updated_at, availability_updated_at)
      values (${mechanic}, 'active', true, 10, ST_SetSRID(ST_MakePoint(106.69, 10.77), 4326)::geography, ${now}, ${now})`;
    for (const type of ["at_home_service", "other", "mobile_repair"]) await sql`insert into mechanic_skills (mechanic_id, service_type) values (${mechanic}, ${type})`;
  });
  afterAll(async () => { await context?.dispose({ authUserIds: [rider, mechanic] }); }, 30_000);

  function services(time = now) {
    const uow = new PostgresUnitOfWork(context.sql);
    return { uow, requests: new ServiceRequestService(uow, { now: () => time }), dispatch: new DispatchService(uow, { now: () => time }),
      accept: new AcceptAssignmentService(uow, { now: () => time }), assignments: new AssignmentService(uow, { now: () => time }) };
  }
  async function offer(type: "at_home_service" | "other", start = appointment) {
    const s = services();
    const request = await s.requests.createServiceRequest(identity(rider), { motorcycle_id: motorcycle, service_type: type,
      ...(type === "other" ? { fulfillment_mode: "scheduled_visit" } : {}), problem_description: "Cần sửa theo lịch", location,
      address_text: "Địa điểm test", scheduled_start_at: start.toISOString() }, randomUUID());
    return { request, candidate: (await s.dispatch.startDispatch(identity(rider), request.id)).candidates[0]! };
  }

  it.each(["at_home_service", "other"] as const)("serializes %s acceptance and keeps adjacent reservations without consuming current work", async (type) => {
    const s = services(); const first = await offer(type), overlap = await offer(type, new Date(appointment.getTime() + 60 * 60_000));
    const results = await Promise.allSettled([first, overlap].map(({ candidate }) => s.accept.acceptOffer(identity(mechanic), candidate.id, { estimated_duration_minutes: 90 })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await s.uow.execute(({ assignments }) => assignments.findActiveByMechanicForUpdate(mechanic))).toBeUndefined();
    const winner = results.find((r) => r.status === "fulfilled")!;
    if (winner.status !== "fulfilled") throw new Error("winner missing");
    const end = new Date(winner.value.reservation_end_at!);
    const adjacent = await offer(type, new Date(end.getTime() + 30 * 60_000));
    const next = await s.accept.acceptOffer(identity(mechanic), adjacent.candidate.id, { estimated_duration_minutes: 15 });
    expect(next.reservation_start_at).toBe(end.toISOString());
    await expect(context.sql`update assignments set reservation_start_at = ${appointment}, reservation_end_at = ${new Date(appointment.getTime() + 6 * 60 * 60_000)} where id = ${next.id}`)
      .rejects.toMatchObject({ code: "23P01" });
    await s.requests.cancelServiceRequest(identity(rider), winner.value.request_id, { reason: "Cancel before travel" });
    expect(await s.uow.execute(({ assignments }) => assignments.findReservationConflict({ mechanicId: mechanic,
      start: new Date(winner.value.reservation_start_at!), end }))).toBeUndefined();
  });

  it("serializes activation across connections when a previous reservation has ended but work is still active", async () => {
    const first = await offer("at_home_service"), second = await offer("other", new Date(appointment.getTime() + 2 * 60 * 60_000));
    const s = services();
    const one = await s.accept.acceptOffer(identity(mechanic), first.candidate.id, { estimated_duration_minutes: 60 });
    const two = await s.accept.acceptOffer(identity(mechanic), second.candidate.id, { estimated_duration_minutes: 60 });
    const firstTravel = services(new Date(appointment.getTime() - 30 * 60_000));
    await firstTravel.assignments.transitionAssignment(identity(mechanic), one.id, { status: "en_route" });
    const nextWindow = services(new Date(appointment.getTime() + 90 * 60_000));
    await expect(nextWindow.assignments.transitionAssignment(identity(mechanic), two.id, { status: "en_route" })).rejects.toMatchObject({ status: 409 });
    await firstTravel.assignments.transitionAssignment(identity(mechanic), one.id, { status: "canceled" });
    const race = await Promise.allSettled([nextWindow.assignments.transitionAssignment(identity(mechanic), two.id, { status: "en_route" }),
      nextWindow.assignments.transitionAssignment(identity(mechanic), two.id, { status: "en_route" })]);
    expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const histories = await context.sql`select id from assignment_status_history where assignment_id = ${two.id} and to_status = 'en_route'`;
    expect(histories).toHaveLength(1);
  });

  it("blocks location edits racing dispatch and guards new SQL inserts while legacy cancellation remains possible", async () => {
    const s = services();
    const request = await s.requests.createServiceRequest(identity(rider), { motorcycle_id: motorcycle, service_type: "mobile_repair", location,
      problem_description: "Cần sửa xe" }, randomUUID());
    await Promise.allSettled([s.requests.updateAppointment(identity(rider), request.id, { location: { latitude: 10.771, longitude: 106.691 } }, "patch-race"),
      s.dispatch.startDispatch(identity(rider), request.id)]);
    expect((await context.sql`select status from service_requests where id = ${request.id}`)[0].status).toBe("offered");
    await expect(s.requests.updateAppointment(identity(rider), request.id, { location }, "after-round")).rejects.toMatchObject({ status: 409 });
    await expect(context.sql`insert into service_requests (id, request_code, rider_id, motorcycle_id, service_type, problem_description, status, priority)
      values (${randomUUID()}, ${randomUUID()}, ${rider}, ${motorcycle}, 'mobile_repair', 'Legacy', 'submitted', 'normal')`).rejects.toMatchObject({ code: "23514" });
    // This context owns a private test schema; temporarily reproduce an old row, never touch public application data.
    await context.sql.begin(async (tx) => {
      await tx.unsafe("alter table service_requests disable trigger service_requests_location_guard");
      await tx`update service_requests set service_location = null, address_text = 'Legacy address' where id = ${request.id}`;
      await tx.unsafe("alter table service_requests enable trigger service_requests_location_guard");
    });
    await expect(s.requests.cancelServiceRequest(identity(rider), request.id, { reason: "Cancel legacy row" })).resolves.toMatchObject({ status: "canceled" });
  });

  it("backfills a reviewed legacy reservation without rewriting status history and refuses overlap", async () => {
    const s = services(); const booked = await offer("at_home_service");
    const job = await s.accept.acceptOffer(identity(mechanic), booked.candidate.id, { estimated_duration_minutes: 60 });
    await context.sql`update assignments set scheduled_start_at = null, reservation_start_at = ${now}, reservation_end_at = ${new Date(now.getTime() + 150 * 60_000)} where id = ${job.id}`;
    const admin = new AdminServiceRequestService(s.uow, { now: () => now });
    const body = { assignment_id: job.id, estimated_duration_minutes: 60, reason: "Confirmed duration with mechanic" };
    expect(await admin.repairReservation(identity(rider), booked.request.id, body, "repair-preview")).toMatchObject({ dry_run: true, repairable: true });
    const competing = await offer("other"); await s.accept.acceptOffer(identity(mechanic), competing.candidate.id, { estimated_duration_minutes: 60 });
    expect(await admin.repairReservation(identity(rider), booked.request.id, body, "repair-preview")).toMatchObject({ repairable: false, reason_code: "reservation_overlap" });
    await s.requests.cancelServiceRequest(identity(rider), competing.request.id, { reason: "Free reservation" });
    const before = await context.sql`select * from assignment_status_history where assignment_id = ${job.id}`;
    const repaired = await admin.repairReservation(identity(rider), booked.request.id, { ...body, dry_run: false }, "repair-commit");
    expect(await admin.repairReservation(identity(rider), booked.request.id, { ...body, dry_run: false }, "repair-commit")).toEqual(repaired);
    expect(await context.sql`select * from assignment_status_history where assignment_id = ${job.id}`).toEqual(before);
    expect(await s.uow.execute(({ assignments }) => assignments.findActiveByMechanicForUpdate(mechanic))).toBeUndefined();
    expect(await s.uow.execute(({ assignments }) => assignments.listScheduledForPreparation({ now: new Date(appointment.getTime() - 30 * 60_000), limit: 10 }))).toHaveLength(1);
    expect(await s.uow.execute(({ assignments }) => assignments.listScheduledForPreparation({ now: new Date(appointment.getTime() + 1), limit: 10 }))).toEqual([]);
  });

  it("restores owned job detail through a rebuilt route/UoW and redacts private fields and terminal location", async () => {
    const s = services(); const booked = await offer("at_home_service");
    const job = await s.accept.acceptOffer(identity(mechanic), booked.candidate.id, { estimated_duration_minutes: 60 });
    const intentId = randomUUID();
    await s.uow.execute(async (repositories) => {
      await repositories.adminInternalNotes.create({ id: randomUUID(), adminId: rider, serviceRequestId: booked.request.id,
        noteText: "PRIVATE_ADMIN_NOTE", createdAt: now });
      const media = await repositories.requestMedia.create({ id: randomUUID(), requestId: booked.request.id, mediaType: "photo",
        objectReference: "PRIVATE_PATH/photo.jpg", contentType: "image/jpeg", sizeBytes: 10, createdBy: rider, createdAt: now });
      await repositories.mediaUploadIntents.create({ id: intentId, actorId: rider, actorRole: "rider", resourceType: "service_request",
        requestId: booked.request.id, purpose: "request_photo", storageBucket: "private", objectKey: "PRIVATE_PATH/photo.jpg",
        contentType: "image/jpeg", sizeBytes: 10, sha256: "a".repeat(64), expiresAt: new Date(now.getTime() + 60_000), createdAt: now, updatedAt: now });
      await repositories.mediaUploadIntents.markFinalized({ id: intentId, mediaMetadataId: media.id,
        finalizedResponse: { object_reference: "PRIVATE_PATH/photo.jpg" }, finalizedAt: now });
      await repositories.mechanicOperations.createAssignmentCompletionChecklist({ id: randomUUID(), assignmentId: job.id,
        requestId: booked.request.id, mechanicId: mechanic, workSummary: "Đã kiểm tra", safetyChecklist: { testRideCompleted: true,
          toolsRemoved: true, areaSafe: true, riderBriefed: true, noFluidLeak: true }, notes: "PRIVATE_CHECKLIST_NOTE", createdBy: mechanic, createdAt: now });
    });
    const rebuilt = new PostgresUnitOfWork(context.sql);
    const handlers = createMechanicOperationsRouteHandlers({ authenticate: async () => identity(mechanic),
      jobListService: new MechanicJobListService(rebuilt), dashboardService: new MechanicDashboardService(rebuilt),
      performanceService: new MechanicPerformanceService(rebuilt) });
    const response = await handlers.getJob(new Request(`http://localhost/api/v1/mechanics/me/jobs/${job.id}`), job.id);
    expect(response.status).toBe(200);
    const detail = await response.json();
    expect(detail).toMatchObject({ assignment: { scheduled_start_at: appointment.toISOString() }, request: { location },
      motorcycle: { brand_text: "Honda" }, media: { items: [{ upload_intent_id: intentId }] }, completion_checklist: { revision: 1 } });
    expect(JSON.stringify(detail)).not.toMatch(/PRIVATE_|storage_bucket|object_key|finalized_response/);
    await expect(new ServiceRequestService(rebuilt).getServiceRequest(identity(mechanic), booked.request.id)).rejects.toMatchObject({ status: 403 });
    await s.requests.cancelServiceRequest(identity(rider), booked.request.id, { reason: "Cancel before travel" });
    const terminal = await new MechanicJobListService(rebuilt).getJob(identity(mechanic), job.id);
    expect(terminal.sensitive_details_redacted).toBe(true); expect(terminal.request.location).toBeUndefined(); expect(terminal.media.items).toEqual([]);
    await context.sql`insert into user_roles (user_id, role) values (${mechanic}, 'rider')`;
    await new AdminUserManagementService(rebuilt).revokeRole(identity(rider), mechanic,
      { reason: "Revoke after job ends", role: "mechanic" }, "detail-revoke-role");
    await expect(new MechanicJobListService(rebuilt).getJob(identity(mechanic), job.id)).rejects.toMatchObject({ status: 403 });
  });
});
