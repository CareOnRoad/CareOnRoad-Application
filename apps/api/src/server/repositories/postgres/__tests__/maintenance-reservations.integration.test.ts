import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AcceptAssignmentService } from "@/features/assignments/accept-assignment.service";
import { AssignmentService } from "@/features/assignments/assignment.service";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import { AdminUserManagementService } from "@/features/admin/admin-user-management.service";
import { AdminMechanicManagementService } from "@/features/admin/admin-mechanic-management.service";
import { createIsolatedPostgresTestContext, hasPostgresTestDatabase, type IsolatedPostgresTestContext } from "@/server/testing/postgres-test-context";
import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
describeDatabase("maintenance reservation constraints", () => {
  let context: IsolatedPostgresTestContext;
  const rider = randomUUID(); const mechanic = randomUUID(); const motorcycle = randomUUID();
  const now = new Date("2026-10-01T09:00:00Z");
  const identity = (subject: string) => ({ subject, issuer: "test", audience: ["authenticated"] });
  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 4 });
    const directory = resolve(process.cwd(), "../../supabase/migrations");
    for (const file of readdirSync(directory).filter((f) => f.endsWith(".sql")).sort()) {
      await context.sql.unsafe(readFileSync(resolve(directory, file), "utf8"));
    }
    const sql = context.sql;
    for (const [id, role] of [[rider, "rider"], [mechanic, "mechanic"]]) {
      await sql`insert into auth.users (id) values (${id})`;
      await sql`insert into app_users (id, status) values (${id}, 'active')`;
      await sql`insert into user_roles (user_id, role) values (${id}, ${role})`;
    }
    await sql`insert into motorcycles (id, rider_id, brand_text, model_text) values (${motorcycle}, ${rider}, 'Honda', 'Wave')`;
    await sql`insert into mechanic_profiles (user_id, profile_status, is_available, service_radius_km, latest_location, location_updated_at, availability_updated_at)
      values (${mechanic}, 'active', true, 10, ST_SetSRID(ST_MakePoint(106.69, 10.77), 4326)::geography, ${now}, ${now})`;
    await sql`insert into mechanic_skills (mechanic_id, service_type) values (${mechanic}, 'periodic_maintenance')`;
  }, 180_000);
  afterAll(async () => { await context?.dispose({ authUserIds: [rider, mechanic] }); }, 30_000);

  it("serializes overlapping acceptance across connections and enforces the exclusion constraint on direct updates", async () => {
    const uow = new PostgresUnitOfWork(context.sql);
    const requests = new ServiceRequestService(uow, { now: () => now });
    const dispatch = new DispatchService(uow, { now: () => now });
    const accept = new AcceptAssignmentService(uow, { now: () => now });
    async function offer(time: string) {
      const request = await requests.createServiceRequest(identity(rider), { motorcycle_id: motorcycle,
        service_type: "periodic_maintenance", problem_description: "Bảo dưỡng", location: { latitude: 10.77, longitude: 106.69 },
        scheduled_start_at: time }, randomUUID());
      return (await dispatch.startDispatch(identity(rider), request.id)).candidates[0]!.id;
    }
    const first = await offer("2026-10-03T10:00:00Z");
    const second = await offer("2026-10-03T11:00:00Z");
    const results = await Promise.allSettled([first, second].map((id) => accept.acceptOffer(identity(mechanic), id, { estimated_duration_minutes: 90 })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await uow.execute(({ assignments }) => assignments.findActiveByMechanicForUpdate(mechanic))).toBeUndefined();
    const adjacent = await accept.acceptOffer(identity(mechanic), await offer("2026-10-03T15:00:00Z"), { estimated_duration_minutes: 60 });
    await expect(context.sql`update assignments set reservation_start_at = '2026-10-03T09:30:00Z',
      reservation_end_at = '2026-10-03T17:00:00Z' where id = ${adjacent.id}`).rejects.toMatchObject({ code: "23P01" });
    expect((await uow.execute(({ assignments }) => assignments.listVisibleToActor({ id: rider, roles: ["rider", "mechanic"] }))))
      .toHaveLength(2);
    await context.sql`update assignments set created_at = '2026-10-01T08:59:59.000123Z'`;
    const listing = new AssignmentService(uow);
    const page = await listing.listAssignments(identity(rider), { limit: 1, status: "accepted", date_from: "2026-10-01T00:00:00Z" });
    const next = await listing.listAssignments(identity(rider), { limit: 1, cursor: page.page.next_cursor });
    expect(new Set([...page.items, ...next.items].map((item) => item.id)).size).toBe(2);
    expect(next.page.has_more).toBe(false);
    expect((await listing.listAssignments(identity(rider), { status: "completed" })).items).toHaveLength(0);
    expect((await listing.listAssignments(identity(rider), { date_to: "2026-10-01T00:00:00Z" })).items).toHaveLength(0);
    await context.sql`insert into user_roles (user_id, role) values (${rider}, 'admin')`;
    const reason = { reason: "Do not orphan confirmed future appointments" };
    await expect(new AdminUserManagementService(uow).revokeRole(identity(rider), mechanic,
      { ...reason, role: "mechanic" }, "revoke-future-mechanic")).rejects.toMatchObject({ status: 409 });
    await expect(new AdminMechanicManagementService(uow).suspend(identity(rider), mechanic,
      reason, "suspend-future-mechanic")).rejects.toMatchObject({ status: 409 });
  }, 120_000);
});
