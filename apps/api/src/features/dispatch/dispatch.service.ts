import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { requireActorRole } from "@/features/auth/authorization";
import type {
  DispatchCandidate,
  DispatchRound
} from "@/server/repositories/contracts/dispatch.repository";
import type { AuditActorRole } from "@/server/repositories/contracts/audit.repository";
import type { ServiceRequest } from "@/server/repositories/contracts/service-request.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { assertRequestStatusTransition } from "../service-requests/service-request-state";
import {
  DISPATCH_CANDIDATE_BATCH_SIZE,
  DISPATCH_LOCATION_MAX_AGE_SECONDS,
  DISPATCH_MAX_ROUNDS,
  DISPATCH_OFFER_EXPIRY_SECONDS,
  DISPATCH_RADIUS_STEPS_KM,
  DISPATCH_TOTAL_WAIT_SECONDS,
  rankDispatchCandidates
} from "./dispatch-ranking";

export type DispatchRoundResponse = {
  id: string;
  request_id: string;
  round_number: number;
  radius_m: number;
  status: DispatchRound["status"];
  expires_at: string;
  candidates: DispatchCandidateResponse[];
};

export type DispatchCandidateResponse = {
  id: string;
  round_id: string;
  request_id: string;
  mechanic_id: string;
  rank: number;
  distance_m?: number;
  status: DispatchCandidate["status"];
  expires_at?: string;
};

export type ProcessClaimedDispatchRoundResult = "advanced" | "escalated" | "skipped";
export type RestartRecoveredDispatchResult =
  | "started"
  | "already_started"
  | "escalated"
  | "skipped";

export type DispatchServiceOptions = {
  now?: () => Date;
  createId?: () => string;
  hasActiveAssignment?: (requestId: string) => Promise<boolean>;
};

