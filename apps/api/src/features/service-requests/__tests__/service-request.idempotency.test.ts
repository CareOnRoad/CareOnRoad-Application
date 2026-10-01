import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { ServiceRequestService } from "../service-request.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-06-25T04:00:00Z");

describe("service request creation idempotency", () => {
  it("requires a stable key in the route layer and replays one logical request for every service type", async () => {
    const service = new ServiceRequestService(createUnitOfWork(), {
      now: () => now,
      createId: sequentialIds(Array.from({ length: 80 }, (_, index) => uuid(index + 1)))
    });
    const inputs = [
      {
        service_type: "emergency_rescue",
        location: { latitude: 10.762622, longitude: 106.660172 }
      },
      { service_type: "mobile_repair", address_text: "1 Nguyen Trai" },
      { service_type: "at_home_service", address_text: "1 Nguyen Trai", scheduled_start_at: future() },
      { service_type: "periodic_maintenance",
          location: { latitude: 10.77, longitude: 106.69 }, scheduled_start_at: future() },
      { service_type: "other", fulfillment_mode: "immediate_location", address_text: "1 Nguyen Trai" }
    ] as const;

    for (const input of inputs) {
      const body = {
        motorcycle_id: motorcycleId,
        problem_description: "Xe can ho tro",
        ...input
      };
      const key = `idem-${input.service_type}-${
        "fulfillment_mode" in input ? input.fulfillment_mode : "fixed"
      }`;
      const first = await service.createServiceRequest(identity(riderId), body, key);
      const replay = await service.createServiceRequest(identity(riderId), body, key);
      expect(replay).toEqual(first);
    }
  });

  it("returns controlled 409 with a stable error code for mismatched payload replay", async () => {
    const service = new ServiceRequestService(createUnitOfWork(), {
      now: () => now,
      createId: sequentialIds(Array.from({ length: 20 }, (_, index) => uuid(index + 100)))
    });
    const body = {
      motorcycle_id: motorcycleId,
      service_type: "mobile_repair",
      problem_description: "Xe tat may",
      address_text: "1 Nguyen Trai"
    };

    await service.createServiceRequest(identity(riderId), body, "same-key");
    await expect(
      service.createServiceRequest(
        identity(riderId),
        { ...body, problem_description: "No may khac" },
        "same-key"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  });
});

function createUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [{ id: riderId, status: "active", createdAt: now, updatedAt: now }],
    userRoles: [{ userId: riderId, role: "rider" }],
    motorcycles: [
      {
        id: motorcycleId,
        riderId,
        brandText: "Honda",
        modelText: "Wave",
        createdAt: now,
        updatedAt: now
      }
    ]
  });
}

function identity(subject: string) {
  return {
    subject,
    issuer: "https://careonroad.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}

function future(): string {
  return "2026-06-26T04:00:00.000Z";
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

function uuid(index: number): string {
  return `${index.toString(16).padStart(8, "0")}-bbbb-4bbb-8bbb-${index
    .toString(16)
    .padStart(12, "0")}`;
}
