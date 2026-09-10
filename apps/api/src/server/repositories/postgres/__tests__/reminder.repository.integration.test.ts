import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { ReminderService } from "@/features/reminders/reminder.service";
import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import {
  cleanupPostgresTables,
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";
import { ReminderWorker } from "@/server/workers/reminder.worker";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = legacyCompatibleMigrationFiles();

describeDatabase("reminder repositories integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let otherRiderId: string;
  let motorcycleId: string;
  let riderSecondMotorcycleId: string;
  let otherMotorcycleId: string;
  let riderIdentity: VerifiedSupabaseIdentity;
  let otherRiderIdentity: VerifiedSupabaseIdentity;

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 4 });
    sql = context.sql;
    riderId = randomUUID();
    otherRiderId = randomUUID();
    motorcycleId = randomUUID();
    riderSecondMotorcycleId = randomUUID();
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
  }, 30_000);

  beforeEach(async () => {
    await cleanupPostgresTables(
      sql,
      [
        "reminder_occurrences",
        "reminder_rules",
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
    await seedMotorcycle(riderSecondMotorcycleId, riderId);
    await seedMotorcycle(otherMotorcycleId, otherRiderId);
  }, 30_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: [riderId, otherRiderId] });
  }, 30_000);

  it("deduplicates concurrent worker occurrences and writes sanitized audit/outbox rows", async () => {
    const reminderService = new ReminderService(new PostgresUnitOfWork(sql), {
      now: () => new Date("2026-06-25T03:00:00Z")
    });
    const rule = await reminderService.createReminderRule(riderIdentity, {
      motorcycle_id: motorcycleId,
      title: "Private reminder title",
      interval_days: 30,
      next_due_at: "2026-06-24T03:00:00.000Z",
      enabled: true
    });

    const workers = [
      new ReminderWorker(new PostgresUnitOfWork(sql), {
        now: () => new Date("2026-06-25T03:00:00Z"),
        workerId: "worker-a"
      }),
      new ReminderWorker(new PostgresUnitOfWork(sql), {
        now: () => new Date("2026-06-25T03:00:00Z"),
        workerId: "worker-b"
      })
    ];
    const results = await Promise.all(workers.map((worker) => worker.processDueReminders()));
    expect(results.reduce((sum, result) => sum + result.generated, 0)).toBe(1);

    const [occurrences, outboxRows, auditRows] = await Promise.all([
      sql`select * from reminder_occurrences where rule_id = ${rule.id}`,
      sql`select topic, payload from outbox_events order by created_at, id`,
      sql`select action, metadata from audit_logs order by created_at, id`
    ]);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({ status: "sent" });
    expect(outboxRows.length).toBeGreaterThanOrEqual(3);
    expect(auditRows.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify({ outboxRows, auditRows })).not.toContain("Private reminder title");
  }, 30_000);

  it("creates idempotent reminder-originated service requests and enforces reminder identity", async () => {
    const now = new Date("2026-06-25T03:00:00Z");
    const ruleId = randomUUID();
    const occurrenceId = randomUUID();
    await seedDueOccurrence(ruleId, occurrenceId, riderId, motorcycleId, now);

    const service = new ServiceRequestService(new PostgresUnitOfWork(sql), { now: () => now });
    const input = {
      motorcycle_id: motorcycleId,
      service_type: "periodic_maintenance",
      problem_description: "Bao duong tu reminder",
      reminder_id: ruleId,
      reminder_context_id: occurrenceId
    };
    const created = await service.createServiceRequest(riderIdentity, input, "reminder-create-key");
    expect(created).toMatchObject({
      status: "submitted",
      reminder_id: ruleId,
      reminder_context_id: occurrenceId
    });
    expect(created).not.toHaveProperty("scheduled_start_at");
    await expect(
      service.createServiceRequest(riderIdentity, input, "reminder-create-key")
    ).resolves.toEqual(created);
    await expect(
      service.createServiceRequest(
        riderIdentity,
        { ...input, problem_description: "Payload khac" },
        "reminder-create-key"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });

    const [requests, occurrenceRows, outboxRows, auditRows] = await Promise.all([
      sql`select reminder_id, reminder_context_id from service_requests where id = ${created.id}`,
      sql`select status from reminder_occurrences where id = ${occurrenceId}`,
      sql`select topic, payload from outbox_events order by created_at, id`,
      sql`select action, metadata from audit_logs order by created_at, id`
    ]);
    expect(requests[0]).toMatchObject({
      reminder_id: ruleId,
      reminder_context_id: occurrenceId
    });
    expect(occurrenceRows[0]).toMatchObject({ status: "dismissed" });
    expect(outboxRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows.length).toBeGreaterThanOrEqual(1);

    const futureRuleId = randomUUID();
    const futureOccurrenceId = randomUUID();
    await seedDueOccurrence(
      futureRuleId,
      futureOccurrenceId,
      riderId,
      motorcycleId,
      new Date("2026-06-26T03:00:00Z")
    );
    await expect(
      service.createServiceRequest(
        riderIdentity,
        {
          ...input,
          reminder_id: futureRuleId,
          reminder_context_id: futureOccurrenceId
        },
        "future-context"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });

    await expect(
      service.createServiceRequest(
        otherRiderIdentity,
        {
          ...input,
          motorcycle_id: otherMotorcycleId
        },
        "cross-rider-context"
      )
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      service.createServiceRequest(
        riderIdentity,
        {
          ...input,
          motorcycle_id: riderSecondMotorcycleId
        },
        "motorcycle-mismatch"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  }, 30_000);

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

  async function seedDueOccurrence(
    ruleId: string,
    occurrenceId: string,
    ownerId: string,
    motorcycle: string,
    dueAt: Date
  ) {
    await sql`
      insert into reminder_rules (
        id, rider_id, motorcycle_id, title, next_due_at, enabled, created_at, updated_at
      )
      values (${ruleId}, ${ownerId}, ${motorcycle}, 'Bao duong', ${dueAt}, true, now(), now())
    `;
    await sql`
      insert into reminder_occurrences (
        id, rule_id, rider_id, motorcycle_id, due_at, status, created_at
      )
      values (${occurrenceId}, ${ruleId}, ${ownerId}, ${motorcycle}, ${dueAt}, 'due', ${dueAt})
    `;
  }
}, 30_000);

async function applyMigrations(sql: Pick<Sql, "unsafe">): Promise<void> {
  for (const migrationFile of migrationFiles) {
    await sql.unsafe(
      readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8")
    );
  }
}

function legacyCompatibleMigrationFiles(): string[] {
  return readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
    .filter(
      (name) => name.endsWith(".sql") && name.localeCompare("202606250014") < 0
    )
    .sort();
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://integration-test.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}