export class DispatchService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: DispatchServiceOptions = {}
  ) {}

  async startDispatch(
    identity: VerifiedSupabaseIdentity,
    requestId: string
  ): Promise<DispatchRoundResponse> {
    return this.unitOfWork.execute(async (repositories) => {
      const { dispatch, serviceRequests } = repositories;
      const actor = await loadActor(repositories, identity.subject, "rider");
      const request = await serviceRequests.findByIdForUpdate(requestId);
      if (!request) {
        throw new DispatchError("NOT_FOUND", "Service request not found.", 404);
      }
      if (request.riderId !== actor.id) {
        throw new DispatchError("FORBIDDEN", "Service request ownership is required.", 403);
      }
      if (!request.serviceLocation) {
        throw new DispatchError("INVALID_INPUT", "Dispatch requires a request location.", 400);
      }
      if (await this.options.hasActiveAssignment?.(request.id)) {
        throw new DispatchError("CONFLICT", "The service request already has an active assignment.", 409);
      }
      if (!["submitted", "dispatching", "offered"].includes(request.status)) {
        throw new DispatchError("CONFLICT", "Service request cannot be dispatched in its current state.", 409);
      }
      const activeRound = await dispatch.findActiveRoundByRequest(request.id);
      if (activeRound && activeRound.expiresAt.getTime() > nowOf(this.options).getTime()) {
        throw new DispatchError("CONFLICT", "Dispatch already has an active round.", 409);
      }

      const now = nowOf(this.options);
      const rounds = await dispatch.listRoundsByRequest(request.id);
      if (rounds.length >= DISPATCH_MAX_ROUNDS || isTotalWaitExceeded(rounds, now)) {
        await this.manualEscalate(repositories, {
          requestId: request.id,
          fromStatus: request.status,
          actorId: actor.id,
          now,
          reason: "dispatch_rounds_exhausted"
        });
        throw new DispatchError("CONFLICT", "Dispatch rounds are exhausted; request escalated.", 409);
      }

      const roundNumber = rounds.length + 1;
      return createDispatchRound(repositories, {
        request,
        roundNumber,
        now,
        createId: this.options.createId ?? randomUUID,
        actorId: actor.id,
        actorRole: "rider"
      });
    });
  }

  restartRecoveredRequest(requestId: string): Promise<RestartRecoveredDispatchResult> {
    return this.unitOfWork.execute(async (repositories) => {
      const request = await repositories.serviceRequests.findByIdForUpdate(requestId);
      if (!request) return "skipped";
      const rounds = await repositories.dispatch.listRoundsByRequestForUpdate(request.id);
      await repositories.dispatch.listCandidatesByRequestForUpdate(request.id);
      if (["dispatching", "offered", "assigned", "mechanic_en_route", "in_service"].includes(request.status)) {
        return "already_started";
      }
      if (request.status !== "submitted") return "skipped";
      if (await repositories.assignments.findActiveByRequestForUpdate(request.id)) {
        return "already_started";
      }
      const activeRound = rounds.find((round) => round.status === "active");
      if (activeRound) return "already_started";

      const now = nowOf(this.options);
      const createId = this.options.createId ?? randomUUID;
      if (rounds.length >= DISPATCH_MAX_ROUNDS || isTotalWaitExceeded(rounds, now)) {
        const escalated = await this.manualEscalate(repositories, {
          requestId: request.id,
          fromStatus: request.status,
          now,
          reason: "dispatch_rounds_exhausted_after_recovery"
        });
        if (escalated) {
          await appendDispatchAuditOutbox({
            action: "dispatch.request.manual_escalated",
            requestId: request.id,
            roundId: rounds.at(-1)?.id ?? request.id,
            candidateIds: [],
            audit: repositories.audit,
            outbox: repositories.outbox,
            now,
            createId
          });
        }
        return escalated ? "escalated" : "skipped";
      }

      await createDispatchRound(repositories, {
        request,
        roundNumber: rounds.length + 1,
        now,
        createId
      });
      return "started";
    });
  }

  processClaimedRound(
    roundId: string,
    leaseOwner: string
  ): Promise<ProcessClaimedDispatchRoundResult> {
    return this.unitOfWork.execute(async (repositories) => {
      const snapshot = await repositories.dispatch.findRoundById(roundId);
      if (!snapshot) return "skipped";
      const request = await repositories.serviceRequests.findByIdForUpdate(snapshot.requestId);
      if (!request) return "skipped";
      const rounds = await repositories.dispatch.listRoundsByRequestForUpdate(request.id);
      await repositories.dispatch.listCandidatesByRequestForUpdate(request.id);
      const round = rounds.find((item) => item.id === roundId);
      const now = nowOf(this.options);
      if (
        !round ||
        round.status !== "active" ||
        round.leaseOwner !== leaseOwner ||
        round.expiresAt.getTime() > now.getTime()
      ) {
        return "skipped";
      }
      if (!["dispatching", "offered"].includes(request.status)) {
        await repositories.dispatch.releaseRoundClaim({ id: round.id, leaseOwner });
        return "skipped";
      }

      const expiredCandidates = await repositories.dispatch.updateCandidatesForRoundStatus({
        roundId: round.id,
        fromStatuses: ["pending", "offered"],
        status: "expired",
        respondedAt: now
      });
      await repositories.dispatch.updateRoundStatus({
        id: round.id,
        status: "expired",
        completedAt: now
      });
      const createId = this.options.createId ?? randomUUID;
      await appendDispatchAuditOutbox({
        action: "dispatch.round.expired",
        requestId: request.id,
        roundId: round.id,
        candidateIds: expiredCandidates.map((candidate) => candidate.id),
        audit: repositories.audit,
        outbox: repositories.outbox,
        now,
        createId
      });

      if (rounds.length >= DISPATCH_MAX_ROUNDS || isTotalWaitExceeded(rounds, now)) {
        const escalated = await this.manualEscalate(repositories, {
          requestId: request.id,
          fromStatus: request.status,
          now,
          reason: "dispatch_rounds_exhausted"
        });
        if (!escalated) return "skipped";
        await appendDispatchAuditOutbox({
          action: "dispatch.request.manual_escalated",
          requestId: request.id,
          roundId: round.id,
          candidateIds: [],
          audit: repositories.audit,
          outbox: repositories.outbox,
          now,
          createId
        });
        return "escalated";
      }

      await createDispatchRound(repositories, {
        request,
        roundNumber: round.roundNumber + 1,
        now,
        createId
      });
      return "advanced";
    });
  }

  listMyOffers(identity: VerifiedSupabaseIdentity): Promise<{ items: DispatchCandidateResponse[] }> {
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActor(repositories, identity.subject, "mechanic");
      const offers = await repositories.dispatch.listCandidatesByMechanic(
        actor.id,
        nowOf(this.options)
      );
      return { items: offers.map(toCandidateResponse) };
    });
  }

  declineOffer(identity: VerifiedSupabaseIdentity, offerId: string): Promise<void> {
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActor(repositories, identity.subject, "mechanic");
      const candidate = await repositories.dispatch.findCandidateByIdForUpdate(offerId);
      if (!candidate) {
        throw new DispatchError("NOT_FOUND", "Dispatch offer not found.", 404);
      }
      if (candidate.mechanicId !== actor.id) {
        throw new DispatchError("FORBIDDEN", "Dispatch offer is not assigned to this mechanic.", 403);
      }
      const now = nowOf(this.options);
      if (candidate.status !== "offered") {
        throw new DispatchError("CONFLICT", "Dispatch offer is not open.", 409);
      }
      if (!candidate.expiresAt || candidate.expiresAt.getTime() <= now.getTime()) {
        await repositories.dispatch.updateCandidateStatus({
          id: candidate.id,
          status: "expired",
          respondedAt: now
        });
        throw new DispatchError("CONFLICT", "Dispatch offer has expired.", 409);
      }
      await repositories.dispatch.updateCandidateStatus({
        id: candidate.id,
        status: "rejected",
        respondedAt: now
      });
      await appendDispatchAuditOutbox({
        action: "dispatch.candidate.rejected",
        actorId: actor.id,
        actorRole: "mechanic",
        requestId: candidate.requestId,
        roundId: candidate.roundId,
        candidateIds: [candidate.id],
        audit: repositories.audit,
        outbox: repositories.outbox,
        now,
        createId: this.options.createId ?? randomUUID
      });
    });
  }

  expireRound(roundId: string): Promise<DispatchRoundResponse> {
    return this.unitOfWork.execute(async (repositories) => {
      const round = await repositories.dispatch.findRoundById(roundId);
      if (!round) {
        throw new DispatchError("NOT_FOUND", "Dispatch round not found.", 404);
      }
      const now = nowOf(this.options);
      const expiredCandidates = await repositories.dispatch.updateCandidatesForRoundStatus({
        roundId: round.id,
        fromStatuses: ["offered", "pending"],
        status: "expired",
        respondedAt: now
      });
      const updatedRound = await repositories.dispatch.updateRoundStatus({
        id: round.id,
        status: "expired",
        completedAt: now
      });
      if (!updatedRound) {
        throw new DispatchError("NOT_FOUND", "Dispatch round not found.", 404);
      }
      const request = await repositories.serviceRequests.findByIdForUpdate(round.requestId);
      if (request) {
        const rounds = await repositories.dispatch.listRoundsByRequest(request.id);
        if (rounds.length >= DISPATCH_MAX_ROUNDS || isTotalWaitExceeded(rounds, now)) {
          await this.manualEscalate(repositories, {
            requestId: request.id,
            fromStatus: request.status,
            now,
            reason: "dispatch_rounds_exhausted"
          });
        }
      }
      await appendDispatchAuditOutbox({
        action: "dispatch.round.expired",
        requestId: round.requestId,
        roundId: round.id,
        candidateIds: expiredCandidates.map((candidate) => candidate.id),
        audit: repositories.audit,
        outbox: repositories.outbox,
        now,
        createId: this.options.createId ?? randomUUID
      });
      return toRoundResponse(updatedRound, expiredCandidates);
    });
  }

  cancelDispatchForRequest(requestId: string): Promise<void> {
    return this.unitOfWork.execute(async (repositories) => {
      const now = nowOf(this.options);
      const rounds = await repositories.dispatch.listRoundsByRequest(requestId);
      const activeRounds = rounds.filter((round) => round.status === "active");
      for (const round of activeRounds) {
        await repositories.dispatch.updateCandidatesForRoundStatus({
          roundId: round.id,
          fromStatuses: ["offered", "pending"],
          status: "cancelled",
          respondedAt: now
        });
        await repositories.dispatch.updateRoundStatus({
          id: round.id,
          status: "canceled",
          completedAt: now
        });
      }
    });
  }

  private async manualEscalate(
    repositories: FoundationRepositories,
    input: {
      requestId: string;
      fromStatus: "submitted" | "dispatching" | "offered" | "assigned" | "mechanic_en_route" | "in_service" | "awaiting_quote_approval" | "awaiting_payment" | "completed" | "manual_escalation" | "canceled";
      actorId?: string;
      now: Date;
      reason: string;
    }
  ): Promise<boolean> {
    if (input.fromStatus === "manual_escalation") {
      return false;
    }
    if (!["submitted", "dispatching", "offered"].includes(input.fromStatus)) {
      return false;
    }
    assertRequestStatusTransition(input.fromStatus, "manual_escalation");
    await repositories.serviceRequests.updateStatus({
      id: input.requestId,
      status: "manual_escalation",
      updatedAt: input.now,
      manualEscalationReason: input.reason
    });
    await repositories.serviceRequests.appendStatusHistory({
      id: (this.options.createId ?? randomUUID)(),
      requestId: input.requestId,
      fromStatus: input.fromStatus,
      toStatus: "manual_escalation",
      actorId: input.actorId,
      reason: input.reason,
      createdAt: input.now
    });
    return true;
  }
}

