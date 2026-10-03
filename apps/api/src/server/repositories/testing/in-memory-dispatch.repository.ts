import {
  distanceMeters,
  isDispatchLocationFresh
} from "@/features/dispatch/dispatch-ranking";

import type {
  CreateDispatchCandidate,
  CreateDispatchRound,
  DispatchCandidate,
  DispatchCandidateMechanic,
  DispatchCandidateStatus,
  DispatchRepository,
  DispatchRound,
  DispatchRoundStatus
} from "../contracts/dispatch.repository";
import type { MechanicProfile } from "../contracts/mechanic.repository";
import type { ApplicationUser, UserRoleRecord } from "../contracts/user.repository";
import type { Assignment } from "../contracts/assignment.repository";
import type { DispatchEligibility, DispatchEligibilityInput } from "../contracts/dispatch.repository";
import type { PageCursor } from "@/lib/list-pagination";
import { rankDispatchCandidates } from "@/features/dispatch/dispatch-ranking";

export class InMemoryDispatchRepository implements DispatchRepository {
  constructor(
    private readonly rounds: DispatchRound[],
    private readonly candidates: DispatchCandidate[],
    private readonly mechanicProfiles: MechanicProfile[],
    private readonly users: ApplicationUser[] = [],
    private readonly userRoles: UserRoleRecord[] = [],
    private readonly assignments: Assignment[] = []
  ) {}

