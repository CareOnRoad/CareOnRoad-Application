import { describe, expect, it } from "vitest";

import type { RequestCodeRepository } from "@/server/repositories/contracts/request-code.repository";
import { InMemoryRequestCodeRepository } from "@/server/repositories/testing/in-memory-request-code.repository";

import {
  formatHoChiMinhLocalDate,
  requestCodePrefixForServiceType,
  RequestCodeService
} from "../request-code.service";

describe("RequestCodeService", () => {
  it("uses Asia/Ho_Chi_Minh date, service prefixes, and monotonic daily sequence", async () => {
    const repository = new InMemoryRequestCodeRepository([]);
    const service = new RequestCodeService(repository);
    const nearUtcBoundary = new Date("2026-06-25T18:00:00Z");

    expect(formatHoChiMinhLocalDate(nearUtcBoundary)).toBe("2026-06-26");
    expect(requestCodePrefixForServiceType("emergency_rescue")).toBe("EMR");
    expect(requestCodePrefixForServiceType("mobile_repair")).toBe("MOB");
    expect(requestCodePrefixForServiceType("at_home_service")).toBe("HOME");
    expect(requestCodePrefixForServiceType("periodic_maintenance")).toBe("MNT");
    expect(requestCodePrefixForServiceType("other")).toBe("OTH");

    await expect(service.allocate("emergency_rescue", nearUtcBoundary)).resolves.toBe(
      "COR-EMR-20260626-1"
    );
    await expect(service.allocate("emergency_rescue", nearUtcBoundary)).resolves.toBe(
      "COR-EMR-20260626-2"
    );
    await expect(service.allocate("other", nearUtcBoundary)).resolves.toBe("COR-OTH-20260626-1");
  });

  it("allocates unique sequences under concurrent calls", async () => {
    const service = new RequestCodeService(new InMemoryRequestCodeRepository([]));
    const now = new Date("2026-06-25T10:00:00Z");

    const codes = await Promise.all(
      Array.from({ length: 20 }, () => service.allocate("mobile_repair", now))
    );

    expect(new Set(codes).size).toBe(20);
    expect(codes).toContain("COR-MOB-20260625-1");
    expect(codes).toContain("COR-MOB-20260625-20");
  });

  it("surfaces repository conflicts so the service layer can retry request creation", async () => {
    const repository: RequestCodeRepository = {
      async allocateNext() {
        throw new Error("SERVICE_REQUEST_CODE_EXISTS");
      }
    };

    await expect(
      new RequestCodeService(repository).allocate("periodic_maintenance", new Date())
    ).rejects.toThrow("SERVICE_REQUEST_CODE_EXISTS");
  });
});