async function createDispatchRound(
  repositories: FoundationRepositories,
  input: {
    request: ServiceRequest;
    roundNumber: number;
    now: Date;
    createId: () => string;
    actorId?: string;
    actorRole?: AuditActorRole;
  }
): Promise<DispatchRoundResponse> {
  const radiusKm = DISPATCH_RADIUS_STEPS_KM[input.roundNumber - 1];
  if (!radiusKm || !input.request.serviceLocation) {
    throw new DispatchError("CONFLICT", "Dispatch cannot create another round.", 409);
  }
  const mechanics = await repositories.dispatch.findCandidateMechanics({
    serviceType: input.request.serviceType,
    origin: input.request.serviceLocation,
    radiusMeters: radiusKm * 1000,
    now: input.now,
    maxLocationAgeSeconds: DISPATCH_LOCATION_MAX_AGE_SECONDS
  });
  const existingCandidates = await repositories.dispatch.listCandidatesByRequest(
    input.request.id
  );
  const existingMechanicIds = new Set(
    existingCandidates.map((candidate) => candidate.mechanicId)
  );
  const newMechanics = mechanics.filter(
    (mechanic) => !existingMechanicIds.has(mechanic.mechanicId)
  );
  const activeWorkloads = await repositories.assignments.listActiveWorkloadsByMechanicIds(
    newMechanics.map((mechanic) => mechanic.mechanicId)
  );
  const workloads = new Map(
    activeWorkloads.map((workload) => [
      workload.mechanicId,
      { activeWorkloadCount: workload.activeAssignmentCount }
    ])
  );
  const ranked = rankDispatchCandidates(
    newMechanics,
    workloads,
    DISPATCH_CANDIDATE_BATCH_SIZE
  );
  const expiresAt = new Date(
    input.now.getTime() + DISPATCH_OFFER_EXPIRY_SECONDS * 1000
  );
  const roundId = input.createId();
  const result = await repositories.dispatch.createRoundWithCandidates({
    round: {
      id: roundId,
      requestId: input.request.id,
      roundNumber: input.roundNumber,
      radiusMeters: radiusKm * 1000,
      startedAt: input.now,
      expiresAt
    },
    candidates: ranked.map((mechanic, index) => ({
      id: input.createId(),
      roundId,
      requestId: input.request.id,
      mechanicId: mechanic.mechanicId,
      rank: index + 1,
      distanceMeters: mechanic.distanceMeters,
      status: "offered",
      offeredAt: input.now,
      expiresAt,
      createdAt: input.now
    }))
  });

  let currentStatus = input.request.status;
  if (currentStatus === "submitted") {
    assertRequestStatusTransition(currentStatus, "dispatching");
    await repositories.serviceRequests.updateStatus({
      id: input.request.id,
      status: "dispatching",
      updatedAt: input.now
    });
    await repositories.serviceRequests.appendStatusHistory({
      id: input.createId(),
      requestId: input.request.id,
      fromStatus: currentStatus,
      toStatus: "dispatching",
      actorId: input.actorId,
      reason: "dispatch_started",
      createdAt: input.now
    });
    currentStatus = "dispatching";
  }
  if (result.candidates.length > 0 && currentStatus === "dispatching") {
    assertRequestStatusTransition("dispatching", "offered");
    await repositories.serviceRequests.updateStatus({
      id: input.request.id,
      status: "offered",
      updatedAt: input.now
    });
    await repositories.serviceRequests.appendStatusHistory({
      id: input.createId(),
      requestId: input.request.id,
      fromStatus: "dispatching",
      toStatus: "offered",
      actorId: input.actorId,
      reason: "dispatch_offers_created",
      createdAt: input.now
    });
  }

  await appendDispatchAuditOutbox({
    action: "dispatch.round.started",
    actorId: input.actorId,
    actorRole: input.actorRole,
    requestId: input.request.id,
    roundId: result.round.id,
    candidateIds: result.candidates.map((candidate) => candidate.id),
    audit: repositories.audit,
    outbox: repositories.outbox,
    now: input.now,
    createId: input.createId
  });
  return toRoundResponse(result.round, result.candidates);
}

