import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AdminMechanicManagementService } from "@/features/admin/admin-mechanic-management.service";
import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const migrationPath = resolve(
  process.cwd(),
  "..", "..", "supabase", "migrations",
  "202606250016_admin_mechanic_management.sql"
);
const migrationSql = readFileSync(migrationPath, "utf8").toLowerCase();
const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const timeout = 30_000;
const now = new Date("2026-07-06T03:00:00.000Z");
const reason = { reason: "PostgreSQL mechanic administration verification" };

describe("admin mechanic migration", () => {
  it("adds only rejected status and bounded admin/history indexes", () => {
    expect(migrationSql).toContain(
      "alter type mechanic_profile_status add value if not exists 'rejected'"
    );
    expect(migrationSql).toContain(
      "mechanic_profiles_admin_status_available_updated_idx"
    );
    expect(migrationSql).toContain("assignments_mechanic_history_idx");
    expect(migrationSql).not.toMatch(/rating_(?:avg|count)\s*=/);
    expect(migrationSql).not.toMatch(/\bpayment\b/);
  });
});

describeDatabase("admin mechanic management PostgreSQL integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  const authUserIds: string[] = [];
  let adminId: string;
  let pendingId: string;
  let activeId: string;

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, {
      maxConnections: 5
    });
    sql = context.sql;
    await applyAllMigrations(sql);
  }, timeout);

  beforeEach(async () => {
    adminId = randomUUID();
    pendingId = randomUUID();
    activeId = randomUUID();
    authUserIds.push(adminId, pendingId, activeId);
    await seedActor(adminId, "admin");
    await seedActor(pendingId, "mechanic");
    await seedActor(activeId, "mechanic");
    await seedProfile(pendingId, "pending", false, 0, 0);
    await seedProfile(activeId, "active", true, 4.8, 25);
  }, timeout);

  afterAll(async () => {
    if (sql && context) {
      await sql.unsafe(`drop schema if exists "${context.schema}" cascade`);
      if (authUserIds.length > 0) {
        await sql`delete from auth.users where id = any(${authUserIds})`;
      }
    }
    await context?.dispose();
  }, timeout);

  it(
    "persists rejected status and supports bounded admin filters",
    async () => {
      const service = createService();
      await expect(
        service.reject(identity(adminId), pendingId, reason, "pg-reject-key")
      ).resolves.toMatchObject({ profile_status: "rejected" });
      await expect(
        service.listMechanics(identity(adminId), {
          limit: "10",
          profile_status: "rejected"
        })
      ).resolves.toMatchObject({ items: [{ user_id: pendingId }] });

      const enumRows = await sql<{ enumlabel: string }[]>`
        select enumlabel
        from pg_enum enum_value
        join pg_type enum_type on enum_type.oid = enum_value.enumtypid
        join pg_namespace namespace on namespace.oid = enum_type.typnamespace
        where enum_type.typname = 'mechanic_profile_status'
          and namespace.nspname = ${context.schema}
        order by enum_value.enumsortorder
      `;
      expect(enumRows.map((row) => row.enumlabel)).toEqual([
        "pending",
        "active",
        "rejected",
        "suspended",
        "banned"
      ]);
    },
    timeout
  );

  it(
    "replaces skills/radius atomically while preserving trusted ratings",
    async () => {
      const service = createService();
      await service.updateSkills(
        identity(adminId),
        activeId,
        {
          reason: reason.reason,
          service_types: ["emergency_rescue", "periodic_maintenance"]
        },
        "pg-skills-key"
      );
      await service.updateRadius(
        identity(adminId),
        activeId,
        { reason: reason.reason, service_radius_km: 35 },
        "pg-radius-key"
      );
      const [profileRows, skillRows] = await Promise.all([
        sql`
          select service_radius_km::float8, rating_avg::float8, rating_count
          from mechanic_profiles
          where user_id = ${activeId}
        `,
        sql`
          select service_type::text
          from mechanic_skills
          where mechanic_id = ${activeId}
          order by service_type
        `
      ]);
      expect(profileRows).toEqual([
        { service_radius_km: 35, rating_avg: 4.8, rating_count: 25 }
      ]);
      expect(skillRows).toEqual([
        { service_type: "emergency_rescue" },
        { service_type: "periodic_maintenance" }
      ]);
    },
    timeout
  );

  it(
    "rejects status changes with active work and force-unavailable leaves work intact",
    async () => {
      const riderId = randomUUID();
      authUserIds.push(riderId);
      await seedActor(riderId, "rider");
      const assignmentId = await seedActiveAssignment(riderId, activeId);
      const service = createService();

      await expect(
        service.suspend(identity(adminId), activeId, reason, "pg-guard-suspend")
      ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });
      await expect(
        service.ban(identity(adminId), activeId, reason, "pg-guard-ban")
      ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });
      await expect(
        service.forceUnavailable(
          identity(adminId),
          activeId,
          reason,
          "pg-force-unavailable"
        )
      ).resolves.toMatchObject({
        is_available: false,
        work_state: "active_assignment"
      });
      await expect(
        sql`select status from assignments where id = ${assignmentId}`
      ).resolves.toEqual([{ status: "accepted" }]);
      await expect(
        sql`select count(*)::integer as count from assignment_status_history where assignment_id = ${assignmentId}`
      ).resolves.toEqual([{ count: 0 }]);
    },
    timeout
  );

  function createService() {
    return new AdminMechanicManagementService(new PostgresUnitOfWork(sql), {
      now: () => now
    });
  }

  async function seedActor(id: string, role: "admin" | "mechanic" | "rider") {
    await sql`
      insert into auth.users (id, created_at, updated_at)
      values (${id}, now(), now())
    `;
    await sql`
      insert into app_users (id, status, created_at, updated_at)
      values (${id}, 'active', ${now}, ${now})
    `;
    await sql`insert into user_roles (user_id, role) values (${id}, ${role})`;
  }

  async function seedProfile(
    id: string,
    status: "pending" | "active",
    available: boolean,
    ratingAvg: number,
    ratingCount: number
  ) {
    await sql`
      insert into mechanic_profiles (
        user_id, profile_status, is_available, service_radius_km,
        latest_location, location_updated_at, availability_updated_at,
        rating_avg, rating_count, created_at, updated_at
      )
      values (
        ${id}, ${status}, ${available}, 10,
        ST_SetSRID(ST_MakePoint(106.660172, 10.762622), 4326)::geography,
        ${now}, ${now}, ${ratingAvg}, ${ratingCount}, ${now}, ${now}
      )
    `;
    await sql`
      insert into mechanic_skills (mechanic_id, service_type)
      values (${id}, 'mobile_repair')
    `;
  }

  async function seedActiveAssignment(riderId: string, mechanicId: string) {
    const motorcycleId = randomUUID();
    const requestId = randomUUID();
    const roundId = randomUUID();
    const candidateId = randomUUID();
    const assignmentId = randomUUID();
    await sql`
      insert into motorcycles (
        id, rider_id, brand_text, model_text, created_at, updated_at
      )
      values (${motorcycleId}, ${riderId}, 'Honda', 'Wave', ${now}, ${now})
    `;
    await sql`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type,
        problem_description, status, priority, service_location,
        created_at, updated_at
      )
      values (
        ${requestId}, ${`COR-MOB-20260706-${authUserIds.length}`}, ${riderId},
        ${motorcycleId}, 'mobile_repair', 'Integration fixture', 'assigned',
        'normal',
        ST_SetSRID(ST_MakePoint(106.660172, 10.762622), 4326)::geography,
        ${now}, ${now}
      )
    `;
    await sql`
      insert into dispatch_rounds (
        id, request_id, round_number, radius_m, status, started_at,
        expires_at, completed_at
      )
      values (
        ${roundId}, ${requestId}, 1, 2000, 'accepted', ${now},
        ${new Date(now.getTime() + 60_000)}, ${now}
      )
    `;
    await sql`
      insert into dispatch_candidates (
        id, round_id, request_id, mechanic_id, rank, distance_m, status,
        offered_at, expires_at, responded_at, created_at
      )
      values (
        ${candidateId}, ${roundId}, ${requestId}, ${mechanicId}, 1, 20,
        'accepted', ${now}, ${new Date(now.getTime() + 60_000)}, ${now}, ${now}
      )
    `;
    await sql`
      insert into assignments (
        id, request_id, mechanic_id, accepted_candidate_id, status,
        accepted_at, created_at, updated_at
      )
      values (
        ${assignmentId}, ${requestId}, ${mechanicId}, ${candidateId},
        'accepted', ${now}, ${now}, ${now}
      )
    `;
    return assignmentId;
  }
});

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://careonroad.test/auth/v1",
    audience: ["authenticated"]
  };
}

async function applyAllMigrations(sql: Pick<Sql, "unsafe">) {
  const migrationDirectory = resolve(process.cwd(), "..", "..", "supabase", "migrations");
  for (const migrationFile of readdirSync(migrationDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await sql.unsafe(readFileSync(resolve(migrationDirectory, migrationFile), "utf8"));
  }
}
