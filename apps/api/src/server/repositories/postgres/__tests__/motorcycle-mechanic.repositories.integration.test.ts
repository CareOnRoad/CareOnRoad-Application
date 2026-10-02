import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MechanicProfileService } from "@/features/motorcycles/mechanic-profile.service";
import { MotorcycleService } from "@/features/motorcycles/motorcycle.service";
import { AuthService } from "@/features/auth/auth.service";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import {
  cleanupPostgresTables,
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";
import { PostgresMechanicRepository } from "../mechanic.repository";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = sourceMigrationFiles();

describeDatabase("motorcycle and mechanic repositories integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let otherRiderId: string;
  let mechanicId: string;
  let riderIdentity: VerifiedSupabaseIdentity;
  let otherRiderIdentity: VerifiedSupabaseIdentity;
  let mechanicIdentity: VerifiedSupabaseIdentity;

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext();
    sql = context.sql;
    riderId = randomUUID();
    otherRiderId = randomUUID();
    mechanicId = randomUUID();
    await sql`
      insert into auth.users (id, created_at, updated_at)
      values
        (${riderId}, now(), now()),
        (${otherRiderId}, now(), now()),
        (${mechanicId}, now(), now())
    `;
    riderIdentity = identity(riderId);
    otherRiderIdentity = identity(otherRiderId);
    mechanicIdentity = identity(mechanicId);
    await applyMigrations(sql);
  }, 30_000);

  beforeEach(async () => {
    await cleanupPostgresTables(
      sql,
      [
        "mechanic_skills",
        "mechanic_profiles",
        "motorcycles",
        "user_devices",
        "user_roles",
        "app_users",
        "audit_logs",
        "outbox_events",
        "idempotency_records"
      ],
      { resetAppendOnlyTables: true }
    );
  }, 30_000);

  afterAll(async () => {
    await context?.dispose({
      authUserIds: [riderId, otherRiderId, mechanicId]
    });
  }, 30_000);

  it("stores motorcycle ownership and commits mutation audit/outbox atomically", async () => {
    await bootstrapProfile(riderIdentity, "rider");
    await bootstrapProfile(otherRiderIdentity, "rider");
    await cleanupPostgresTables(sql, ["audit_logs", "outbox_events"], {
      resetAppendOnlyTables: true
    });

    const service = new MotorcycleService(new PostgresUnitOfWork(sql), {
      now: () => new Date("2026-06-25T07:00:00Z")
    });
    const motorcycle = await service.createMotorcycle(riderIdentity, {
      brand_text: "Honda",
      model_text: "Wave",
      notes: "Private integration note"
    });

    await expect(service.getMotorcycle(otherRiderIdentity, motorcycle.id)).rejects.toMatchObject({
      status: 403,
      errorCode: "FORBIDDEN"
    });
    await service.updateMotorcycle(riderIdentity, motorcycle.id, {
      brand_text: "Honda",
      model_text: "Future"
    });
    await service.archiveMotorcycle(riderIdentity, motorcycle.id);

    const [domainRows, outboxRows, auditRows] = await Promise.all([
      sql`select id, rider_id, archived_at from motorcycles`,
      sql<{ topic: string; payload: Record<string, unknown> }[]>`
        select topic, payload from outbox_events order by created_at, topic
      `,
      sql<{ action: string; metadata: Record<string, unknown> }[]>`
        select action, metadata from audit_logs order by created_at, action
      `
    ]);
    expect(domainRows).toHaveLength(1);
    expect(domainRows[0]).toMatchObject({ rider_id: riderId });
    expect(outboxRows).toHaveLength(3);
    expect(auditRows).toHaveLength(3);
    expect(JSON.stringify({ outboxRows, auditRows })).not.toContain("Private integration note");
  }, 30_000);

  it("stores mechanic latest location directly with backend timestamps and no location table", async () => {
    await bootstrapProfile(mechanicIdentity, "mechanic");
    await createMechanicProfile();
    await cleanupPostgresTables(sql, ["audit_logs", "outbox_events"], {
      resetAppendOnlyTables: true
    });

    const service = new MechanicProfileService(new PostgresUnitOfWork(sql), {
      now: () => new Date("2026-06-25T08:00:00Z")
    });
    await service.updateMyProfile(mechanicIdentity, {
      service_radius_km: 12,
      service_types: ["emergency_rescue", "mobile_repair"]
    });
    await service.updateAvailability(mechanicIdentity, { is_available: true });
    await service.updateLocation(mechanicIdentity, {
      latitude: 10.762622,
      longitude: 106.660172
    });

    const [profile] = await sql<{
      user_id: string;
      latitude: number | null;
      longitude: number | null;
      location_updated_at: Date | null;
      availability_updated_at: Date;
      rating_avg: string;
      rating_count: number;
    }[]>`
      select
        user_id,
        ST_Y(latest_location::geometry) as latitude,
        ST_X(latest_location::geometry) as longitude,
        location_updated_at,
        availability_updated_at,
        rating_avg::text,
        rating_count
      from mechanic_profiles
      where user_id = ${mechanicId}
    `;
    expect(profile).toMatchObject({
      user_id: mechanicId,
      latitude: 10.762622,
      longitude: 106.660172,
      rating_avg: "0.00",
      rating_count: 0
    });
    expect(profile?.location_updated_at?.toISOString()).toBe("2026-06-25T08:00:00.000Z");
    expect(profile?.availability_updated_at.toISOString()).toBe("2026-06-25T08:00:00.000Z");

    const tableRows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = ${context.schema}
        and table_name = 'mechanic_locations'
    `;
    expect(tableRows).toHaveLength(0);

    const columns = await sql<{ column_name: string }[]>`
      select column_name
      from information_schema.columns
      where table_schema = ${context.schema}
        and table_name = 'mechanic_profiles'
        and column_name in ('active_workload', 'active_job_count')
    `;
    expect(columns).toHaveLength(0);

    const outbox = await sql`select id from outbox_events`;
    const audit = await sql`select id from audit_logs`;
    expect(outbox).toHaveLength(3);
    expect(audit).toHaveLength(3);
  }, 30_000);

  it("enforces rating constraints and keeps rating aggregates service read-only", async () => {
    await bootstrapProfile(mechanicIdentity, "mechanic");
    await createMechanicProfile();

    await expect(
      sql`update mechanic_profiles set rating_avg = 6 where user_id = ${mechanicId}`
    ).rejects.toBeDefined();
    await expect(
      sql`update mechanic_profiles set rating_count = -1 where user_id = ${mechanicId}`
    ).rejects.toBeDefined();

    await expect(
      new MechanicProfileService(new PostgresUnitOfWork(sql)).updateMyProfile(mechanicIdentity, {
        rating_avg: 5
      })
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
  }, 30_000);

  it("uses 300-second location freshness fixtures for dispatch eligibility preparation", async () => {
    await bootstrapProfile(mechanicIdentity, "mechanic");
    await createMechanicProfile();
    const freshBoundary = new Date("2026-06-25T09:00:00Z");
    const staleBoundary = new Date(freshBoundary.getTime() - 300_001);

    await sql`
      update mechanic_profiles
      set
        latest_location = ST_SetSRID(ST_MakePoint(106.660172, 10.762622), 4326)::geography,
        location_updated_at = ${freshBoundary}
      where user_id = ${mechanicId}
    `;
    const freshEligible = await sql`
      select user_id
      from mechanic_profiles
      where location_updated_at >= ${new Date(freshBoundary.getTime() - 300_000)}
    `;
    expect(freshEligible).toHaveLength(1);

    await sql`
      update mechanic_profiles
      set location_updated_at = ${staleBoundary}
      where user_id = ${mechanicId}
    `;
    const staleEligible = await sql`
      select user_id
      from mechanic_profiles
      where location_updated_at >= ${new Date(freshBoundary.getTime() - 300_000)}
    `;
    expect(staleEligible).toHaveLength(0);
  }, 30_000);

  it("rolls motorcycle creation back when a required outbox write conflicts", async () => {
    await bootstrapProfile(riderIdentity, "rider");
    const occurrenceId = "11111111-1111-4111-8111-111111111111";
    await sql`
      insert into outbox_events (
        id, topic, aggregate_type, aggregate_id, dedupe_key, payload
      )
      values (
        ${randomUUID()},
        'motorcycle.created',
        'motorcycle',
        ${occurrenceId},
        ${`motorcycle.created:${occurrenceId}:${occurrenceId}`},
        '{}'::jsonb
      )
    `;
    const [motorcyclesBefore, outboxBefore, auditBefore] = await Promise.all([
      sql`select id from motorcycles`,
      sql`select id from outbox_events`,
      sql`select id from audit_logs`
    ]);
    const service = new MotorcycleService(new PostgresUnitOfWork(sql), {
      createId: sequentialIds([
        occurrenceId,
        occurrenceId,
        "22222222-2222-4222-8222-222222222222"
      ])
    });

    await expect(
      service.createMotorcycle(riderIdentity, {
        brand_text: "Honda",
        model_text: "Wave"
      })
    ).rejects.toBeDefined();

    await expect(sql`select id from motorcycles`).resolves.toHaveLength(
      motorcyclesBefore.length
    );
    await expect(sql`select id from outbox_events`).resolves.toHaveLength(outboxBefore.length);
    await expect(sql`select id from audit_logs`).resolves.toHaveLength(auditBefore.length);
    await expect(
      sql`select id from audit_logs where action = 'motorcycle.created'`
    ).resolves.toHaveLength(0);
  }, 30_000);

  async function bootstrapProfile(identity: VerifiedSupabaseIdentity, role: "rider" | "mechanic") {
    const service = new AuthService(new PostgresUnitOfWork(sql));
    await service.bootstrapProfile(identity, {});
    if (role === "mechanic") {
      await sql`
        insert into user_roles (user_id, role)
        values (${identity.subject}, 'mechanic')
        on conflict do nothing
      `;
    }
  }

  async function createMechanicProfile() {
    await sql.begin(async (transaction) => {
      const repository = new PostgresMechanicRepository(transaction);
      await repository.createProfile({
        userId: mechanicId,
        profileStatus: "active",
        serviceRadiusKm: 5,
        serviceTypes: ["mobile_repair"],
        availabilityUpdatedAt: new Date("2026-06-25T00:00:00Z"),
        createdAt: new Date("2026-06-25T00:00:00Z"),
        updatedAt: new Date("2026-06-25T00:00:00Z")
      });
    });
  }
}, 30_000);

async function applyMigrations(sql: Pick<Sql, "unsafe">): Promise<void> {
  for (const migrationFile of migrationFiles) {
    await sql.unsafe(
      readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8")
    );
  }
}

function sourceMigrationFiles(): string[] {
  return readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://integration-test.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}

function sequentialIds(ids: string[]): () => string {
  return () => {
    const id = ids.shift();
    if (!id) {
      throw new Error("Test ID sequence exhausted.");
    }
    return id;
  };
}
