// Audit assertions describe the required behavior. Failures reproduce current defects.
// Run separately; these checks are outside the normal src/**/*.test.ts suite.
import { describe, expect, it } from "vitest";
import { AssignmentService } from "@/features/assignments/assignment.service";
import { AssignmentRecoveryService } from "@/features/assignments/assignment-recovery.service";
import { AcceptAssignmentService } from "@/features/assignments/accept-assignment.service";
import { MotorcycleService } from "@/features/motorcycles/motorcycle.service";
import { MechanicProfileService } from "@/features/motorcycles/mechanic-profile.service";
import { AuthService } from "@/features/auth/auth.service";
import { AdminMechanicManagementService } from "@/features/admin/admin-mechanic-management.service";
import { MechanicDiagnosisService } from "@/features/mechanic-diagnosis/mechanic-diagnosis.service";
import { MechanicAssignmentMetadataService } from "@/features/mechanic-operations/mechanic-assignment-metadata.service";
import { ReviewService } from "@/features/reviews/review.service";
import { NotificationInboxService } from "@/features/notifications/notification-inbox.service";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import { MechanicJobListService } from "@/features/mechanic-operations/mechanic-job-list.service";
import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import { PaymentService } from "@/features/payments/payment.service";
import type { PaymentProviderClient, VerifiedPaymentEvent } from "@/features/payments/payment-provider";
import { QuoteService } from "@/features/quotes/quote.service";
import { runSafetyGate } from "@/features/chatbot/safety-gate";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";

const rider = "11111111-1111-4111-8111-111111111111";
const mechanic = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const assignmentId = "44444444-4444-4444-8444-444444444444";
const candidateId = "55555555-5555-4555-8555-555555555555";
const now = new Date("2026-10-01T10:00:00Z");
const identity = (subject: string): VerifiedSupabaseIdentity => ({ subject, issuer: "https://example.test/auth/v1", audience: ["authenticated"] });

function setup(serviceType: ServiceType = "mobile_repair", initialUow?: InMemoryUnitOfWork) {
  const uow = initialUow ?? new InMemoryUnitOfWork({
    users: [rider, mechanic].map(id => ({ id, status: "active", createdAt: now, updatedAt: now })),
    userRoles: [{ userId: rider, role: "rider" }, { userId: mechanic, role: "mechanic" }],
    serviceRequests: [{ id: requestId, requestCode: "COR-AUDIT-20261001-1", riderId: rider,
      motorcycleId: "66666666-6666-4666-8666-666666666666", serviceType,
      problemDescription: "Xe không khởi động", addressText: "Địa điểm kiểm thử",
      serviceLocation: { latitude: 10.76, longitude: 106.66 }, status: "assigned", priority: "normal", createdAt: now, updatedAt: now }],
    assignments: [{ id: assignmentId, requestId, mechanicId: mechanic, acceptedCandidateId: candidateId,
      status: "accepted", acceptedAt: now, createdAt: now, updatedAt: now }],
    dispatchCandidates: [{ id: candidateId, requestId, roundId: "77777777-7777-4777-8777-777777777777",
      mechanicId: mechanic, rank: 1, distanceMeters: 100, status: "accepted", createdAt: now }]
  });
  let event: VerifiedPaymentEvent = { kind: "invalid", reason: "test" };
  const provider: PaymentProviderClient = {
    async createPaymentLink(input) { return { paymentLinkId: `link-${input.orderCode}`, checkoutUrl: "https://example.test/pay", status: "PENDING" }; },
    async cancelPaymentLink(input) { return { orderCode: input.orderCode, amount: 100000, amountPaid: 0, currency: "VND", status: "CANCELLED" }; },
    async getPaymentStatus(orderCode) { return { orderCode, amount: 100000, amountPaid: 100000, currency: "VND", status: "PAID" }; },
    verifyWebhookPayload() { return event; }
  };
  const assignments = new AssignmentService(uow, { now: () => now });
  const quotes = new QuoteService(uow, { now: () => now });
  const payments = new PaymentService(uow, { now: () => now, providerFactory: () => provider,
    returnUrl: () => "https://example.test/return", cancelUrl: () => "https://example.test/cancel" });
  const status = (value: string) => assignments.transitionAssignment(identity(mechanic), assignmentId, { status: value });
  async function receive(quoteId: string) {
    const order = await payments.createPaymentOrder(identity(rider), { quote_id: quoteId }, `audit-payment-${quoteId}`);
    event = { kind: "valid", eventDedupeKey: order.id, success: true, orderCode: order.provider_order_code,
      amount: order.amount, currency: "VND", paymentLinkId: order.provider_payment_link_id, status: "00" };
    expect(await payments.handlePayosWebhook({})).toMatchObject({ status: "succeeded" });
  }
  return { uow, assignments, quotes, payments, status, receive };
}

