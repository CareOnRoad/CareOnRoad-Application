import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { QuoteService } from "@/features/quotes/quote.service";
import { AssignmentRecoveryService } from "@/features/assignments/assignment-recovery.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import type { QuotePurpose } from "@/server/repositories/contracts/quote.repository";
import { AdminSupervisionService } from "../admin-supervision.service";
import { AdminAssignmentService } from "../admin-assignment.service";
import { createAdminSupervisionRouteHandlers } from "../admin-supervision.route-handlers";

const now = new Date("2026-10-02T00:00:00Z");
const rider = randomUUID(), admin = randomUUID(), mechanic = randomUUID(), requestId = randomUUID(), assignmentId = randomUUID(), diagnosisId = randomUUID();
const identity = (subject: string) => ({ subject, issuer: "test", audience: ["authenticated"] });
const reason = { reason: "Checked quote and requested a safe correction" };
const line = { line_type: "labor", description: "private work detail", quantity: 1, unit_amount: 100_000 };
function setup(purpose: QuotePurpose = "standard") {
  const labor = purpose.endsWith("labor") || purpose === "rescue_final" || purpose === "maintenance_work";
  const uow = new InMemoryUnitOfWork({ users: [rider, admin, mechanic].map((id) => ({ id, status: "active", createdAt: now, updatedAt: now })),
    userRoles: [{ userId: rider, role: "rider" }, { userId: admin, role: "admin" }, { userId: mechanic, role: "mechanic" }],
    serviceRequests: [{ id: requestId, requestCode: "TEST", riderId: rider, motorcycleId: randomUUID(), serviceType: purpose.startsWith("rescue") ? "emergency_rescue" : purpose.startsWith("maintenance") ? "periodic_maintenance" : "mobile_repair",
      problemDescription: "private request", status: labor ? "assigned" : "in_service", priority: "normal", createdAt: now, updatedAt: now }],
    assignments: [{ id: assignmentId, requestId, mechanicId: mechanic, dispatchDistanceMeters: 50, acceptedCandidateId: randomUUID(), status: labor ? "accepted" : "diagnosis", acceptedAt: now, createdAt: now, updatedAt: now }],
    mechanicDiagnoses: [{ id: diagnosisId, requestId, assignmentId, mechanicId: mechanic, diagnosisText: "private diagnosis", safetyNotes: "private safety", createdAt: now, updatedAt: now }]
  });
  const quotes = new QuoteService(uow, { now: () => now }); const service = new AdminSupervisionService(uow, { now: () => now });
  return { uow, quotes, service };
}
async function issue(purpose: QuotePurpose = "standard") {
  const result = setup(purpose); const { uow, quotes } = result;
  if (purpose === "rescue_final" || purpose === "maintenance_work") {
    const labor = await quotes.createQuote(identity(mechanic), requestId, { assignment_id: assignmentId,
      purpose: purpose === "rescue_final" ? "rescue_labor" : "maintenance_labor",
      ...(purpose === "rescue_final" ? { labor_pricing: { base_amount: 100_000, distance_amount: 0, weather_amount: 0, time_amount: 0, weather: "sunny" } } : { lines: [line] }) });
    await quotes.approveQuote(identity(rider), labor.id, purpose === "rescue_final" ? { payment_timing: "after_repair" } : {});
    await uow.execute(async (r) => { await r.assignments.updateStatus({ id: assignmentId, status: "diagnosis", updatedAt: now }); await r.serviceRequests.updateStatus({ id: requestId, status: "in_service", updatedAt: now }); });
  }
  const input = { assignment_id: assignmentId, purpose, expires_at: new Date(now.getTime() + 600_000).toISOString(),
    ...(purpose === "rescue_labor" ? { labor_pricing: { base_amount: 100_000, distance_amount: 0, weather_amount: 0, time_amount: 0, weather: "sunny" } } : { lines: [purpose === "standard" || purpose === "maintenance_labor" ? line : { ...line, line_type: "part" }] }) };
  const quote = await quotes.createQuote(identity(mechanic), requestId, input);
  return { ...result, quote, input };
}

