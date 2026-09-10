import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import {
  cleanupPostgresTables,
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = legacyCompatibleMigrationFiles();

describeDatabase("service request repositories integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let otherRiderId: string;
  let motorcycleId: string;
  let otherMotorcycleId: string;
  let riderIdentity: VerifiedSupabaseIdentity;
  let otherRiderIdentity: VerifiedSupabaseIdentity;

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext();
    sql = context.sql;
    riderId = randomUUID();
    otherRiderId = randomUUID();
    motorcycleId = randomUUID();
    otherMotorcycleId = randomUUID();
    riderIdentity = identity(riderId);
    otherRiderIdentity = identity(otherRiderId);
    await sql`
      insert into auth.users (id, created_at, updated_at)
      values
        (${riderId}, now(), now()),
        (${otherRiderId}, now(), now())
    `;
    await applyMigrations(sql);
  }, 120_000);

  beforeEach(async () => {
    await cleanupPostgresTables(
      sql,
      [
        "request_status_history",
        "request_media_metadata",
        "service_requests",
        "daily_request_sequences",
        "motorcycles",
        "user_devices",
        "user_roles",
        "app_users",
        "audit_logs",
        "outbox_events",
        "idempotency_records"
      ],
      { resetAppendOnlyAuditLogs: true }
    );
    await seedRider(riderId);
    await seedRider(otherRiderId);
    await seedMotorcycle(motorcycleId, riderId);
    await seedMotorcycle(otherMotorcycleId, otherRiderId);
  }, 120_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: [riderId, otherRiderId] });
  }, 120_000);

  it("allocates request codes concurrently with monotonic daily sequences", async () => {
    const service = new ServiceRequestService(new PostgresUnitOfWork(sql), {
      now: () => new Date("2026-06-25T18:00:00Z")
    });

    const requests = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        service.createServiceRequest(
          riderIdentity,
          validInput({ problem_description: `Xe can ho tro ${index}` }),
          `concurrent-${index}`
        )
      )
    );

    expect(new Set(requests.map((request) => request.request_code)).size).toBe(8);
    expect(requests.map((request) => request.request_code).sort()).toEqual(
      Array.from({ length: 8 }, (_, index) => `COR-MOB-20260626-${index + 1}`).sort()
    );
  }, 120_000);

  it("persists valid Patch 3 matrix cases, media metadata, idempotency, ownership, and conflicts", async () => {
    const service = new ServiceRequestService(new PostgresUnitOfWork(sql), {
      now: () => new Date("2026-06-25T07:00:00Z")
    });
    const cases = [
      {
        service_type: "emergency_rescue",
        location: { latitude: 10.762622, longitude: 106.660172 }
      },
      { service_type: "mobile_repair", address_text: "1 Nguyen Trai" },
      {
        service_type: "at_home_service",
        address_text: "1 Nguyen Trai",
        scheduled_start_at: "2026-06-26T07:00:00.000Z"
      },
      {
        service_type: "periodic_maintenance",
        scheduled_start_at: "2026-06-26T07:00:00.000Z"
      },
      {
        service_type: "other",
        fulfillment_mode: "immediate_location",
        address_text: "1 Nguyen Trai"
      },
      {
        service_type: "other",
        fulfillment_mode: "scheduled_visit",
        address_text: "1 Nguyen Trai",
        scheduled_start_at: "2026-06-26T07:00:00.000Z"
      }
    ] as const;

    const created = [];
    for (const [index, input] of cases.entries()) {
      created.push(
        await service.createServiceRequest(
          riderIdentity,
          validInput({ ...input, problem_description: `Private integration note ${index}` }),
          `matrix-${index}`
        )
      );
    }
    expect(created).toHaveLength(6);
    expect(created.find((request) => request.service_type === "other")?.priority).toBe("normal");

    const replay = await service.createServiceRequest(
      riderIdentity,
      validInput({ service_type: "mobile_repair", address_text: "1 Nguyen Trai" }),
      "replay-key"
    );
    await expect(
      service.createServiceRequest(
        riderIdentity,
        validInput({ service_type: "mobile_repair", address_text: "1 Nguyen Trai" }),
        "replay-key"
      )
    ).resolves.toEqual(replay);
    await expect(
      service.createServiceRequest(
        riderIdentity,
        validInput({ service_type: "mobile_repair", address_text: "2 Nguyen Trai" }),
        "replay-key"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });

    await expect(
      service.createServiceRequest(
        riderIdentity,
        validInput({
          service_type: "mobile_repair",
          fulfillment_mode: "immediate_location",
          address_text: "1 Nguyen Trai"
        }),
        "invalid-fulfillment"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.createServiceRequest(
        riderIdentity,
        validInput({
          service_type: "periodic_maintenance",
          scheduled_start_at: "2026-06-24T07:00:00.000Z"
        }),
        "past-maintenance"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });

    await expect(
      service.getServiceRequest(otherRiderIdentity, created[0]!.id)
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });

    await expect(
      service.addMediaMetadata(riderIdentity, created[0]!.id, {
        media_type: "image",
        object_reference: "requests/private.jpg",
        content_type: "image/jpeg",
        size_bytes: 42
      })
    ).resolves.toMatchObject({ request_id: created[0]!.id, size_bytes: 42 });

    const canceled = await service.cancelServiceRequest(riderIdentity, created[0]!.id, {
      reason: "Khong can nua"
    });
    expect(canceled.status).toBe("canceled");
    await expect(
      service.cancelServiceRequest(riderIdentity, created[0]!.id, { reason: "Huy tiep" })
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });

    const [domainRows, mediaRows, historyRows, outboxRows, auditRows, reminderColumns] =
      await Promise.all([
        sql`select id from service_requests`,
        sql`select id from request_media_metadata`,
        sql`select to_status from request_status_history`,
        sql`select topic, payload from outbox_events order by created_at`,
        sql`select action, metadata from audit_logs order by created_at`,
        sql`
          select column_name
          from information_schema.columns
          where table_schema = ${context.schema}
            and table_name = 'service_requests'
            and column_name in ('reminder_id', 'reminder_context_id')
        `
      ]);
    expect(domainRows.length).toBeGreaterThanOrEqual(7);
    expect(mediaRows).toHaveLength(1);
    expect(historyRows.length).toBeGreaterThanOrEqual(8);
    expect(outboxRows.length).toBeGreaterThanOrEqual(9);
    expect(auditRows.length).toBeGreaterThanOrEqual(9);
    expect(reminderColumns.map((row) => row.column_name).sort()).toEqual([
      "reminder_context_id",
      "reminder_id"
    ]);
    expect(JSON.stringify({ outboxRows, auditRows })).not.toContain("Private integration note");
    expect(JSON.stringify({ outboxRows, auditRows })).not.toContain("requests/private.jpg");
  }, 120_000);

  it("rolls creation back when required outbox write conflicts", async () => {
    const requestId = randomUUID();
    const occurrenceId = randomUUID();
    await sql`
      insert into outbox_events (
        id, topic, aggregate_type, aggregate_id, dedupe_key, payload
      )
      values (
        ${randomUUID()},
        'service_request.created',
        'service_request',
        ${requestId},
        ${`service_request.created:${requestId}:${occurrenceId}`},
        '{}'::jsonb
      )
    `;
    const [requestsBefore, historyBefore, mediaBefore, outboxBefore, auditBefore, idempotencyBefore] =
      await Promise.all([
        sql`select id from service_requests`,
        sql`select id from request_status_history`,
        sql`select id from request_media_metadata`,
        sql`select id from outbox_events`,
        sql`select id from audit_logs`,
        sql`select id from idempotency_records`
      ]);
    const service = new ServiceRequestService(new PostgresUnitOfWork(sql), {
      now: () => new Date("2026-06-25T09:00:00Z"),
      createId: sequentialIds([randomUUID(), requestId, randomUUID(), occurrenceId, randomUUID()])
    });

    await expect(
      service.createServiceRequest(
        riderIdentity,
        validInput({ service_type: "mobile_repair", address_text: "1 Nguyen Trai" }),
        "rollback-key"
      )
    ).rejects.toBeDefined();

    await expect(sql`select id from service_requests`).resolves.toHaveLength(requestsBefore.length);
    await expect(sql`select id from request_status_history`).resolves.toHaveLength(
      historyBefore.length
    );
    await expect(sql`select id from request_media_metadata`).resolves.toHaveLength(mediaBefore.length);
    await expect(sql`select id from outbox_events`).resolves.toHaveLength(outboxBefore.length);
    await expect(sql`select id from audit_logs`).resolves.toHaveLength(auditBefore.length);
    await expect(sql`select id from idempotency_records`).resolves.toHaveLength(
      idempotencyBefore.length
    );
  }, 120_000);

  async function seedRider(userId: string) {
    await sql`
      insert into app_users (id, status, created_at, updated_at)
      values (${userId}, 'active', now(), now())
    `;
    await sql`
      insert into user_roles (user_id, role)
      values (${userId}, 'rider')
    `;
  }

  async function seedMotorcycle(id: string, ownerId: string) {
    await sql`
      insert into motorcycles (id, rider_id, brand_text, model_text, created_at, updated_at)
      values (${id}, ${ownerId}, 'Honda', 'Wave', now(), now())
    `;
  }

  function validInput(overrides: Record<string, unknown>) {
    return {
      motorcycle_id: motorcycleId,
      service_type: "mobile_repair",
      problem_description: "Xe can ho tro",
      address_text: "1 Nguyen Trai",
      ...overrides
    };
  }
}, 120_000);

async function applyMigrations(sql: Pick<Sql, "unsafe">): Promise<void> {
  for (const migrationFile of migrationFiles) {
    await sql.unsafe(
      readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8")
    );
  }
}

function legacyCompatibleMigrationFiles(): string[] {
  const files = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
    .filter(
      (name) => name.endsWith(".sql") && name.localeCompare("202606250014") < 0
    )
    .sort();
  return [...files, "202606250021_dispatch_round_leases.sql"];
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
