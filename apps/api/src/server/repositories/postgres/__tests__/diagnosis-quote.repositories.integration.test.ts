import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { MechanicDiagnosisService } from "@/features/mechanic-diagnosis/mechanic-diagnosis.service";
import { MechanicAssignmentMetadataService } from "@/features/mechanic-operations/mechanic-assignment-metadata.service";
import { QuoteService } from "@/features/quotes/quote.service";
import {
  cleanupPostgresTables,
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = legacyCompatibleMigrationFiles();

describeDatabase("diagnosis and quote repository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let otherRiderId: string;
  let mechanicId: string;
  let otherMechanicId: string;
  let adminId: string;
  let motorcycleId: string;
  let requestId: string;
  let assignmentId: string;
  let now: Date;

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 6 });
    sql = context.sql;
    await applyMigrations(sql);
  }, 30_000);

  beforeEach(async () => {
    now = new Date("2026-06-25T10:00:00.000Z");
    riderId = randomUUID();
    otherRiderId = randomUUID();
    mechanicId = randomUUID();
    otherMechanicId = randomUUID();
    adminId = randomUUID();
    motorcycleId = randomUUID();
    requestId = randomUUID();
    assignmentId = randomUUID();

    await truncateDomainTables();
    await seedActor(riderId, "rider");
    await seedActor(otherRiderId, "rider");
    await seedActor(mechanicId, "mechanic");
    await seedActor(otherMechanicId, "mechanic");
    await seedActor(adminId, "admin");
    await seedMotorcycle();
    await seedRequestAndAssignment();
  }, 30_000);

  afterEach(async () => {
    await truncateDomainTables();
    await sql`
      delete from auth.users
      where id in (${riderId}, ${otherRiderId}, ${mechanicId}, ${otherMechanicId}, ${adminId})
    `;
  }, 30_000);

  afterAll(async () => {
    await context?.dispose();
  }, 30_000);

  it("authorizes diagnosis writes, serializes revisions, and emits sanitized atomic events", async () => {
    const service = new MechanicDiagnosisService(new PostgresUnitOfWork(sql), {
      now: () => now
    });

    await expect(
      service.upsertDiagnosis(identity(otherMechanicId), assignmentId, diagnosisInput("Sai"))
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });

    const created = await service.upsertDiagnosis(
      identity(mechanicId),
      assignmentId,
      diagnosisInput("Bugi mon, tia lua yeu.")
    );
    expect(created.mechanic_id).toBe(mechanicId);

    const revisions = await Promise.all([
      service.upsertDiagnosis(
        identity(mechanicId),
        assignmentId,
        diagnosisInput("Bugi mon, can thay moi.")
      ),
      service.upsertDiagnosis(
        identity(adminId),
        assignmentId,
        diagnosisInput("Bugi mon, da kiem tra lai.")
      )
    ]);
    expect(new Set(revisions.map((item) => item.id))).toEqual(new Set([created.id]));
    await expect(
      sql`select count(*)::int as count from mechanic_diagnoses where assignment_id = ${assignmentId}`
    ).resolves.toEqual([{ count: 1 }]);

    const [auditRows, outboxRows] = await Promise.all([
      sql`select action, metadata from audit_logs where entity_type = 'mechanic_diagnosis'`,
      sql`select topic, payload from outbox_events where aggregate_type = 'mechanic_diagnosis'`
    ]);
    expect(auditRows).toHaveLength(3);
    expect(outboxRows).toHaveLength(3);
    expect(JSON.stringify({ auditRows, outboxRows })).not.toContain("Bugi mon");
  }, 30_000);

  it("allocates immutable quote versions under concurrency and synchronizes rider approval", async () => {
    const diagnosisService = new MechanicDiagnosisService(new PostgresUnitOfWork(sql), {
      now: () => now
    });
    const diagnosis = await diagnosisService.upsertDiagnosis(
      identity(mechanicId),
      assignmentId,
      diagnosisInput("Bugi mon.")
    );
    const quoteService = new QuoteService(new PostgresUnitOfWork(sql), { now: () => now });

    const created = await Promise.all([
      quoteService.createQuote(
        identity(mechanicId),
        requestId,
        quoteInput(assignmentId, diagnosis.id, "Cong kiem tra", 50_000)
      ),
      quoteService.createQuote(
        identity(adminId),
        requestId,
        quoteInput(assignmentId, diagnosis.id, "Cong thay bugi", 70_000)
      )
    ]);
    const ordered = created.sort((left, right) => left.version - right.version);
    expect(ordered.map((quote) => quote.version)).toEqual([1, 2]);
    expect(ordered.map((quote) => quote.status)).toEqual(["pending", "pending"]);
    await expect(
      sql`select version, status from quotes order by version`
    ).resolves.toEqual([
      { version: 1, status: "superseded" },
      { version: 2, status: "pending" }
    ]);
    await expect(
      quoteService.approveQuote(identity(riderId), ordered[0]!.id)
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    await expect(
      quoteService.approveQuote(identity(otherRiderId), ordered[1]!.id)
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });

    const approved = await quoteService.approveQuote(identity(riderId), ordered[1]!.id);
    expect(approved.status).toBe("approved");
    await expect(
      sql`
        select assignment.status as assignment_status, request.status as request_status
        from assignments assignment
        join service_requests request on request.id = assignment.request_id
        where assignment.id = ${assignmentId}
      `
    ).resolves.toEqual([
      {
        assignment_status: "awaiting_payment",
        request_status: "awaiting_payment"
      }
    ]);
    await expect(
      sql`select count(*)::integer as count from payment_orders where quote_id = ${ordered[1]!.id}`
    ).resolves.toEqual([{ count: 0 }]);

    const [auditRows, outboxRows] = await Promise.all([
      sql`select action, metadata from audit_logs where entity_type = 'quote'`,
      sql`select topic, payload from outbox_events where aggregate_type = 'quote'`
    ]);
    expect(auditRows).toHaveLength(3);
    expect(outboxRows).toHaveLength(3);
    expect(JSON.stringify({ auditRows, outboxRows })).not.toContain("Cong ");
    expect(JSON.stringify({ auditRows, outboxRows })).not.toContain("70000");
  }, 120_000);

  it("enforces migration constraints and diagnosis immutability after quote reference", async () => {
    const diagnosisService = new MechanicDiagnosisService(new PostgresUnitOfWork(sql), {
      now: () => now
    });
    const diagnosis = await diagnosisService.upsertDiagnosis(
      identity(mechanicId),
      assignmentId,
      diagnosisInput("Bugi mon.")
    );
    const quote = await new QuoteService(new PostgresUnitOfWork(sql), {
      now: () => now
    }).createQuote(
      identity(mechanicId),
      requestId,
      quoteInput(assignmentId, diagnosis.id, "Cong kiem tra", 50_000)
    );

    await expect(
      diagnosisService.upsertDiagnosis(
        identity(mechanicId),
        assignmentId,
        diagnosisInput("Noi dung sua sau bao gia.")
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    await expect(
      sql`update mechanic_diagnoses set diagnosis_text = 'Direct mutation' where id = ${diagnosis.id}`
    ).rejects.toBeDefined();
    await expect(
      sql`update quotes set total_amount = 1 where id = ${quote.id}`
    ).rejects.toBeDefined();
    await expect(
      sql`
        insert into quote_lines (
          id, quote_id, line_type, description, quantity, unit_amount,
          line_total_amount, sort_order
        )
        values (${randomUUID()}, ${quote.id}, 'part', 'Invalid', 1, -1, -1, 10)
      `
    ).rejects.toBeDefined();
    await expect(
      sql`
        insert into mechanic_diagnoses (
          id, assignment_id, request_id, mechanic_id, diagnosis_text,
          created_at, updated_at
        )
        values (
          ${randomUUID()}, ${assignmentId}, ${requestId}, ${mechanicId},
          'Duplicate', ${now}, ${now}
        )
      `
    ).rejects.toBeDefined();
  }, 30_000);

  it("rolls back supersede and event residue when a new version insert fails", async () => {
    const diagnosis = await new MechanicDiagnosisService(new PostgresUnitOfWork(sql), {
      now: () => now
    }).upsertDiagnosis(identity(mechanicId), assignmentId, diagnosisInput("Bugi mon."));
    const quoteService = new QuoteService(new PostgresUnitOfWork(sql), { now: () => now });
    const first = await quoteService.createQuote(
      identity(mechanicId),
      requestId,
      quoteInput(assignmentId, diagnosis.id, "Cong kiem tra", 50_000)
    );
    const before = await counts();
    const failingService = new QuoteService(new PostgresUnitOfWork(sql), {
      now: () => now,
      createId: () => first.id
    });

    await expect(
      failingService.createQuote(
        identity(mechanicId),
        requestId,
        quoteInput(assignmentId, diagnosis.id, "Cong thay bugi", 70_000)
      )
    ).rejects.toBeDefined();
    await expect(
      sql`select version, status from quotes where request_id = ${requestId}`
    ).resolves.toEqual([{ version: 1, status: "pending" }]);
    await expect(counts()).resolves.toEqual(before);
  }, 30_000);

  it("persists approved rescue labor and protects agreement and pricing from mutation", async () => {
    await sql`update service_requests set service_type = 'emergency_rescue', status = 'assigned' where id = ${requestId}`;
    await sql`update assignments set status = 'accepted' where id = ${assignmentId}`;
    const service = new QuoteService(new PostgresUnitOfWork(sql), { now: () => now });
    const labor = await service.createQuote(identity(mechanicId), requestId, {
      assignment_id: assignmentId, purpose: "rescue_labor",
      labor_pricing: { base_amount: 100000, distance_amount: 20000, weather_amount: 10000, time_amount: 30000, weather: "rain" }
    });
    await service.approveQuote(identity(riderId), labor.id, { payment_timing: "after_repair" });
    await expect(sql`select rescue_labor_quote_id, rescue_payment_timing, status from assignments where id = ${assignmentId}`)
      .resolves.toEqual([{ rescue_labor_quote_id: labor.id, rescue_payment_timing: "after_repair", status: "accepted" }]);
    await expect(sql`update assignments set rescue_payment_timing = 'labor_upfront' where id = ${assignmentId}`).rejects.toBeDefined();
    await expect(sql`update quotes set labor_pricing = '{}'::jsonb where id = ${labor.id}`).rejects.toBeDefined();
  }, 90_000);

  it("persists immutable maintenance labor and binds the completion checklist to approved work", async () => {
    await sql`update service_requests set service_type = 'periodic_maintenance', scheduled_start_at = ${new Date(now.getTime() + 3600_000)}, status = 'assigned' where id = ${requestId}`;
    await sql`update assignments set status = 'accepted' where id = ${assignmentId}`;
    const unitOfWork = new PostgresUnitOfWork(sql);
    const service = new QuoteService(unitOfWork, { now: () => now });
    const labor = await service.createQuote(identity(mechanicId), requestId, {
      assignment_id: assignmentId, purpose: "maintenance_labor",
      lines: [{ line_type: "labor", description: "Cong bao duong", quantity: 1, unit_amount: 100000 }]
    });
    await service.approveQuote(identity(riderId), labor.id);
    await expect(sql`select maintenance_labor_quote_id, status from assignments where id = ${assignmentId}`)
      .resolves.toEqual([{ maintenance_labor_quote_id: labor.id, status: "accepted" }]);
    await expect(sql`update assignments set maintenance_labor_quote_id = null where id = ${assignmentId}`).rejects.toBeDefined();
    await sql`update assignments set status = 'diagnosis' where id = ${assignmentId}`;
    await sql`update service_requests set status = 'in_service' where id = ${requestId}`;
    const work = await service.createQuote(identity(mechanicId), requestId, {
      assignment_id: assignmentId, purpose: "maintenance_work",
      lines: [{ line_type: "part", description: "Dau dong co", quantity: 1, unit_amount: 120000 }]
    });
    await service.approveQuote(identity(riderId), work.id);
    await expect(unitOfWork.execute((repositories) => repositories.quotes.findLatestApprovedByAssignment(assignmentId, "maintenance_work")))
      .resolves.toMatchObject({ id: work.id, totalAmount: 220000 });
    await sql`update assignments set status = 'in_progress' where id = ${assignmentId}`;
    const metadata = new MechanicAssignmentMetadataService(unitOfWork, { now: () => now });
    const checklist = await metadata.submitCompletionChecklist(identity(mechanicId), assignmentId, {
      work_summary: "Da bao duong va thay dau theo bao gia duyet.",
      safety_checklist: { test_ride_completed: true, tools_removed: true, area_safe: true, rider_briefed: true, no_fluid_leak: true }
    }, "maintenance-persisted-checklist");
    expect(checklist.approved_quote_id).toBe(work.id);
    await expect(metadata.getCompletionChecklist(identity(riderId), assignmentId))
      .resolves.toMatchObject({ id: checklist.id, approved_quote_id: work.id });
    await expect(sql`select approved_quote_id from assignment_completion_checklists where id = ${checklist.id}`)
      .resolves.toEqual([{ approved_quote_id: work.id }]);
    await expect(sql`update quotes set total_amount = 1 where id = ${work.id}`).rejects.toBeDefined();
  }, 120_000);

  it("releases rejected rescue assignments with a cancellation timestamp and durable redispatch event", async () => {
    await sql`update service_requests set service_type = 'emergency_rescue', status = 'assigned' where id = ${requestId}`;
    await sql`update assignments set status = 'accepted' where id = ${assignmentId}`;
    const service = new QuoteService(new PostgresUnitOfWork(sql), { now: () => now });
    const labor = await service.createQuote(identity(mechanicId), requestId, {
      assignment_id: assignmentId, purpose: "rescue_labor",
      labor_pricing: { base_amount: 100000, distance_amount: 0, weather_amount: 0, time_amount: 0, weather: "sunny" }
    });
    await service.rejectQuote(identity(riderId), labor.id);
    await expect(sql`select status, canceled_at from assignments where id = ${assignmentId}`)
      .resolves.toEqual([{ status: "recovery_canceled", canceled_at: now }]);
    await expect(sql`select status from service_requests where id = ${requestId}`).resolves.toEqual([{ status: "submitted" }]);
    await expect(sql`select count(*)::int as count from outbox_events where topic = 'assignment.recovery.requested'`).resolves.toEqual([{ count: 1 }]);
  }, 90_000);

  async function seedActor(id: string, role: "rider" | "mechanic" | "admin") {
    await sql`insert into auth.users (id, created_at, updated_at) values (${id}, now(), now())`;
    await sql`
      insert into app_users (id, status, created_at, updated_at)
      values (${id}, 'active', ${now}, ${now})
    `;
    await sql`insert into user_roles (user_id, role) values (${id}, ${role})`;
    if (role === "mechanic") {
      await sql`
        insert into mechanic_profiles (
          user_id, profile_status, is_available, service_radius_km,
          availability_updated_at, rating_avg, rating_count, created_at, updated_at
        )
        values (${id}, 'active', true, 20, ${now}, 0, 0, ${now}, ${now})
      `;
    }
  }

  async function truncateDomainTables() {
    await cleanupPostgresTables(
      sql,
      [
        "quote_lines",
        "quotes",
        "mechanic_diagnoses",
        "assignment_status_history",
        "assignments",
        "dispatch_candidates",
        "dispatch_rounds",
        "request_status_history",
        "service_requests",
        "daily_request_sequences",
        "motorcycles",
        "mechanic_skills",
        "mechanic_profiles",
        "user_devices",
        "user_roles",
        "app_users",
        "audit_logs",
        "outbox_events",
        "idempotency_records"
      ],
      { resetAppendOnlyAuditLogs: true }
    );
  }

  async function seedMotorcycle() {
    await sql`
      insert into motorcycles (
        id, rider_id, brand_text, model_text, created_at, updated_at
      )
      values (${motorcycleId}, ${riderId}, 'Honda', 'Wave', ${now}, ${now})
    `;
  }

  async function seedRequestAndAssignment() {
    const roundId = randomUUID();
    const candidateId = randomUUID();
    await sql`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type,
        problem_description, status, priority, service_location,
        created_at, updated_at
      )
      values (
        ${requestId}, 'COR-MOB-20260625-1', ${riderId}, ${motorcycleId},
        'mobile_repair', 'Xe kho no', 'in_service', 'normal',
        ST_SetSRID(ST_MakePoint(106.660172, 10.762622), 4326)::geography,
        ${now}, ${now}
      )
    `;
    await sql`
      insert into dispatch_rounds (
        id, request_id, round_number, radius_m, status, started_at, expires_at
      )
      values (
        ${roundId}, ${requestId}, 1, 2000, 'accepted', ${now},
        ${new Date(now.getTime() + 60_000)}
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
        'diagnosis', ${now}, ${now}, ${now}
      )
    `;
  }

  async function counts() {
    return sql`
      select
        (select count(*)::int from quotes) as quotes,
        (select count(*)::int from quote_lines) as quote_lines,
        (select count(*)::int from assignment_status_history) as assignment_history,
        (select count(*)::int from request_status_history) as request_history,
        (select count(*)::int from audit_logs) as audit,
        (select count(*)::int from outbox_events) as outbox
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
    .filter((name) => name.endsWith(".sql")).sort();
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://integration-test.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}

function diagnosisInput(diagnosisText: string) {
  return {
    diagnosis_text: diagnosisText,
    recommended_work_text: "Thay bugi neu can.",
    safety_notes: "Tat may truoc khi thao."
  };
}

function quoteInput(
  assignmentId: string,
  diagnosisId: string,
  description: string,
  unitAmount: number
) {
  return {
    assignment_id: assignmentId,
    diagnosis_id: diagnosisId,
    lines: [
      {
        line_type: "labor",
        description,
        quantity: 1,
        unit_amount: unitAmount
      }
    ]
  };
}