describe("admin quote and diagnosis supervision", () => {
  it.each(["standard", "rescue_labor", "rescue_final", "maintenance_labor", "maintenance_work"] as const)("voids pending %s and allows a fresh immutable version with correct workflow", async (purpose) => {
    const { uow, quotes, service, quote, input } = await issue(purpose); const content = uow.snapshot().quotes;
    const response = await service.command(identity(admin), quote.id, "void", reason, "void-quote-key");
    expect(await service.command(identity(admin), quote.id, "void", reason, "void-quote-key")).toEqual(response);
    const state = uow.snapshot(); expect(state.adminSupervisionActions).toHaveLength(1);
    expect(state.quotes.at(-1)).toEqual({ ...content.at(-1), status: "voided", respondedAt: now });
    expect(state.quotes.slice(0, -1)).toEqual(content.slice(0, -1));
    expect(state.assignments[0]!.status).toBe(purpose.endsWith("labor") ? "accepted" : "diagnosis");
    const replacement = await quotes.createQuote(identity(mechanic), requestId, input);
    expect(replacement.version).toBe(quote.version + 1); expect(uow.snapshot().assignments[0]!.status).toBe("quoted");
    await expect(quotes.approveQuote(identity(rider), quote.id)).rejects.toMatchObject({ status: 409 });
  });

  it("keeps approved maintenance work and fixed labor when voiding a pending cumulative addition", async () => {
    const { uow, quotes, service, quote } = await issue("maintenance_work"); await quotes.approveQuote(identity(rider), quote.id);
    await uow.execute(async (r) => { await r.assignments.updateStatus({ id: assignmentId, status: "in_progress", updatedAt: now }); });
    const approved = uow.snapshot().quotes;
    const addition = await quotes.createQuote(identity(mechanic), requestId, { assignment_id: assignmentId, purpose: "maintenance_work", basis_quote_id: quote.id, lines: [{ ...line, line_type: "part", unit_amount: 10_000 }] });
    await service.command(identity(admin), addition.id, "quote_revision", reason, "addition-revision-key");
    expect(uow.snapshot().assignments[0]).toMatchObject({ status: "in_progress", maintenanceLaborQuoteId: approved[0]!.id });
    expect(uow.snapshot().quotes.slice(0, 2)).toEqual(approved);
    await expect(service.command(identity(admin), quote.id, "void", reason, "void-approved-key")).rejects.toMatchObject({ status: 409 });
  });

  it("expires only timed overdue pending quotes and distinguishes void from expiry", async () => {
    const { uow, service, quote } = await issue();
    await expect(service.command(identity(admin), quote.id, "expire", reason, "expire-before-due")).rejects.toMatchObject({ details: { reason_code: "quote_not_expired" } });
    const later = new AdminSupervisionService(uow, { now: () => new Date(now.getTime() + 600_000) });
    await later.command(identity(admin), quote.id, "expire", reason, "expire-now-due");
    expect(uow.snapshot().quotes[0]!.status).toBe("expired");
  });

  it("serializes rider approval versus revision or void without two committed decisions", async () => {
    for (const command of ["void", "quote_revision"] as const) {
      const { uow, quotes, service, quote } = await issue();
      const results = await Promise.allSettled([service.command(identity(admin), quote.id, command, reason, "decision-race-key"), quotes.approveQuote(identity(rider), quote.id)]);
      expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
      expect(uow.snapshot().quotes[0]!.status).toBe("voided");
    }
  });

  it("allows only canonical admin cancellation after a closed quote; recovery remains blocked", async () => {
    const { uow, service, quote } = await issue(); await service.command(identity(admin), quote.id, "void", reason, "void-before-cancel");
    await expect(new AssignmentRecoveryService(uow, { now: () => now }).recover(identity(admin), assignmentId, { reason_code: "no_show" }, "closed-recovery-key")).rejects.toMatchObject({ status: 409 });
    await new AdminAssignmentService(uow, { now: () => now }).command(identity(admin), assignmentId, "cancel", reason, "closed-admin-cancel");
    expect(uow.snapshot().serviceRequests[0]!.status).toBe("canceled"); expect(uow.snapshot().quotes[0]!.status).toBe("voided");
  });

  it("appends diagnosis revision evidence without changing text and refuses issued diagnosis edits", async () => {
    const { uow, quotes, service } = setup(); const before = uow.snapshot().mechanicDiagnoses;
    await service.command(identity(admin), diagnosisId, "diagnosis_revision", reason, "diagnosis-revision-key");
    expect(uow.snapshot().mechanicDiagnoses).toEqual(before);
    await quotes.createQuote(identity(mechanic), requestId, { assignment_id: assignmentId, diagnosis_id: diagnosisId, lines: [line] });
    await expect(service.command(identity(admin), diagnosisId, "diagnosis_revision", reason, "issued-diagnosis-key")).rejects.toMatchObject({ status: 409 });
    const dto = await service.read(identity(admin), assignmentId, "diagnosis"); expect(dto).toMatchObject({ immutable: true }); expect(JSON.stringify(dto)).not.toContain("private");
  });

  it("guards all reads/commands, pagination, dispute allowlist and redaction", async () => {
    const { service, quote } = await issue();
    for (const subject of [rider, mechanic]) {
      await expect(service.read(identity(subject), quote.id, "quote")).rejects.toMatchObject({ status: 403 });
      await expect(service.command(identity(subject), quote.id, "void", reason, "unauthorized-void")).rejects.toMatchObject({ status: 403 });
    }
    const routes = createAdminSupervisionRouteHandlers({ authenticate: async () => identity(admin), service });
    const request = (body: unknown) => new Request("http://localhost/", { method: "POST", body: JSON.stringify(body), headers: { "x-idempotency-key": "valid-key" } });
    expect((await routes.command(request({ ...reason, resolution: "refund" }), requestId, "dispute")).status).toBe(400);
    expect((await routes.read(new Request("http://localhost/?limit=101"), requestId, "quotes")).status).toBe(400);
    expect(JSON.stringify(await service.read(identity(admin), quote.id, "quote"))).not.toMatch(/private|notes|description/);
    await service.command(identity(admin), requestId, "dispute", { ...reason, resolution: "uphold_latest_quote" }, "uphold-latest-key");
    await service.command(identity(admin), requestId, "dispute", { ...reason, resolution: "request_revision" }, "dispute-revision-key");
  });
});
