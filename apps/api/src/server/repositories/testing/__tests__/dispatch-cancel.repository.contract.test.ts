import { describe, expect, it } from "vitest";

import { InMemoryDispatchRepository } from "../in-memory-dispatch.repository";

const now = new Date("2026-06-25T05:00:00Z");

describe("in-memory dispatch cancellation repository contract", () => {
  it("closes every open row once and preserves historical terminal rows", async () => {
    const rounds = [
      round("active-round", "active"),
      round("expired-round", "expired")
    ];
    const candidates = [
      candidate("pending", "active-round", "pending"),
      candidate("offered", "expired-round", "offered"),
      candidate("accepted", "active-round", "accepted"),
      candidate("expired", "expired-round", "expired")
    ];
    const repository = new InMemoryDispatchRepository(rounds, candidates, []);

    await expect(
      repository.cancelOpenDispatchForRequest({ requestId: "request", now })
    ).resolves.toEqual({ canceledRounds: 1, canceledCandidates: 2 });
    await expect(
      repository.cancelOpenDispatchForRequest({ requestId: "request", now })
    ).resolves.toEqual({ canceledRounds: 0, canceledCandidates: 0 });
    expect(rounds.map((item) => item.status)).toEqual(["canceled", "expired"]);
    expect(candidates.map((item) => item.status)).toEqual([
      "cancelled",
      "cancelled",
      "accepted",
      "expired"
    ]);
  });
});

function round(id: string, status: "active" | "expired") {
  return {
    id,
    requestId: "request",
    roundNumber: id === "active-round" ? 1 : 2,
    radiusMeters: 2000,
    status,
    startedAt: now,
    expiresAt: now
  };
}

function candidate(
  id: string,
  roundId: string,
  status: "pending" | "offered" | "accepted" | "expired"
) {
  return {
    id,
    roundId,
    requestId: "request",
    mechanicId: `mechanic-${id}`,
    rank: 1,
    status,
    createdAt: now
  };
}