export class DispatchError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "ACTOR_SUSPENDED"
    >,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DispatchError";
  }
}

async function loadActor(
  repositories: FoundationRepositories,
  actorId: string,
  role: "rider" | "mechanic"
) {
  const actor = await repositories.users.findActorById(actorId);
  if (!actor) {
    throw new DispatchError("NOT_FOUND", "Application profile not found.", 404);
  }
  requireActorRole(
    {
      id: actor.id,
      ...(actor.displayName ? { display_name: actor.displayName } : {}),
      roles: actor.roles,
      status: actor.status
    },
    role
  );
  return actor;
}

async function appendDispatchAuditOutbox(input: {
  action: string;
  actorId?: string;
  actorRole?: AuditActorRole;
  requestId: string;
  roundId: string;
  candidateIds: string[];
  audit: FoundationRepositories["audit"];
  outbox: FoundationRepositories["outbox"];
  now: Date;
  createId: () => string;
}): Promise<void> {
  const occurrenceId = input.createId();
  const payload = {
    request_id: input.requestId,
    round_id: input.roundId,
    candidate_count: input.candidateIds.length,
    candidate_ids: input.candidateIds
  };
  await input.outbox.append({
    id: occurrenceId,
    topic: input.action,
    aggregateType: "dispatch",
    aggregateId: input.roundId,
    dedupeKey: `${input.action}:${input.roundId}:${occurrenceId}`,
    payload,
    createdAt: input.now,
    nextAttemptAt: input.now
  });
  await input.audit.append({
    id: input.createId(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: "dispatch_round",
    entityId: input.roundId,
    requestId: input.requestId,
    metadata: payload,
    createdAt: input.now
  });
}

function isTotalWaitExceeded(rounds: DispatchRound[], now: Date): boolean {
  const firstStartedAt = rounds[0]?.startedAt;
  if (!firstStartedAt) {
    return false;
  }
  return now.getTime() - firstStartedAt.getTime() >= DISPATCH_TOTAL_WAIT_SECONDS * 1000;
}

function nowOf(options: Pick<DispatchServiceOptions, "now">): Date {
  return options.now?.() ?? new Date();
}

function toRoundResponse(
  round: DispatchRound,
  candidates: DispatchCandidate[] = []
): DispatchRoundResponse {
  return {
    id: round.id,
    request_id: round.requestId,
    round_number: round.roundNumber,
    radius_m: round.radiusMeters,
    status: round.status,
    expires_at: round.expiresAt.toISOString(),
    candidates: candidates.map(toCandidateResponse)
  };
}

function toCandidateResponse(candidate: DispatchCandidate): DispatchCandidateResponse {
  return {
    id: candidate.id,
    round_id: candidate.roundId,
    request_id: candidate.requestId,
    mechanic_id: candidate.mechanicId,
    rank: candidate.rank,
    ...(candidate.distanceMeters !== undefined ? { distance_m: candidate.distanceMeters } : {}),
    status: candidate.status,
    ...(candidate.expiresAt ? { expires_at: candidate.expiresAt.toISOString() } : {})
  };
}