  async listRoundPage(requestId: string, limit: number, cursor?: PageCursor): Promise<DispatchRound[]> {
    return (await this.listRoundsByRequest(requestId)).filter((row) => !cursor || row.startedAt < cursor.timestamp ||
      (row.startedAt.getTime() === cursor.timestamp.getTime() && row.id < cursor.id))
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || b.id.localeCompare(a.id)).slice(0, limit + 1);
  }

  async listCandidatesByRound(roundId: string, limit: number): Promise<DispatchCandidate[]> {
    return this.candidates.filter((row) => row.roundId === roundId).sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id)).slice(0, limit + 1).map(cloneCandidate);
  }

  async listEligibility(input: DispatchEligibilityInput): Promise<DispatchEligibility[]> {
    const start = input.scheduledStartAt ? input.scheduledStartAt.getTime() - 30 * 60_000 : input.now.getTime();
    const end = (input.scheduledStartAt ?? input.now).getTime() + ((input.scheduledStartAt ? 15 : 120) + 30) * 60_000;
    const rows: DispatchEligibility[] = this.mechanicProfiles.filter((p) => !input.targetMechanicId || p.userId === input.targetMechanicId).map((p) => {
      const reasonCodes: string[] = [];
      const add = (condition: boolean, code: string) => { if (condition) reasonCodes.push(code); };
      const work = this.assignments.filter((a) => a.mechanicId === p.userId && !["completed", "canceled", "recovery_canceled"].includes(a.status));
      const distance = input.origin && p.latestLocation ? distanceMeters(input.origin, p.latestLocation) : undefined;
      add(!this.users.some((u) => u.id === p.userId && u.status === "active"), "user_inactive");
      add(!this.userRoles.some((r) => r.userId === p.userId && r.role === "mechanic"), "mechanic_role_missing");
      add(p.profileStatus !== "active", "profile_inactive"); add(!p.isAvailable, "unavailable");
      add(!p.serviceTypes.includes(input.serviceType), "skill_mismatch"); add(!p.latestLocation, "location_missing");
      add(!isDispatchLocationFresh(p.locationUpdatedAt, input.now, input.maxLocationAgeSeconds), "location_stale");
      add(distance !== undefined && (distance > input.radiusMeters || distance > p.serviceRadiusKm * 1000), "outside_radius");
      add(distance === undefined, "request_or_mechanic_location_missing");
      add(!input.scheduledStartAt && work.some((a) => !a.scheduledStartAt || Boolean(a.activatedAt)), "current_work");
      add(work.some((a) => Boolean(a.reservationStartAt && a.reservationEndAt && a.reservationStartAt.getTime() < end && a.reservationEndAt.getTime() > start)), "reservation_conflict");
      add(!input.targetMechanicId && this.candidates.some((c) => c.requestId === input.requestId && c.mechanicId === p.userId &&
        (input.serviceType !== "emergency_rescue" || c.status !== "cancelled") &&
        this.rounds.some((r) => r.id === c.roundId && r.roundNumber >= (input.episodeStartRound ?? 1))), "already_contacted");
      return { mechanicId: p.userId, serviceTypes: p.serviceTypes, isAvailable: p.isAvailable, profileStatus: p.profileStatus,
        serviceRadiusKm: p.serviceRadiusKm, latestLocation: p.latestLocation, locationUpdatedAt: p.locationUpdatedAt,
        availabilityUpdatedAt: p.availabilityUpdatedAt, ratingAvg: p.ratingAvg, ratingCount: p.ratingCount,
        distanceMeters: distance ?? 0, createdAt: p.createdAt, reasonCodes };
    }).filter((row) => !input.eligibleOnly || row.reasonCodes.length === 0)
      .filter((row) => !input.cursor || row.createdAt < input.cursor.timestamp || (row.createdAt.getTime() === input.cursor.timestamp.getTime() && row.mechanicId < input.cursor.id));
    if (input.ranked) {
      const order = new Map(rankDispatchCandidates(rows, new Map(), rows.length).map((row, index) => [row.mechanicId, index]));
      rows.sort((a, b) => order.get(a.mechanicId)! - order.get(b.mechanicId)!);
    } else rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.mechanicId.localeCompare(a.mechanicId));
    return rows.slice(0, input.limit + 1);
  }

  async listRoundsByRequest(requestId: string): Promise<DispatchRound[]> {
    return this.rounds
      .filter((round) => round.requestId === requestId)
      .sort((left, right) => left.roundNumber - right.roundNumber)
      .map(cloneRound);
  }

  async listRoundsByRequestForUpdate(requestId: string): Promise<DispatchRound[]> {
    return this.listRoundsByRequest(requestId);
  }

  async findRoundById(roundId: string): Promise<DispatchRound | undefined> {
    const round = this.rounds.find((candidate) => candidate.id === roundId);
    return round ? cloneRound(round) : undefined;
  }

  async findActiveRoundByRequest(requestId: string): Promise<DispatchRound | undefined> {
    const round = this.rounds.find(
      (candidate) => candidate.requestId === requestId && candidate.status === "active"
    );
    return round ? cloneRound(round) : undefined;
  }

  async claimExpiredRounds(input: {
    now: Date;
    leaseOwner: string;
    leaseUntil: Date;
    limit: number;
  }): Promise<DispatchRound[]> {
    const due = this.rounds
      .filter((round) => round.status === "active")
      .filter((round) => round.expiresAt.getTime() <= input.now.getTime())
      .filter(
        (round) =>
          !round.leaseExpiresAt || round.leaseExpiresAt.getTime() <= input.now.getTime()
      )
      .sort(
        (left, right) =>
          left.expiresAt.getTime() - right.expiresAt.getTime() ||
          left.id.localeCompare(right.id)
      )
      .slice(0, input.limit);
    for (const round of due) {
      round.leaseOwner = input.leaseOwner;
      round.leaseExpiresAt = input.leaseUntil;
    }
    return due.map(cloneRound);
  }

  async releaseRoundClaim(input: { id: string; leaseOwner: string }): Promise<boolean> {
    const round = this.rounds.find(
      (item) => item.id === input.id && item.leaseOwner === input.leaseOwner
    );
    if (!round) return false;
    round.leaseOwner = undefined;
    round.leaseExpiresAt = undefined;
    round.failureCount = (round.failureCount ?? 0) + 1;
    return true;
  }

  async createRoundWithCandidates(input: {
    round: CreateDispatchRound;
    candidates: CreateDispatchCandidate[];
  }): Promise<{ round: DispatchRound; candidates: DispatchCandidate[] }> {
    if (
      this.rounds.some(
        (round) =>
          round.requestId === input.round.requestId &&
          round.roundNumber === input.round.roundNumber
      )
    ) {
      throw new Error("DISPATCH_ROUND_EXISTS");
    }
    const round: DispatchRound = {
      ...input.round,
      status: input.round.status ?? "active"
    };
    const candidates = input.candidates.map((candidate) => {
      if (
        this.candidates.some(
          (existing) =>
            existing.roundId === candidate.roundId &&
            existing.mechanicId === candidate.mechanicId
        )
      ) {
        throw new Error("DISPATCH_CANDIDATE_EXISTS");
      }
      return {
        ...candidate,
        status: candidate.status ?? "offered"
      };
    });
    this.rounds.push(round);
    this.candidates.push(...candidates);
    return { round: cloneRound(round), candidates: candidates.map(cloneCandidate) };
  }

  async updateRoundStatus(input: {
    id: string;
    status: DispatchRoundStatus;
    completedAt?: Date;
  }): Promise<DispatchRound | undefined> {
    const round = this.rounds.find((candidate) => candidate.id === input.id);
    if (!round) {
      return undefined;
    }
    round.status = input.status;
    round.completedAt = input.completedAt;
    if (input.status !== "active") {
      round.leaseOwner = undefined;
      round.leaseExpiresAt = undefined;
    }
    return cloneRound(round);
  }

  async findCandidateByIdForUpdate(id: string): Promise<DispatchCandidate | undefined> {
    return this.findCandidateById(id);
  }

  async findCandidateById(id: string): Promise<DispatchCandidate | undefined> {
    const candidate = this.candidates.find((item) => item.id === id);
    return candidate ? cloneCandidate(candidate) : undefined;
  }

  async listCandidatesByRequest(requestId: string): Promise<DispatchCandidate[]> {
    return this.candidates
      .filter((candidate) => candidate.requestId === requestId)
      .sort((left, right) => left.rank - right.rank)
      .map(cloneCandidate);
  }

  async listCandidatesByRequestForUpdate(
    requestId: string
  ): Promise<DispatchCandidate[]> {
    return this.listCandidatesByRequest(requestId);
  }

  async listCandidatesByMechanic(mechanicId: string, now: Date): Promise<DispatchCandidate[]> {
    return this.candidates
      .filter((candidate) => candidate.mechanicId === mechanicId)
      .filter((candidate) => candidate.status === "offered")
      .filter((candidate) => !candidate.expiresAt || candidate.expiresAt.getTime() > now.getTime())
      .sort((left, right) => left.expiresAt!.getTime() - right.expiresAt!.getTime())
      .map(cloneCandidate);
  }

  async updateCandidateStatus(input: {
    id: string;
    status: DispatchCandidateStatus;
    respondedAt?: Date;
  }): Promise<DispatchCandidate | undefined> {
    const candidate = this.candidates.find((item) => item.id === input.id);
    if (!candidate) {
      return undefined;
    }
    candidate.status = input.status;
    candidate.respondedAt = input.respondedAt;
    return cloneCandidate(candidate);
  }

  async updateCandidatesForRoundStatus(input: {
    roundId: string;
    fromStatuses: DispatchCandidateStatus[];
    status: DispatchCandidateStatus;
    respondedAt?: Date;
  }): Promise<DispatchCandidate[]> {
    const updated: DispatchCandidate[] = [];
    for (const candidate of this.candidates) {
      if (candidate.roundId === input.roundId && input.fromStatuses.includes(candidate.status)) {
        candidate.status = input.status;
        candidate.respondedAt = input.respondedAt;
        updated.push(cloneCandidate(candidate));
      }
    }
    return updated;
  }

  async updateOtherCandidatesForRequestStatus(input: {
    requestId: string;
    exceptCandidateId: string;
    fromStatuses: DispatchCandidateStatus[];
    status: DispatchCandidateStatus;
    respondedAt?: Date;
  }): Promise<DispatchCandidate[]> {
    const updated: DispatchCandidate[] = [];
    for (const candidate of this.candidates) {
      if (
        candidate.requestId === input.requestId &&
        candidate.id !== input.exceptCandidateId &&
        input.fromStatuses.includes(candidate.status)
      ) {
        candidate.status = input.status;
        candidate.respondedAt = input.respondedAt;
        updated.push(cloneCandidate(candidate));
      }
    }
    return updated;
  }

  async cancelOpenDispatchForRequest(input: {
    requestId: string;
    now: Date;
  }): Promise<{ canceledRounds: number; canceledCandidates: number }> {
    let canceledRounds = 0;
    let canceledCandidates = 0;
    for (const round of this.rounds) {
      if (round.requestId === input.requestId && round.status === "active") {
        round.status = "canceled";
        round.completedAt = input.now;
        round.leaseOwner = undefined;
        round.leaseExpiresAt = undefined;
        canceledRounds += 1;
      }
    }
    for (const candidate of this.candidates) {
      if (
        candidate.requestId === input.requestId &&
        ["pending", "offered"].includes(candidate.status)
      ) {
        candidate.status = "cancelled";
        candidate.respondedAt = input.now;
        canceledCandidates += 1;
      }
    }
    return { canceledRounds, canceledCandidates };
  }

  async findCandidateMechanics(input: {
    serviceType: DispatchCandidateMechanic["serviceTypes"][number];
    origin: { latitude: number; longitude: number };
    radiusMeters: number;
    now: Date;
    maxLocationAgeSeconds: number;
  }): Promise<DispatchCandidateMechanic[]> {
    return this.mechanicProfiles
      .filter((profile) => this.users.some((user) => user.id === profile.userId && user.status === "active") &&
        this.userRoles.some((role) => role.userId === profile.userId && role.role === "mechanic"))
      .filter((profile) => profile.profileStatus === "active")
      .filter((profile) => profile.isAvailable)
      .filter((profile) => profile.serviceTypes.includes(input.serviceType))
      .filter((profile) =>
        isDispatchLocationFresh(profile.locationUpdatedAt, input.now, input.maxLocationAgeSeconds)
      )
      .filter((profile) => profile.latestLocation)
      .map((profile) => ({
        mechanicId: profile.userId,
        serviceTypes: [...profile.serviceTypes],
        isAvailable: profile.isAvailable,
        profileStatus: profile.profileStatus,
        serviceRadiusKm: profile.serviceRadiusKm,
        latestLocation: profile.latestLocation ? { ...profile.latestLocation } : undefined,
        locationUpdatedAt: profile.locationUpdatedAt
          ? new Date(profile.locationUpdatedAt)
          : undefined,
        availabilityUpdatedAt: new Date(profile.availabilityUpdatedAt),
        ratingAvg: profile.ratingAvg,
        ratingCount: profile.ratingCount,
        distanceMeters: distanceMeters(input.origin, profile.latestLocation!)
      }))
      .filter((profile) => profile.distanceMeters <= input.radiusMeters)
      .filter((profile) => profile.distanceMeters <= profile.serviceRadiusKm * 1000);
  }
}

function cloneRound(round: DispatchRound): DispatchRound {
  return {
    ...round,
    startedAt: new Date(round.startedAt),
    expiresAt: new Date(round.expiresAt),
    completedAt: round.completedAt ? new Date(round.completedAt) : undefined,
    leaseExpiresAt: round.leaseExpiresAt ? new Date(round.leaseExpiresAt) : undefined
  };
}

function cloneCandidate(candidate: DispatchCandidate): DispatchCandidate {
  return {
    ...candidate,
    offeredAt: candidate.offeredAt ? new Date(candidate.offeredAt) : undefined,
    expiresAt: candidate.expiresAt ? new Date(candidate.expiresAt) : undefined,
    respondedAt: candidate.respondedAt ? new Date(candidate.respondedAt) : undefined,
    createdAt: new Date(candidate.createdAt)
  };
}
