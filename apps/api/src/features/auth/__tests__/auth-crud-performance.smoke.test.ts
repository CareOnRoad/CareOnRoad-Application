import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { MotorcycleService } from "@/features/motorcycles/motorcycle.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { AuthService } from "../auth.service";

const riderId = "20000000-0000-4000-8000-000000000001";
const now = new Date("2026-06-30T06:00:00.000Z");
const identity = {
  subject: riderId,
  issuer: "https://smoke-test.supabase.co/auth/v1",
  audience: ["authenticated"]
};

describe("auth/profile and CRUD local regression smoke", () => {
  it("completes 20 deterministic operations within the generous local threshold", async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const ids = deterministicIds();
    const auth = new AuthService(unitOfWork, {
      now: () => now,
      createId: () => ids.next().value!
    });
    const motorcycles = new MotorcycleService(unitOfWork, {
      now: () => now,
      createId: () => ids.next().value!
    });
    const motorcycleIds: string[] = [];
    let operationCount = 0;
    const startedAt = performance.now();

    await auth.bootstrapProfile(identity, { display_name: "Smoke Rider" });
    operationCount += 1;
    await auth.getCurrentActor(identity);
    operationCount += 1;

    for (let index = 0; index < 5; index += 1) {
      const motorcycle = await motorcycles.createMotorcycle(identity, {
        brand_text: "Honda",
        model_text: `Wave ${index}`,
        year: 2020 + index
      });
      motorcycleIds.push(motorcycle.id);
      operationCount += 1;
    }
    for (const motorcycleId of motorcycleIds) {
      await motorcycles.getMotorcycle(identity, motorcycleId);
      operationCount += 1;
    }
    for (let index = 0; index < motorcycleIds.length; index += 1) {
      await motorcycles.updateMotorcycle(identity, motorcycleIds[index]!, {
        brand_text: "Honda",
        model_text: `Wave Updated ${index}`,
        year: 2021 + index
      });
      operationCount += 1;
    }
    await motorcycles.listMotorcycles(identity);
    operationCount += 1;
    await motorcycles.archiveMotorcycle(identity, motorcycleIds[0]!);
    operationCount += 1;
    await motorcycles.archiveMotorcycle(identity, motorcycleIds[1]!);
    operationCount += 1;

    const elapsedMs = performance.now() - startedAt;
    expect(operationCount).toBe(20);
    expect(elapsedMs).toBeLessThan(30_000);

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.users).toHaveLength(1);
    expect(snapshot.motorcycles).toHaveLength(5);
    expect(snapshot.motorcycles.filter((motorcycle) => motorcycle.archivedAt)).toHaveLength(2);
    expect(snapshot.auditLogs).toHaveLength(13);
    expect(snapshot.outboxEvents).toHaveLength(13);
  }, 30_000);
});

function* deterministicIds() {
  for (let index = 1; ; index += 1) {
    yield `20000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
  }
}
