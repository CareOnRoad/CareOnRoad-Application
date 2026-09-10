import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { MechanicDiagnosisService } from "@/features/mechanic-diagnosis/mechanic-diagnosis.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { createDiagnosisQuoteRouteHandlers } from "../diagnosis-quote.route-handlers";
import { QuoteService } from "../quote.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const otherMechanicId = "44444444-4444-4444-8444-444444444444";
const adminId = "55555555-5555-4555-8555-555555555555";
const motorcycleId = "66666666-6666-4666-8666-666666666666";
const requestId = "77777777-7777-4777-8777-777777777777";
const assignmentId = "88888888-8888-4888-8888-888888888888";
const absentId = "99999999-9999-4999-8999-999999999999";
const now = new Date("2026-06-25T10:00:00.000Z");

describe("diagnosis and quote routes", () => {
  it("enforces authentication, role, assignment, ownership, validation, and stale-version boundaries", async () => {
    const unitOfWork = createUnitOfWork();
    const handlers = createDiagnosisQuoteRouteHandlers({
      authenticate,
      diagnosisService: new MechanicDiagnosisService(unitOfWork, { now: () => now }),
      quoteService: new QuoteService(unitOfWork, { now: () => now })
    });

    const missing = await handlers.upsertDiagnosis(
      jsonRequest("POST", `/api/v1/assignments/${assignmentId}/diagnoses`, undefined, {
        diagnosis_text: "Bugi mon."
      }),
      assignmentId
    );
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ error_code: "UNAUTHORIZED" });

    const invalidAuth = await handlers.upsertDiagnosis(
      jsonRequest("POST", `/api/v1/assignments/${assignmentId}/diagnoses`, "invalid", {
        diagnosis_text: "Bugi mon."
      }),
      assignmentId
    );
    expect(invalidAuth.status).toBe(401);
    await expect(invalidAuth.json()).resolves.toMatchObject({
      error_code: "INVALID_TOKEN"
    });

    const riderDenied = await handlers.upsertDiagnosis(
      jsonRequest("POST", `/api/v1/assignments/${assignmentId}/diagnoses`, "rider", {
        diagnosis_text: "Bugi mon."
      }),
      assignmentId
    );
    expect(riderDenied.status).toBe(403);

    const unassigned = await handlers.upsertDiagnosis(
      jsonRequest(
        "POST",
        `/api/v1/assignments/${assignmentId}/diagnoses`,
        "other-mechanic",
        { diagnosis_text: "Bugi mon." }
      ),
      assignmentId
    );
    expect(unassigned.status).toBe(403);

    const absent = await handlers.upsertDiagnosis(
      jsonRequest("POST", `/api/v1/assignments/${absentId}/diagnoses`, "mechanic", {
        diagnosis_text: "Bugi mon."
      }),
      absentId
    );
    expect(absent.status).toBe(404);

    const invalidInput = await handlers.upsertDiagnosis(
      jsonRequest("POST", `/api/v1/assignments/${assignmentId}/diagnoses`, "mechanic", {
        diagnosis_text: "x"
      }),
      assignmentId
    );
    expect(invalidInput.status).toBe(400);
    await expect(invalidInput.json()).resolves.toMatchObject({
      error_code: "INVALID_INPUT"
    });

    const diagnosisResponse = await handlers.upsertDiagnosis(
      jsonRequest("POST", `/api/v1/assignments/${assignmentId}/diagnoses`, "mechanic", {
        diagnosis_text: "Bugi mon."
      }),
      assignmentId
    );
    expect(diagnosisResponse.status).toBe(201);
    const diagnosis = (await diagnosisResponse.json()) as { id: string };

    const quoteOneResponse = await handlers.createQuote(
      jsonRequest("POST", `/api/v1/service-requests/${requestId}/quotes`, "mechanic", {
        assignment_id: assignmentId,
        diagnosis_id: diagnosis.id,
        lines: [
          {
            line_type: "labor",
            description: "Cong kiem tra",
            quantity: 1,
            unit_amount: 50_000
          }
        ]
      }),
      requestId
    );
    expect(quoteOneResponse.status).toBe(201);
    const quoteOne = (await quoteOneResponse.json()) as { id: string };

    const quoteTwoResponse = await handlers.createQuote(
      jsonRequest("POST", `/api/v1/service-requests/${requestId}/quotes`, "admin", {
        assignment_id: assignmentId,
        diagnosis_id: diagnosis.id,
        lines: [
          {
            line_type: "labor",
            description: "Cong thay bugi",
            quantity: 1,
            unit_amount: 70_000
          }
        ]
      }),
      requestId
    );
    const quoteTwo = (await quoteTwoResponse.json()) as { id: string };

    const nonOwner = await handlers.approveQuote(
      request("POST", `/api/v1/quotes/${quoteTwo.id}/approve`, "other-rider"),
      quoteTwo.id
    );
    expect(nonOwner.status).toBe(403);

    const stale = await handlers.approveQuote(
      request("POST", `/api/v1/quotes/${quoteOne.id}/approve`, "rider"),
      quoteOne.id
    );
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({ error_code: "CONFLICT" });

    const approved = await handlers.approveQuote(
      request("POST", `/api/v1/quotes/${quoteTwo.id}/approve`, "rider"),
      quoteTwo.id
    );
    expect(approved.status).toBe(200);

    const listed = await handlers.listQuotes(
      request("GET", `/api/v1/service-requests/${requestId}/quotes`, "rider"),
      requestId
    );
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({ items: [{ version: 2 }, { version: 1 }] });
  });

  it("returns controlled route errors for workflow conflicts, malformed quote input, and absent quotes", async () => {
    const conflictHandlers = handlersFor(createUnitOfWork("accepted"));
    const wrongState = await conflictHandlers.upsertDiagnosis(
      jsonRequest("POST", `/api/v1/assignments/${assignmentId}/diagnoses`, "mechanic", {
        diagnosis_text: "Bugi mon."
      }),
      assignmentId
    );
    expect(wrongState.status).toBe(409);
    await expect(wrongState.json()).resolves.toMatchObject({ error_code: "CONFLICT" });

    const handlers = handlersFor(createUnitOfWork("on_site"));
    const adminDiagnosis = await handlers.upsertDiagnosis(
      jsonRequest("POST", `/api/v1/assignments/${assignmentId}/diagnoses`, "admin", {
        diagnosis_text: "Bugi mon."
      }),
      assignmentId
    );
    expect(adminDiagnosis.status).toBe(201);

    const riderQuoteDenied = await handlers.createQuote(
      jsonRequest("POST", `/api/v1/service-requests/${requestId}/quotes`, "rider", {
        assignment_id: assignmentId,
        lines: [
          {
            line_type: "labor",
            description: "Cong kiem tra",
            quantity: 1,
            unit_amount: 50_000
          }
        ]
      }),
      requestId
    );
    expect(riderQuoteDenied.status).toBe(403);
    await expect(riderQuoteDenied.json()).resolves.toMatchObject({
      error_code: "FORBIDDEN"
    });

    const invalidQuote = await handlers.createQuote(
      jsonRequest("POST", `/api/v1/service-requests/${requestId}/quotes`, "mechanic", {
        assignment_id: assignmentId,
        lines: []
      }),
      requestId
    );
    expect(invalidQuote.status).toBe(400);
    await expect(invalidQuote.json()).resolves.toMatchObject({
      error_code: "INVALID_INPUT"
    });

    const malformed = await handlers.createQuote(
      new Request(`http://localhost/api/v1/service-requests/${requestId}/quotes`, {
        method: "POST",
        headers: {
          authorization: "Bearer mechanic",
          "content-type": "application/json"
        },
        body: "{"
      }),
      requestId
    );
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({
      error_code: "INVALID_INPUT"
    });

    const absent = await handlers.rejectQuote(
      request("POST", `/api/v1/quotes/${absentId}/reject`, "rider"),
      absentId
    );
    expect(absent.status).toBe(404);
    await expect(absent.json()).resolves.toMatchObject({ error_code: "NOT_FOUND" });
  });
});

