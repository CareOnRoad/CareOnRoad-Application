import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AssignmentRecoveryService } from "@/features/assignments/assignment-recovery.service";
import { AssignmentService } from "@/features/assignments/assignment.service";
import { AdminServiceRequestService } from "@/features/admin/admin-service-request.service";
import { QuoteService } from "@/features/quotes/quote.service";
import { PaymentService } from "@/features/payments/payment.service";
import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import type { PaymentProviderClient } from "@/features/payments/payment-provider";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import {
  createIsolatedPostgresTestContext,
  cleanupPostgresTables,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

describeDatabase("assignment recovery repository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let mechanicId: string;
  let adminId: string;
  let assignmentId: string;
  let requestId: string;
  const authIds = new Set<string>();
  const now = new Date("2026-08-23T04:00:00.000Z");

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 10 });
    sql = context.sql;
    for (const migrationFile of migrationFiles) {
      await sql.unsafe(readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8"));
    }
  }, 120_000);

  beforeEach(async () => {
    await cleanupPostgresTables(sql, ["app_users", "audit_logs", "outbox_events", "idempotency_records", "payment_events"], { resetAppendOnlyTables: true });
    riderId = randomUUID();
    mechanicId = randomUUID();
    adminId = randomUUID();
    for (const [id, role] of [[riderId, "rider"], [mechanicId, "mechanic"], [adminId, "admin"]] as const) {
      authIds.add(id);
      await sql`insert into auth.users (id, created_at, updated_at) values (${id}, now(), now())`;
      await sql`insert into app_users (id, status) values (${id}, 'active')`;
      await sql`insert into user_roles (user_id, role) values (${id}, ${role})`;
    }
    await sql`
      insert into mechanic_profiles (
        user_id, profile_status, is_available, service_radius_km,
        availability_updated_at, rating_avg, rating_count
      ) values (${mechanicId}, 'active', true, 10, ${now}, 0, 0)
    `;
    const motorcycleId = randomUUID();
    requestId = randomUUID();
    const roundId = randomUUID();
    const candidateId = randomUUID();
    assignmentId = randomUUID();
    await sql`insert into motorcycles (id, rider_id, brand_text, model_text) values (${motorcycleId}, ${riderId}, 'Honda', 'Wave')`;
    await sql`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type,
        problem_description, address_text, service_location, status, priority, created_at, updated_at
      ) values (
        ${requestId}, 'COR-MOB-20260823-901', ${riderId}, ${motorcycleId},
        'mobile_repair', 'private', '1 Nguyen Trai', st_setsrid(st_makepoint(106.66, 10.76), 4326)::geography, 'assigned', 'normal', ${now}, ${now}
      )
    `;
    await sql`
      insert into dispatch_rounds (id, request_id, round_number, radius_m, status, started_at, expires_at, completed_at)
      values (${roundId}, ${requestId}, 1, 2000, 'accepted', ${now}, ${new Date(now.getTime() + 60_000)}, ${now})
    `;
    await sql`
      insert into dispatch_candidates (
        id, round_id, request_id, mechanic_id, rank, status, offered_at, expires_at, responded_at, created_at
      ) values (
        ${candidateId}, ${roundId}, ${requestId}, ${mechanicId}, 1, 'accepted',
        ${now}, ${new Date(now.getTime() + 60_000)}, ${now}, ${now}
      )
    `;
    await sql`
      insert into assignments (
        id, request_id, mechanic_id, accepted_candidate_id, status, accepted_at, created_at, updated_at
      ) values (${assignmentId}, ${requestId}, ${mechanicId}, ${candidateId}, 'accepted', ${now}, ${now}, ${now})
    `;
  }, 120_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: [...authIds] });
  }, 30_000);

  it("serializes competing recovery commands and releases active uniqueness", async () => {
    const service = new AssignmentRecoveryService(new PostgresUnitOfWork(sql), { now: () => now });
    const identity = { subject: adminId, issuer: "test", audience: ["authenticated"] };
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, index) =>
      service.recover(identity, assignmentId, { reason_code: "no_show" }, `postgres-recovery-${index}`)
    ));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [assignments, requests, events] = await Promise.all([
      sql`select status, canceled_at from assignments where id = ${assignmentId}`,
      sql`select status from service_requests where id = ${requestId}`,
      sql`select topic, payload from outbox_events where topic = 'assignment.recovery.requested'`
    ]);
    expect(assignments).toMatchObject([{ status: "recovery_canceled" }]);
    expect(requests).toMatchObject([{ status: "submitted" }]);
    expect(events).toHaveLength(1);
  }, 90_000);

  it("serializes quote approval against cancel and recover without discarding issued work", async () => {
    const quoteId = await seedQuote("pending");
    await sql`update assignments set status = 'quoted' where id = ${assignmentId}`;
    await sql`update service_requests set status = 'awaiting_quote_approval' where id = ${requestId}`;
    const unit = new PostgresUnitOfWork(sql);
    const outcomes = await Promise.allSettled([
      new QuoteService(unit, { now: () => now }).approveQuote(identity(riderId), quoteId),
      new AssignmentService(unit, { now: () => now }).transitionAssignment(identity(mechanicId), assignmentId, { status: "canceled" }),
      new AssignmentRecoveryService(unit, { now: () => now }).recover(identity(mechanicId), assignmentId, { reason_code: "cannot_continue" }, "approve-recover-sql")
    ]);
    expect(outcomes[0].status).toBe("fulfilled");
    for (const outcome of outcomes.slice(1)) expect(outcome).toMatchObject({ status: "rejected", reason: { status: 409 } });
    expect(await sql`select status from assignments where id = ${assignmentId}`).toEqual([{ status: "awaiting_payment" }]);
    expect(await sql`select status from service_requests where id = ${requestId}`).toEqual([{ status: "awaiting_payment" }]);
    expect(await sql`select * from outbox_events where topic = 'assignment.recovery.requested'`).toHaveLength(0);
  });

  it("serializes payment success with cancel/recover, deduplicates delivery, and keeps the payment on its assignment", async () => {
    const quoteId = await seedQuote("approved");
    await sql`update assignments set status = 'awaiting_payment' where id = ${assignmentId}`;
    await sql`update service_requests set status = 'awaiting_payment' where id = ${requestId}`;
    const unit = new PostgresUnitOfWork(sql);
    const order = await unit.execute(({ payments }) => payments.create({ id: randomUUID(), quoteId, requestId, assignmentId, riderId,
      providerOrderCode: 991, status: "pending", amount: 100000, description: "COR991", createdAt: now, updatedAt: now }));
    const provider: PaymentProviderClient = {
      createPaymentLink: vi.fn(), cancelPaymentLink: vi.fn(), getPaymentStatus: vi.fn(),
      verifyWebhookPayload: () => ({ kind: "valid", eventDedupeKey: "payment-concurrent-sql", success: true,
        orderCode: 991, amount: 100000, currency: "VND", status: "00" })
    };
    const payment = new PaymentService(unit, { now: () => now, providerFactory: () => provider,
      returnUrl: () => "https://example.test/return", cancelUrl: () => "https://example.test/cancel" });
    const outcomes = await Promise.allSettled([
      payment.handlePayosWebhook({}), payment.handlePayosWebhook({}),
      new AssignmentService(unit).transitionAssignment(identity(mechanicId), assignmentId, { status: "canceled" }),
      new AssignmentRecoveryService(unit).recover(identity(mechanicId), assignmentId, { reason_code: "cannot_continue" }, "paid-recover-sql")
    ]);
    expect(outcomes.slice(0, 2).map((item) => item.status)).toEqual(["fulfilled", "fulfilled"]);
    for (const outcome of outcomes.slice(2)) expect(outcome).toMatchObject({ status: "rejected", reason: { status: 409 } });
    expect(await sql`select status, assignment_id from payment_orders where id = ${order.id}`).toEqual([{ status: "succeeded", assignment_id: assignmentId }]);
    expect(await sql`select * from payment_events`).toHaveLength(1);
    expect(await sql`select * from outbox_events where topic = 'payment.succeeded'`).toHaveLength(1);
    expect(await sql`select * from outbox_events where topic = 'assignment.recovery.requested'`).toHaveLength(0);
    expect(provider.getPaymentStatus).not.toHaveBeenCalled();
  });

  it("rolls SQL history and dispatch back when request synchronization fails", async () => {
    const unit = new PostgresUnitOfWork(sql);
    const wrapper: UnitOfWork = { execute: (work) => unit.execute((repos) => {
      vi.spyOn(repos.serviceRequests, "updateStatus").mockResolvedValue(undefined);
      return work(repos);
    }) };
    await expect(new AssignmentService(wrapper).transitionAssignment(identity(mechanicId), assignmentId, { status: "canceled" }))
      .rejects.toMatchObject({ status: 409, details: { reason_code: "request_missing" } });
    expect(await sql`select status from assignments where id = ${assignmentId}`).toEqual([{ status: "accepted" }]);
    for (const table of ["assignment_status_history", "request_status_history", "audit_logs", "outbox_events"]) {
      expect(await sql.unsafe(`select count(*)::int as count from ${table}`)).toEqual([{ count: 0 }]);
    }
  });

  it("holds a late receipt on old canceled work for review while cancellation competes under the request lock", async () => {
    const quoteId = await seedQuote("approved");
    await sql`update assignments set status = 'canceled', canceled_at = ${now} where id = ${assignmentId}`;
    await sql`update service_requests set status = 'submitted' where id = ${requestId}`;
    const unit = new PostgresUnitOfWork(sql);
    const order = await unit.execute(({ payments }) => payments.create({ id: randomUUID(), quoteId, requestId, assignmentId, riderId,
      providerOrderCode: 992, status: "failed", amount: 100000, description: "COR992", createdAt: now, updatedAt: now }));
    const provider: PaymentProviderClient = { createPaymentLink: vi.fn(), cancelPaymentLink: vi.fn(), getPaymentStatus: vi.fn(),
      verifyWebhookPayload: () => ({ kind: "valid", eventDedupeKey: "late-payment-sql", success: true, orderCode: 992, amount: 100000, currency: "VND", status: "00" }) };
    const payment = new PaymentService(unit, { now: () => now, providerFactory: () => provider,
      returnUrl: () => "https://example.test/return", cancelUrl: () => "https://example.test/cancel" });
    const outcomes = await Promise.allSettled([
      new ServiceRequestService(unit).cancelServiceRequest(identity(riderId), requestId, { reason: "Cancel old failed job" }),
      payment.handlePayosWebhook({})
    ]);
    expect(outcomes[1]).toMatchObject({ status: "fulfilled", value: { status: "needs_review" } });
    expect(await sql`select status, review_reason from payment_orders where id = ${order.id}`)
      .toEqual([{ status: "needs_review", review_reason: "paid_for_inactive_workflow" }]);
    expect(await sql`select status from assignments where id = ${assignmentId}`).toEqual([{ status: "canceled" }]);
    expect(await sql`select * from outbox_events where topic = 'assignment.recovery.requested'`).toHaveLength(0);
  });

  it("previews and executes a proved SQL legacy cancellation with one audited replay", async () => {
    const unit = new PostgresUnitOfWork(sql);
    await unit.execute(async ({ assignments }) => {
      await assignments.updateStatus({ id: assignmentId, status: "canceled", canceledAt: now, updatedAt: now });
      await assignments.appendStatusHistory({ id: randomUUID(), assignmentId, fromStatus: "accepted", toStatus: "canceled", actorId: mechanicId, actorRole: "mechanic", createdAt: now });
    });
    const service = new AdminServiceRequestService(unit, { now: () => now });
    const input = { assignment_id: assignmentId, reason: "Verified legacy history repair" };
    expect(await service.repairCancellation(identity(adminId), requestId, input, "sql-repair-preview"))
      .toMatchObject({ dry_run: true, repairable: true, status: "assigned" });
    expect(await sql`select * from audit_logs`).toHaveLength(0);
    const args = [identity(adminId), requestId, { ...input, dry_run: false }, "sql-repair-commit"] as const;
    expect(await service.repairCancellation(...args)).toEqual(await service.repairCancellation(...args));
    expect(await sql`select status from service_requests where id = ${requestId}`).toEqual([{ status: "canceled" }]);
    expect(await sql`select * from audit_logs`).toHaveLength(1);
    expect(await sql`select * from request_status_history`).toHaveLength(1);
  });

  function identity(subject: string) { return { subject, issuer: "test", audience: ["authenticated"] }; }
  async function seedQuote(status: "pending" | "approved") {
    const quoteId = randomUUID();
    await new PostgresUnitOfWork(sql).execute(({ quotes }) => quotes.create({ id: quoteId, requestId, assignmentId, status, version: 1,
      subtotalAmount: 100000, discountAmount: 0, totalAmount: 100000, createdBy: mechanicId, createdAt: now,
      lines: [{ id: randomUUID(), lineType: "labor", description: "Verified labor", quantity: 1, unitAmount: 100000, lineTotalAmount: 100000, sortOrder: 0 }] }));
    return quoteId;
  }
});