describe("role workflow audit: expected invariants", () => {
  it("A01 cancellation after travel keeps request and assignment synchronized", async () => {
    const s = setup();
    await s.status("en_route");
    await s.status("canceled");
    expect(s.uow.snapshot().serviceRequests[0]?.status).toBe("canceled");
  });

  it("A02 former mechanic cannot mutate assignment after losing mechanic role", async () => {
    const state = setup().uow.snapshot();
    state.userRoles = state.userRoles.filter(role => role.userId !== mechanic);
    state.userRoles.push({ userId: mechanic, role: "rider" });
    const service = new AssignmentService(new InMemoryUnitOfWork(state), { now: () => now });
    await expect(service.transitionAssignment(identity(mechanic), assignmentId, { status: "en_route" }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("A03 pre-quote recovery cannot discard an approved and paid rescue agreement", async () => {
    const s = setup("emergency_rescue");
    const labor = await s.quotes.createQuote(identity(mechanic), requestId, { assignment_id: assignmentId,
      purpose: "rescue_labor", labor_pricing: { base_amount: 100000, distance_amount: 0,
        weather_amount: 0, time_amount: 0, weather: "sunny" } });
    await s.quotes.approveQuote(identity(rider), labor.id, { payment_timing: "labor_upfront" });
    await s.receive(labor.id);
    const recovery = new AssignmentRecoveryService(s.uow, { now: () => now });
    await expect(recovery.recover(identity(mechanic), assignmentId, { reason_code: "cannot_continue" }, "audit-recovery-key"))
      .rejects.toMatchObject({ status: 409 });
  });

  it("A04 exhausting rider dispatch persists manual escalation", async () => {
    const state = setup().uow.snapshot();
    state.assignments = []; state.dispatchCandidates = [];
    state.serviceRequests[0]!.status = "offered";
    state.dispatchRounds = [1, 2, 3, 4].map(n => ({ id: `77777777-7777-4777-8777-${String(n).padStart(12, "0")}`,
      requestId, roundNumber: n, radiusMeters: 2000, status: "expired", startedAt: new Date(now.getTime() - 300000),
      expiresAt: new Date(now.getTime() - 1000) }));
    const uow = new InMemoryUnitOfWork(state);
    await expect(new DispatchService(uow, { now: () => now }).startDispatch(identity(rider), requestId)).rejects.toMatchObject({ status: 409 });
    expect(uow.snapshot().serviceRequests[0]?.status).toBe("manual_escalation");
  });

  it("A05 zero-total standard quote is rejected before entering approval/payment", async () => {
    const s = setup();
    for (const value of ["en_route", "on_site", "diagnosis"]) await s.status(value);
    await expect(s.quotes.createQuote(identity(mechanic), requestId, { assignment_id: assignmentId,
      lines: [{ line_type: "labor", description: "Công", quantity: 1, unit_amount: 100000 }], discount_amount: 100000 }))
      .rejects.toMatchObject({ status: 400 });
    expect(s.uow.snapshot().quotes).toEqual([]);
    const quote = await s.quotes.createQuote(identity(mechanic), requestId, { assignment_id: assignmentId,
      lines: [{ line_type: "labor", description: "Công", quantity: 1, unit_amount: 100000 }] });
    await s.quotes.approveQuote(identity(rider), quote.id);
    await expect(s.status("in_progress")).rejects.toMatchObject({ status: 409 });
  });

  it("A06 assigned mechanic can restore destination and problem details", async () => {
    const s = setup();
    await expect(new ServiceRequestService(s.uow).getServiceRequest(identity(mechanic), requestId))
      .rejects.toMatchObject({ status: 403 });
    const job = await new MechanicJobListService(new InMemoryUnitOfWork(s.uow.snapshot())).getJob(identity(mechanic), assignmentId);
    expect(job.request).toMatchObject({ problem_description: "Xe không khởi động",
      location: { latitude: 10.76, longitude: 106.66 }, address_text: "Địa điểm kiểm thử" });
  });

  it("A07 safety gate recognizes Vietnamese shutdown word-order variant", () => {
    expect(runSafetyGate("Xe đang chạy thì chết máy")).toMatchObject({ is_dangerous: true, can_continue_riding: false });
  });

  it("A08 address-only creation is rejected before persistence", async () => {
    const s = setup();
    const bike = await new MotorcycleService(s.uow, { now: () => now }).createMotorcycle(identity(rider), { brand_text: "Honda", model_text: "Wave" });
    const count = s.uow.snapshot().serviceRequests.length;
    await expect(new ServiceRequestService(s.uow, { now: () => now }).createServiceRequest(identity(rider), {
      motorcycle_id: bike.id, service_type: "mobile_repair", problem_description: "Xe không khởi động", address_text: "Địa điểm kiểm thử"
    }, "audit-address-only")).rejects.toMatchObject({ status: 400, message: expect.stringContaining("location") });
    expect(s.uow.snapshot().serviceRequests).toHaveLength(count);
  });

  it("A09 at-home appointment cannot start travel a day before its schedule", async () => {
    const state = setup("at_home_service").uow.snapshot();
    state.assignments = [];
    state.serviceRequests[0]!.status = "offered";
    state.serviceRequests[0]!.scheduledStartAt = new Date(now.getTime() + 86400000);
    state.dispatchCandidates[0]!.status = "offered";
    state.dispatchCandidates[0]!.expiresAt = new Date(now.getTime() + 60000);
    state.dispatchRounds = [{ id: state.dispatchCandidates[0]!.roundId, requestId, roundNumber: 1, radiusMeters: 2000,
      status: "active", startedAt: now, expiresAt: new Date(now.getTime() + 60000) }];
    state.mechanicProfiles = [{ userId: mechanic, profileStatus: "active", isAvailable: true, serviceRadiusKm: 10,
      availabilityUpdatedAt: now, ratingAvg: 0, ratingCount: 0, serviceTypes: ["at_home_service"], createdAt: now, updatedAt: now }];
    const uow = new InMemoryUnitOfWork(state);
    const assignment = await new AcceptAssignmentService(uow, { now: () => now }).acceptOffer(identity(mechanic), candidateId, { estimated_duration_minutes: 60 });
    await expect(new AssignmentService(uow, { now: () => now }).transitionAssignment(identity(mechanic), assignment.id, { status: "en_route" }))
      .rejects.toMatchObject({ status: 409 });
  });

  it("A10 rider with an additional mechanic role retains rider assignment visibility", async () => {
    const state = setup().uow.snapshot();
    state.userRoles.push({ userId: rider, role: "mechanic" });
    const result = await new AssignmentService(new InMemoryUnitOfWork(state)).listAssignments(identity(rider));
    expect(result.items.some(assignment => assignment.id === assignmentId)).toBe(true);
  });
});

describe("role workflow audit: application service chains (memory, simulated provider)", () => {
  it.each([
    { service: "mobile_repair", timing: "after_repair" },
    { service: "emergency_rescue", timing: "after_repair" },
    { service: "emergency_rescue", timing: "labor_upfront" },
    { service: "periodic_maintenance", timing: "after_repair" }
  ] as const)("onboarding -> admin approval -> $service/$timing -> payment -> completion -> review", async ({ service, timing }) => {
    const admin = "88888888-8888-4888-8888-888888888888";
    const uow = new InMemoryUnitOfWork({ users: [{ id: admin, status: "active", createdAt: now, updatedAt: now }],
      userRoles: [{ userId: admin, role: "admin" }] });
    const s = setup(service, uow);
    const options = { now: () => now };
    const auth = new AuthService(uow, options);
    await auth.bootstrapProfile(identity(rider), { account_type: "rider" });
    await auth.bootstrapProfile(identity(mechanic), { account_type: "mechanic" });
    await new AdminMechanicManagementService(uow, options).approve(identity(admin), mechanic,
      { reason: "Approve audit mechanic onboarding" }, "audit-admin-approve");
    const profile = new MechanicProfileService(uow, options);
    await profile.updateMyProfile(identity(mechanic), { service_types: [service] });
    await profile.updateAvailability(identity(mechanic), { is_available: true });
    await profile.updateLocation(identity(mechanic), { latitude: 10.76, longitude: 106.66 });
    const bike = await new MotorcycleService(uow, options).createMotorcycle(identity(rider), { brand_text: "Honda", model_text: "Wave" });
    const request = await new ServiceRequestService(uow, options).createServiceRequest(identity(rider), {
      motorcycle_id: bike.id, service_type: service, problem_description: "Xe không khởi động",
      location: { latitude: 10.76, longitude: 106.66 },
      ...(service === "periodic_maintenance" ? { scheduled_start_at: new Date(now.getTime() + 300000).toISOString() } : {})
    }, "audit-chain-request");
    const dispatch = new DispatchService(uow, options);
    await dispatch.startDispatch(identity(rider), request.id);
    const offers = await dispatch.listMyOffers(identity(mechanic));
    const assignment = await new AcceptAssignmentService(uow, options).acceptOffer(identity(mechanic), offers.items[0]!.id,
      service === "periodic_maintenance" ? { estimated_duration_minutes: 15 } : {});
    const progress = (status: string) => s.assignments.transitionAssignment(identity(mechanic), assignment.id, { status });
    const laborLines = [{ line_type: "labor", description: "Công", quantity: 1, unit_amount: 100000 }];
    if (service !== "mobile_repair") {
      const labor = await s.quotes.createQuote(identity(mechanic), request.id, { assignment_id: assignment.id,
        purpose: service === "emergency_rescue" ? "rescue_labor" : "maintenance_labor",
        ...(service === "emergency_rescue" ? { labor_pricing: { base_amount: 100000, distance_amount: 0,
          weather_amount: 0, time_amount: 0, weather: "sunny" } } : { lines: laborLines }) });
      await s.quotes.approveQuote(identity(rider), labor.id, service === "emergency_rescue" ? { payment_timing: timing } : {});
      if (service === "emergency_rescue" && timing === "labor_upfront") await s.receive(labor.id);
    }
    await progress("en_route"); await progress("on_site");
    const diagnosis = await new MechanicDiagnosisService(uow, options).upsertDiagnosis(identity(mechanic), assignment.id,
      { diagnosis_text: "Kiểm tra xe tại vị trí phục vụ" });
    await progress("diagnosis");
    const quote = await s.quotes.createQuote(identity(mechanic), request.id, { assignment_id: assignment.id, diagnosis_id: diagnosis.id,
      purpose: service === "mobile_repair" ? "standard" : service === "emergency_rescue" ? "rescue_final" : "maintenance_work",
      lines: service === "mobile_repair" ? laborLines : [{ line_type: "part", description: "Vật tư", quantity: 1, unit_amount: 20000 }] });
    await s.quotes.approveQuote(identity(rider), quote.id);
    if (service === "mobile_repair") await s.receive(quote.id);
    await progress("in_progress");
    if (service === "periodic_maintenance") await new MechanicAssignmentMetadataService(uow, options).submitCompletionChecklist(identity(mechanic), assignment.id,
      { work_summary: "Đã hoàn thành các hạng mục được duyệt", safety_checklist: { test_ride_completed: true,
        tools_removed: true, area_safe: true, rider_briefed: true, no_fluid_leak: true } }, "audit-chain-checklist");
    if (service !== "mobile_repair") { await progress("awaiting_payment"); await s.receive(quote.id); }
    await progress("completed");
    expect((await new ServiceRequestService(uow).getServiceRequest(identity(rider), request.id)).status).toBe("completed");
    expect(await new ReviewService(uow, options).createReview(identity(rider), assignment.id, { rating: 5 }, "audit-chain-review"))
      .toMatchObject({ mechanic_rating: { average: 5, count: 1 } });
    expect((await new NotificationInboxService(uow).list(identity(rider), {})).items.length).toBeGreaterThan(0);
  });
});