function handlersFor(unitOfWork: InMemoryUnitOfWork) {
  return createDiagnosisQuoteRouteHandlers({
    authenticate,
    diagnosisService: new MechanicDiagnosisService(unitOfWork, { now: () => now }),
    quoteService: new QuoteService(unitOfWork, { now: () => now })
  });
}

function createUnitOfWork(
  assignmentStatus: "accepted" | "on_site" | "diagnosis" = "diagnosis"
) {
  return new InMemoryUnitOfWork({
    users: [
      activeUser(riderId),
      activeUser(otherRiderId),
      activeUser(mechanicId),
      activeUser(otherMechanicId),
      activeUser(adminId)
    ],
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: otherRiderId, role: "rider" },
      { userId: mechanicId, role: "mechanic" },
      { userId: otherMechanicId, role: "mechanic" },
      { userId: adminId, role: "admin" }
    ],
    motorcycles: [
      {
        id: motorcycleId,
        riderId,
        brandText: "Honda",
        modelText: "Wave",
        createdAt: now,
        updatedAt: now
      }
    ],
    serviceRequests: [
      {
        id: requestId,
        requestCode: "COR-MOB-20260625-1",
        riderId,
        motorcycleId,
        serviceType: "mobile_repair",
        problemDescription: "Xe kho no.",
        status: assignmentStatus === "accepted" ? "assigned" : "in_service",
        priority: "normal",
        createdAt: now,
        updatedAt: now
      }
    ],
    assignments: [
      {
        id: assignmentId,
        requestId,
        mechanicId,
        acceptedCandidateId: "aaaaaaaa-0000-4000-8000-000000000001",
        status: assignmentStatus,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ]
  });
}

function request(method: string, path: string, token?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : undefined
  });
}

function jsonRequest(method: string, path: string, token: string | undefined, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function authenticate(requestInput: Request): Promise<VerifiedSupabaseIdentity> {
  const authorization = requestInput.headers.get("authorization");
  if (!authorization) {
    throw routeAuthError("UNAUTHORIZED");
  }
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (token === "invalid") {
    throw routeAuthError("INVALID_TOKEN");
  }
  const subject =
    token === "rider"
      ? riderId
      : token === "other-rider"
        ? otherRiderId
        : token === "mechanic"
          ? mechanicId
          : token === "other-mechanic"
            ? otherMechanicId
            : adminId;
  return identity(subject);
}

function routeAuthError(errorCode: "UNAUTHORIZED" | "INVALID_TOKEN") {
  const error = new Error("Authentication failed.") as Error & {
    status: number;
    errorCode: "UNAUTHORIZED" | "INVALID_TOKEN";
  };
  error.status = 401;
  error.errorCode = errorCode;
  return error;
}

function activeUser(id: string) {
  return { id, status: "active" as const, createdAt: now, updatedAt: now };
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://careonroad.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}
