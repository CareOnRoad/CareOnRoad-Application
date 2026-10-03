import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prepareIdempotency } from "@/lib/idempotency";
import { listQuerySchema, toPage } from "@/lib/list-pagination";
import { loadActiveAdminActor } from "@/features/admin/admin.authorization";
import { effectiveDispatchPolicy } from "@/features/admin/admin-configuration.service";
import { dispatchConfigurationEnabled,DEFAULT_DISPATCH_POLICY,type DispatchPolicy } from "@/features/admin/admin-configuration.schemas";
import { adminReasonSchema, adminIdempotencyKeySchema, adminPaginationSchema } from "@/features/admin/admin.schemas";

import type { ApiErrorCode } from "@/lib/api-error";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { requireActorRole } from "@/features/auth/authorization";
import { persistNotification } from "@/features/notifications/notification.service";
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
  service_type?: ServiceRequest["serviceType"];
  scheduled_start_at?: string;
  problem_description?: string;
  address_text?: string;
  location?: ServiceRequest["serviceLocation"];
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

export const MAX_ADMIN_DISPATCH_RETRIES = 3;
const dispatchPageSchema = listQuerySchema.pick({ cursor: true, limit: true }).extend({ limit: adminPaginationSchema.shape.limit }).strict();

export class DispatchService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: DispatchServiceOptions = {}
  ) {}

  async readAdminDispatch(identity: VerifiedSupabaseIdentity, requestId: string, view: "status" | "rounds" | "eligible" | "explanation", input: unknown = {}) {
    requireUuid(requestId);
    const parsed = (view === "status" ? z.object({}).strict() : dispatchPageSchema).safeParse(input);
    if (!parsed.success) throw new DispatchError("INVALID_INPUT", "Dispatch query is invalid.", 400);
    return this.unitOfWork.execute(async (repositories) => {
      await loadActiveAdminActor(identity, repositories.users);
      const request = await repositories.serviceRequests.findByIdForUpdate(requestId);
      if (!request) throw new DispatchError("NOT_FOUND", "Service request not found.", 404);
      const page = dispatchPageSchema.parse(view === "status" ? {} : input);
      if (view === "rounds") {
        const rounds = await repositories.dispatch.listRoundPage(request.id, page.limit, page.cursor);
        const result = toPage(rounds.map((round) => ({ ...round, createdAt: round.startedAt })), page.limit, (round) => toRoundResponse(round));
        return { ...result, page: { ...result.page, limit: page.limit } };
      }
      const rounds = (await repositories.dispatch.listRoundPage(request.id, 64)).sort((a, b) => a.roundNumber - b.roundNumber);
      const now = nowOf(this.options);
      const searchRounds = await currentSearchRounds(repositories, request, rounds);
      const policy = await policyForSearch(repositories, request.status === "manual_escalation" ? [] : searchRounds);
      const blockers = await adminDispatchBlockers(repositories, request, rounds, now);
      const active = rounds.find((r) => r.status === "active");
      const retryAllowed = request.status === "manual_escalation" && !blockers.length;
      const commonBlockers = blockers.filter((code) => !["location_missing", "rider_inactive", "scheduled_start_elapsed", "retry_limit_reached", "history_limit_reached"].includes(code));
      const matching = ["submitted", "dispatching", "offered"].includes(request.status);
      const nextActions = [
        ...(retryAllowed ? ["retry_dispatch"] : []),
        ...(matching && !commonBlockers.length ? ["cancel_dispatch"] : []),
        ...(matching && active && active.expiresAt <= now && !commonBlockers.length ? ["expire_round"] : []),
        ...((matching || request.status === "manual_escalation") && !commonBlockers.length ? ["cancel_request"] : [])
      ];
      const reasonCodes = [...blockers,
        ...((searchRounds.length >= policy["dispatch.max_rounds"] || isTotalWaitExceeded(searchRounds, now, policy)) ? ["search_exhausted"] : []),
        ...(!matching && request.status !== "manual_escalation" ? ["request_state_not_dispatchable"] : [])];
      const summary = { request_id: request.id, request_status: request.status,
        episode_start_round: request.dispatchEpisodeStartRound ?? 1, retry_count: request.dispatchRetryCount ?? 0,
        max_retry_count: MAX_ADMIN_DISPATCH_RETRIES, round_history_count: Math.min(rounds.length, 64), round_history_has_more: rounds.length > 64,
        episode_round_count: searchRounds.length, max_rounds_per_episode: policy["dispatch.max_rounds"],
        reason_codes: reasonCodes, next_action_codes: nextActions, ...(active ? { active_round: toRoundResponse(active) } : {}) };
      if (view === "status") return summary;
      // Retry starts at the first radius. An active episode evaluates its next radius.
      const newEpisode = request.status === "manual_escalation";
      const radiusStep = newEpisode ? 1 : Math.min(searchRounds.length + 1, policy["dispatch.max_rounds"]);
      const rows = await repositories.dispatch.listEligibility({ serviceType: request.serviceType, origin: request.serviceLocation,
        radiusMeters: radiusMetersForStep(policy,radiusStep), now,
        maxLocationAgeSeconds: DISPATCH_LOCATION_MAX_AGE_SECONDS, requestId: request.id,
        episodeStartRound: newEpisode ? (rounds.at(-1)?.roundNumber ?? 0) + 1 : request.dispatchEpisodeStartRound ?? 1,
        scheduledStartAt: request.scheduledStartAt, limit: page.limit, cursor: page.cursor, eligibleOnly: view === "eligible" });
      const result = toPage(rows.map((row) => ({ ...row, id: row.mechanicId })), page.limit, (row) => ({
        mechanic_id: row.mechanicId, eligible: !row.reasonCodes.length,
        reason_codes: row.reasonCodes, ...(row.latestLocation && request.serviceLocation ? { distance_m: row.distanceMeters } : {}),
        rating_avg: row.ratingAvg, rating_count: row.ratingCount
      }));
      const counts: Record<string, number> = {};
      for (const item of result.items) for (const code of item.reason_codes) counts[code] = (counts[code] ?? 0) + 1;
      return { ...summary, evaluation: newEpisode ? "new_episode" : "next_round", radius_m: radiusMetersForStep(policy,radiusStep),
        ...result, page: { ...result.page, limit: page.limit }, ...(view === "explanation" ? { reason_counts: counts, reason_counts_scope: "page" } : {}) };
    });
  }

  async readAdminRound(identity: VerifiedSupabaseIdentity, roundId: string) {
    requireUuid(roundId);
    return this.unitOfWork.execute(async (repositories) => {
      await loadActiveAdminActor(identity, repositories.users);
      const snapshot = await repositories.dispatch.findRoundById(roundId);
      if (!snapshot) throw new DispatchError("NOT_FOUND", "Dispatch round not found.", 404);
      await repositories.serviceRequests.findByIdForUpdate(snapshot.requestId);
      const round = (await repositories.dispatch.findRoundById(roundId))!;
      const candidates = await repositories.dispatch.listCandidatesByRound(round.id, 100);
      return { ...toRoundResponse(round, candidates.slice(0, 100)), candidates_has_more: candidates.length > 100,
        worker_lease_active: Boolean(round.leaseExpiresAt && round.leaseExpiresAt > nowOf(this.options)) };
    });
  }

  async commandAdminDispatch(identity: VerifiedSupabaseIdentity, resourceId: string, action: "retry" | "cancel" | "expire", input: unknown, idempotencyKey: string): Promise<Record<string, unknown>> {
    requireUuid(resourceId);
    const parsed = adminReasonSchema.safeParse(input);
    if (!parsed.success || !adminIdempotencyKeySchema.safeParse(idempotencyKey).success) throw new DispatchError("INVALID_INPUT", "Dispatch command reason/key is invalid.", 400);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const now = nowOf(this.options); const createId = this.options.createId ?? randomUUID;
      const scope = `admin.dispatch.${action}:${resourceId}`;
      const decision = await prepareIdempotency(repositories.idempotency, { actorId: actor.id, scope, idempotencyKey, request: parsed.data,
        expiresAt: new Date(now.getTime() + 86_400_000), id: createId() });
      if (decision.action === "replay") return decision.responseBody;
      if (decision.action !== "execute") throw new DispatchError("CONFLICT", "Idempotency key is conflicting or in progress.", 409);
      const snapshot = action === "expire" ? await repositories.dispatch.findRoundById(resourceId) : undefined;
      if (action === "expire" && !snapshot) throw new DispatchError("NOT_FOUND", "Dispatch round not found.", 404);
      let request = await repositories.serviceRequests.findByIdForUpdate(snapshot?.requestId ?? resourceId);
      if (!request) throw new DispatchError("NOT_FOUND", "Service request not found.", 404);
      await loadActiveAdminActor(identity, repositories.users);
      const rounds = await repositories.dispatch.listRoundsByRequestForUpdate(request.id);
      await repositories.dispatch.listCandidatesByRequestForUpdate(request.id);
      const blockers = await adminDispatchBlockers(repositories, request, rounds, now);
      const common = blockers.filter((code) => !["location_missing", "rider_inactive", "scheduled_start_elapsed", "retry_limit_reached", "history_limit_reached"].includes(code));
      let response: Record<string, unknown>;
      if (action === "retry") {
        if (request.status !== "manual_escalation" || blockers.length) throw new DispatchError("CONFLICT", "Dispatch retry is not allowed.", 409, { reason_codes: blockers });
        await repositories.dispatch.cancelOpenDispatchForRequest({ requestId: request.id, now });
        const startRound = (rounds.at(-1)?.roundNumber ?? 0) + 1;
        request = await repositories.serviceRequests.startDispatchEpisode({ id: request.id, startRound, updatedAt: now });
        assertRequestStatusTransition(request.status, "submitted");
        await repositories.serviceRequests.updateStatus({ id: request.id, status: "submitted", updatedAt: now });
        await repositories.serviceRequests.appendStatusHistory({ id: createId(), requestId: request.id,
          fromStatus: "manual_escalation", toStatus: "submitted", actorId: actor.id, reason: "admin_dispatch_retry", createdAt: now });
        request = { ...request, status: "submitted" };
        const round = await createDispatchRound(repositories, { request, roundNumber: startRound, radiusStep: 1, now, createId, actorId: actor.id, actorRole: "admin" });
        response = { request_id: request.id, request_status: round.candidates.length ? "offered" : "dispatching",
          retry_count: request.dispatchRetryCount, episode_start_round: startRound, round };
        await persistNotification(repositories, { userId: request.riderId, type: "dispatch.search.retried", title: "Đang tìm thợ lại",
          body: "Hệ thống đã mở đợt tìm thợ mới. Yêu cầu chưa được xác nhận.", data: { request_id: request.id, status: response.request_status },
          dedupeKey: `dispatch.search.retried:${request.id}:${startRound}`, requestId: request.id }, now, createId);
      } else {
        if (!["submitted", "dispatching", "offered"].includes(request.status) || common.length) throw new DispatchError("CONFLICT", "Dispatch cannot be stopped in its current state.", 409);
        if (action === "expire") {
          const round = rounds.find((r) => r.id === resourceId);
          if (!round || round.status !== "active" || round.expiresAt > now) throw new DispatchError("CONFLICT", "Only an overdue active round can be expired.", 409);
          await this.expireLockedRound(repositories, round, now);
        }
        await repositories.dispatch.cancelOpenDispatchForRequest({ requestId: request.id, now });
        await this.manualEscalate(repositories, { requestId: request.id, fromStatus: request.status, actorId: actor.id, actorRole: "admin",
          roundId: snapshot?.id ?? rounds.at(-1)?.id, reason: `admin_dispatch_${action}`, now });
        response = { request_id: request.id, request_status: "manual_escalation", ...(snapshot ? { round_id: snapshot.id } : {}) };
        if (request.serviceType !== "periodic_maintenance") await persistNotification(repositories, {
          userId: request.riderId, type: "dispatch.search.needs_support", title: "Yêu cầu cần hỗ trợ tìm thợ",
          body: "Đợt tìm thợ đã dừng để được hỗ trợ. Yêu cầu chưa bị hủy.", data: { request_id: request.id, status: "manual_escalation" },
          dedupeKey: `dispatch.search.needs_support:${request.id}:${request.dispatchEpisodeStartRound ?? 1}`, requestId: request.id
        }, now, createId);
      }
      const occurrenceId = createId(); const topic = `admin.dispatch.${action}`;
      const metadata = { request_id: request.id, change: action, attempt_count: request.dispatchRetryCount ?? 0 };
      await repositories.audit.append({ id: createId(), actorId: actor.id, actorRole: "admin", action: topic,
        entityType: "service_request", entityId: request.id, requestId: request.id, adminReason: parsed.data.reason, metadata, createdAt: now });
      await repositories.outbox.append({ id: occurrenceId, topic, aggregateType: "service_request", aggregateId: request.id,
        dedupeKey: `${topic}:${request.id}:${occurrenceId}`, payload: metadata, createdAt: now, nextAttemptAt: now });
      await repositories.idempotency.complete({ actorId: actor.id, scope, idempotencyKey, responseStatus: action === "retry" ? 202 : 200,
        responseBody: response, resourceType: "service_request", resourceId: request.id, completedAt: now });
      return response;
    });
  }

  async startDispatch(
    identity: VerifiedSupabaseIdentity,
    requestId: string
  ): Promise<DispatchRoundResponse> {
    const outcome = await this.unitOfWork.execute(async (repositories) => {
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
      const rounds = await dispatch.listRoundsByRequestForUpdate(request.id);
      const activeRound = rounds.find((round) => round.status === "active");
      if (activeRound && activeRound.expiresAt.getTime() > nowOf(this.options).getTime()) {
        throw new DispatchError("CONFLICT", "Dispatch already has an active round.", 409);
      }

      const now = nowOf(this.options);
      if (activeRound) {
        if (activeRound.leaseExpiresAt && activeRound.leaseExpiresAt > now) throw new DispatchError("CONFLICT", "Expired round is being processed by a worker.", 409);
        await this.expireLockedRound(repositories, activeRound, now);
      }
      const searchRounds = await currentSearchRounds(repositories, request, rounds);
      const policy = await policyForSearch(repositories, searchRounds);
      if (searchRounds.length >= policy["dispatch.max_rounds"] || isTotalWaitExceeded(searchRounds, now, policy)) {
        await this.manualEscalate(repositories, {
          requestId: request.id,
          fromStatus: request.status,
          actorId: actor.id,
          actorRole: "rider",
          roundId: rounds.at(-1)?.id,
          now,
          reason: "dispatch_rounds_exhausted"
        });
        return null;
      }

      const roundNumber = rounds.length + 1;
      return createDispatchRound(repositories, {
        request,
        roundNumber,
        radiusStep: searchRounds.length + 1,
        now,
        createId: this.options.createId ?? randomUUID,
        actorId: actor.id,
        actorRole: "rider"
      });
    });
    if (!outcome) throw new DispatchError("CONFLICT", "Dispatch rounds are exhausted; request escalated.", 409);
    return outcome;
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
      const searchRounds = await currentSearchRounds(repositories, request, rounds);
      const policy = await policyForSearch(repositories, searchRounds);
      if (searchRounds.length >= policy["dispatch.max_rounds"] || isTotalWaitExceeded(searchRounds, now, policy)) {
        const escalated = await this.manualEscalate(repositories, {
          requestId: request.id,
          fromStatus: request.status,
          roundId: rounds.at(-1)?.id,
          now,
          reason: "dispatch_rounds_exhausted_after_recovery"
        });
        return escalated ? "escalated" : "skipped";
      }

      await createDispatchRound(repositories, {
        request,
        roundNumber: rounds.length + 1,
        radiusStep: searchRounds.length + 1,
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

      await this.expireLockedRound(repositories, round, now);
      const createId = this.options.createId ?? randomUUID;

      const searchRounds = await currentSearchRounds(repositories, request, rounds);
      const policy = await policyForSearch(repositories, searchRounds);
      if (searchRounds.length >= policy["dispatch.max_rounds"] || isTotalWaitExceeded(searchRounds, now, policy)) {
        const escalated = await this.manualEscalate(repositories, {
          requestId: request.id,
          fromStatus: request.status,
          roundId: round.id,
          now,
          reason: "dispatch_rounds_exhausted"
        });
        if (!escalated) return "skipped";
        return "escalated";
      }

      await createDispatchRound(repositories, {
        request,
        roundNumber: round.roundNumber + 1,
        radiusStep: searchRounds.length + 1,
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
      const requests = new Map<string, ServiceRequest | undefined>();
      const items: DispatchCandidateResponse[] = [];
      for (const offer of offers) {
        if (!requests.has(offer.requestId)) requests.set(offer.requestId, await repositories.serviceRequests.findById(offer.requestId));
        const request = requests.get(offer.requestId);
        items.push({ ...toCandidateResponse(offer), ...(request ? {
          service_type: request.serviceType, scheduled_start_at: request.scheduledStartAt?.toISOString(),
          problem_description: request.problemDescription, address_text: request.addressText, location: request.serviceLocation
        } : {}) });
      }
      return { items };
    });
  }

  recallRescueMechanic(identity: VerifiedSupabaseIdentity, requestId: string, mechanicId: string): Promise<DispatchRoundResponse> {
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActor(repositories, identity.subject, "rider");
      const request = await repositories.serviceRequests.findByIdForUpdate(requestId);
      if (!request) throw new DispatchError("NOT_FOUND", "Service request not found.", 404);
      if (request.riderId !== actor.id) throw new DispatchError("FORBIDDEN", "Request ownership is required.", 403);
      if (request.serviceType !== "emergency_rescue" || !["submitted", "dispatching", "offered", "manual_escalation"].includes(request.status)) throw new DispatchError("CONFLICT", "Only an unassigned rescue search may recall a mechanic.", 409);
      if (await repositories.assignments.findActiveByRequestForUpdate(request.id)) throw new DispatchError("CONFLICT", "Resolve the current labor offer before recalling another mechanic.", 409);
      const quotes = await repositories.quotes.listByRequest(request.id);
      let previouslyRejected = false;
      for (const quote of quotes.filter((quote) => quote.purpose === "rescue_labor" && quote.status === "rejected")) {
        const previous = await repositories.assignments.findById(quote.assignmentId);
        if (previous?.mechanicId === mechanicId) previouslyRejected = true;
      }
      if (!previouslyRejected) throw new DispatchError("CONFLICT", "Mechanic has no rider-rejected rescue labor offer for this request.", 409);
      const rounds = await repositories.dispatch.listRoundsByRequestForUpdate(request.id);
      const active = rounds.find((round) => round.status === "active");
      if (active && active.expiresAt > nowOf(this.options)) {
        const candidates = await repositories.dispatch.listCandidatesByRequest(request.id);
        if (candidates.some((candidate) => candidate.roundId === active.id && candidate.mechanicId === mechanicId && candidate.status === "offered")) return toRoundResponse(active, candidates.filter((candidate) => candidate.roundId === active.id));
      }
      const now = nowOf(this.options);
      await repositories.dispatch.cancelOpenDispatchForRequest({ requestId: request.id, now });
      if (request.status === "manual_escalation") {
        assertRequestStatusTransition(request.status, "submitted");
        await repositories.serviceRequests.updateStatus({ id: request.id, status: "submitted", updatedAt: now });
        await repositories.serviceRequests.appendStatusHistory({ id: (this.options.createId ?? randomUUID)(), requestId: request.id, fromStatus: request.status, toStatus: "submitted", actorId: actor.id, reason: "rescue_mechanic_recalled", createdAt: now });
        request.status = "submitted";
      }
      return createDispatchRound(repositories, { request, roundNumber: rounds.length + 1, radiusStep: 4, targetMechanicId: mechanicId, now, createId: this.options.createId ?? randomUUID, actorId: actor.id, actorRole: "rider" });
    });
  }

  async declineOffer(identity: VerifiedSupabaseIdentity, offerId: string): Promise<void> {
    const expired = await this.unitOfWork.execute(async (repositories) => {
      await loadActor(repositories, identity.subject, "mechanic");
      const snapshot = await repositories.dispatch.findCandidateById(offerId);
      if (!snapshot) throw new DispatchError("NOT_FOUND", "Dispatch offer not found.", 404);
      await repositories.serviceRequests.findByIdForUpdate(snapshot.requestId);
      await repositories.dispatch.listRoundsByRequestForUpdate(snapshot.requestId);
      const candidate = await repositories.dispatch.findCandidateByIdForUpdate(offerId);
      const actor = await loadActor(repositories, identity.subject, "mechanic");
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
        await appendDispatchAuditOutbox({ action: "dispatch.candidate.expired", actorId: actor.id, actorRole: "mechanic",
          requestId: candidate.requestId, roundId: candidate.roundId, candidateIds: [candidate.id], audit: repositories.audit,
          outbox: repositories.outbox, now, createId: this.options.createId ?? randomUUID });
        return true;
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
      return false;
    });
    if (expired) throw new DispatchError("CONFLICT", "Dispatch offer has expired.", 409);
  }

  expireRound(roundId: string): Promise<DispatchRoundResponse> {
    return this.unitOfWork.execute(async (repositories) => {
      const snapshot = await repositories.dispatch.findRoundById(roundId);
      if (!snapshot) {
        throw new DispatchError("NOT_FOUND", "Dispatch round not found.", 404);
      }
      const request = await repositories.serviceRequests.findByIdForUpdate(snapshot.requestId);
      const rounds = await repositories.dispatch.listRoundsByRequestForUpdate(snapshot.requestId);
      const round = rounds.find((item) => item.id === roundId);
      if (!round || !request) throw new DispatchError("NOT_FOUND", "Dispatch workflow not found.", 404);
      const now = nowOf(this.options);
      if (round.status !== "active") return toRoundResponse(round, (await repositories.dispatch.listCandidatesByRequest(round.requestId)).filter((item) => item.roundId === round.id));
      if (round.expiresAt > now) throw new DispatchError("CONFLICT", "Dispatch round has not expired.", 409);
      if (round.leaseExpiresAt && round.leaseExpiresAt > now) throw new DispatchError("CONFLICT", "Expired round is being processed by a worker.", 409);
      const { round: updatedRound, candidates: expiredCandidates } = await this.expireLockedRound(repositories, round, now);
      const searchRounds = await currentSearchRounds(repositories, request, rounds);
      const policy = await policyForSearch(repositories, searchRounds);
      if (searchRounds.length >= policy["dispatch.max_rounds"] || isTotalWaitExceeded(searchRounds, now, policy)) {
        await this.manualEscalate(repositories, {
          requestId: request.id,
          fromStatus: request.status,
          roundId: round.id,
          now,
          reason: "dispatch_rounds_exhausted"
        });
      }
      return toRoundResponse(updatedRound, expiredCandidates);
    });
  }

  cancelDispatchForRequest(requestId: string): Promise<void> {
    return this.unitOfWork.execute(async (repositories) => {
      const now = nowOf(this.options);
      await repositories.serviceRequests.findByIdForUpdate(requestId);
      await repositories.dispatch.cancelOpenDispatchForRequest({ requestId, now });
    });
  }

  private async expireLockedRound(repositories: FoundationRepositories, round: DispatchRound, now: Date) {
    const candidates = await repositories.dispatch.updateCandidatesForRoundStatus({ roundId: round.id,
      fromStatuses: ["offered", "pending"], status: "expired", respondedAt: now });
    const updated = await repositories.dispatch.updateRoundStatus({ id: round.id, status: "expired", completedAt: now });
    if (!updated) throw new DispatchError("NOT_FOUND", "Dispatch round not found.", 404);
    await appendDispatchAuditOutbox({ action: "dispatch.round.expired", requestId: round.requestId, roundId: round.id,
      candidateIds: candidates.map((candidate) => candidate.id), audit: repositories.audit, outbox: repositories.outbox,
      now, createId: this.options.createId ?? randomUUID });
    return { round: updated, candidates };
  }

  private async manualEscalate(
    repositories: FoundationRepositories,
    input: {
      requestId: string;
      fromStatus: "submitted" | "dispatching" | "offered" | "assigned" | "mechanic_en_route" | "in_service" | "awaiting_quote_approval" | "awaiting_payment" | "completed" | "manual_escalation" | "canceled";
      actorId?: string;
      actorRole?: AuditActorRole;
      roundId?: string;
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
    const updated = await repositories.serviceRequests.updateStatus({
      id: input.requestId,
      status: "manual_escalation",
      updatedAt: input.now,
      manualEscalationReason: input.reason
    });
    if (!updated) throw new DispatchError("NOT_FOUND", "Service request not found.", 404);
    await repositories.serviceRequests.appendStatusHistory({
      id: (this.options.createId ?? randomUUID)(),
      requestId: input.requestId,
      fromStatus: input.fromStatus,
      toStatus: "manual_escalation",
      actorId: input.actorId,
      reason: input.reason,
      createdAt: input.now
    });
    await appendDispatchAuditOutbox({ action: "dispatch.request.manual_escalated", actorId: input.actorId, actorRole: input.actorRole,
      requestId: input.requestId, roundId: input.roundId ?? input.requestId, candidateIds: [], audit: repositories.audit,
      outbox: repositories.outbox, now: input.now, createId: this.options.createId ?? randomUUID });
    if (updated?.serviceType === "periodic_maintenance") await persistNotification(repositories, {
      userId: updated.riderId, type: "maintenance.booking.needs_support", title: "Chưa tìm được thợ bảo dưỡng",
      body: "Yêu cầu chưa được xác nhận. Mở yêu cầu để kiểm tra và liên hệ hỗ trợ.",
      data: { request_id: updated.id, status: "manual_escalation" },
      dedupeKey: `maintenance.booking.needs_support:${updated.id}`, requestId: updated.id
    }, input.now, this.options.createId ?? randomUUID);
    return true;
  }
}

async function createDispatchRound(
  repositories: FoundationRepositories,
  input: {
    request: ServiceRequest;
    roundNumber: number;
    radiusStep?: number;
    targetMechanicId?: string;
    now: Date;
    createId: () => string;
    actorId?: string;
    actorRole?: AuditActorRole;
  }
): Promise<DispatchRoundResponse> {
  const rounds = await repositories.dispatch.listRoundsByRequestForUpdate(input.request.id);
  const search = await currentSearchRounds(repositories,input.request,rounds);
  const policy = await policyForSearch(repositories,search);
  const radiusMeters = radiusMetersForStep(policy,input.targetMechanicId ? policy["dispatch.radius_steps_km"].length : input.radiusStep ?? input.roundNumber);
  // ponytail: cap user-driven rescue search history at 64 rounds; add a paginated search-cycle model if needed.
  if (input.roundNumber > 64) throw new DispatchError("CONFLICT", "Dispatch history limit reached; contact support.", 409);
  if (!radiusMeters || !input.request.serviceLocation) {
    throw new DispatchError("CONFLICT", "Dispatch cannot create another round.", 409);
  }
  const mechanics = await repositories.dispatch.listEligibility({
    serviceType: input.request.serviceType,
    origin: input.request.serviceLocation,
    radiusMeters: radiusMeters,
    now: input.now,
    maxLocationAgeSeconds: DISPATCH_LOCATION_MAX_AGE_SECONDS,
    requestId: input.request.id, scheduledStartAt: input.request.scheduledStartAt, targetMechanicId: input.targetMechanicId,
    episodeStartRound: input.request.dispatchEpisodeStartRound ?? 1,
    eligibleOnly: true, ranked: true, limit: DISPATCH_CANDIDATE_BATCH_SIZE
  });
  const scheduled = input.request.scheduledStartAt;
  const ranked = rankDispatchCandidates(mechanics, new Map(), DISPATCH_CANDIDATE_BATCH_SIZE);
  if (input.targetMechanicId && !ranked.length) throw new DispatchError("CONFLICT", "The recalled mechanic is unavailable, busy, outside the radius, or has a stale location.", 409);
  const expiresAt = new Date(
    input.now.getTime() + policy["dispatch.offer_expiry_seconds"] * 1000
  );
  const roundId = input.createId();
  const result = await repositories.dispatch.createRoundWithCandidates({
    round: {
      policySnapshot: policy,
      id: roundId,
      requestId: input.request.id,
      roundNumber: input.roundNumber,
      radiusMeters: radiusMeters,
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
  for (const candidate of result.candidates) await persistNotification(repositories, {
      userId: candidate.mechanicId,
      type: input.request.serviceType === "periodic_maintenance" ? "maintenance.offer" : scheduled ? "appointment.offer" : input.request.serviceType === "emergency_rescue" ? "rescue.offer" : "dispatch.offer",
      title: input.request.serviceType === "periodic_maintenance" ? "Có lịch bảo dưỡng cần thợ" : scheduled ? "Có lịch phục vụ cần thợ" : input.request.serviceType === "emergency_rescue" ? "Có yêu cầu cứu hộ gần bạn" : "Có yêu cầu sửa xe gần bạn",
      body: scheduled && input.request.serviceType !== "periodic_maintenance" ? "Xem yêu cầu và xác nhận thời lượng để nhận lịch phục vụ."
        : ["emergency_rescue", "periodic_maintenance"].includes(input.request.serviceType) ? "Xem yêu cầu, nhận lời mời và gửi báo giá tiền công trước khi di chuyển."
        : "Mở yêu cầu và kiểm tra thông tin trước khi nhận việc.",
      data: { request_id: input.request.id, candidate_id: candidate.id,
        ...(input.request.scheduledStartAt ? { scheduled_start_at: input.request.scheduledStartAt.toISOString() } : {}) },
      dedupeKey: `dispatch.offer:${candidate.id}`, requestId: input.request.id
    }, input.now, input.createId);
  return toRoundResponse(result.round, result.candidates);
}

async function currentSearchRounds(repositories: FoundationRepositories, request: ServiceRequest, rounds: DispatchRound[]): Promise<DispatchRound[]> {
  rounds = rounds.filter((round) => round.roundNumber >= (request.dispatchEpisodeStartRound ?? 1));
  if (request.serviceType !== "emergency_rescue") return rounds;
  const rejected = (await repositories.quotes.listByRequest(request.id)).find((quote) => quote.purpose === "rescue_labor" && quote.status === "rejected");
  if (!rejected) return rounds;
  const assignment = await repositories.assignments.findById(rejected.assignmentId);
  const candidate = assignment?.acceptedCandidateId ? await repositories.dispatch.findCandidateById(assignment.acceptedCandidateId) : undefined;
  const rejectedRound = rounds.find((round) => round.id === candidate?.roundId);
  return rejectedRound ? rounds.filter((round) => round.roundNumber > rejectedRound.roundNumber) : rounds;
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

function requireUuid(value: string) {
  if (!z.string().uuid().safeParse(value).success) throw new DispatchError("INVALID_INPUT", "Dispatch identifier must be a UUID.", 400);
}

async function adminDispatchBlockers(repositories: FoundationRepositories, request: ServiceRequest, rounds: DispatchRound[], now: Date): Promise<string[]> {
  const codes: string[] = [];
  if (!request.serviceLocation) codes.push("location_missing");
  const rider = await repositories.users.findActorById(request.riderId);
  if (!rider || rider.status !== "active" || !rider.roles.includes("rider")) codes.push("rider_inactive");
  if (request.scheduledStartAt && request.scheduledStartAt <= now) codes.push("scheduled_start_elapsed");
  if (rounds.some((r) => r.status === "active" && r.leaseExpiresAt && r.leaseExpiresAt > now)) codes.push("worker_lease_active");
  if (await repositories.assignments.findActiveByRequestForUpdate(request.id)) codes.push("active_assignment");
  if (await repositories.payments.hasUnresolvedForRequest({ requestId: request.id })) codes.push("payment_unresolved");
  if (await repositories.quotes.hasOpenByRequest(request.id)) codes.push("quote_commitment");
  if ((request.dispatchRetryCount ?? 0) >= MAX_ADMIN_DISPATCH_RETRIES) codes.push("retry_limit_reached");
  if (rounds.length >= 64 || (rounds.at(-1)?.roundNumber ?? 0) >= 64) codes.push("history_limit_reached");
  return codes;
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

async function policyForSearch(repositories:FoundationRepositories,rounds:DispatchRound[]):Promise<DispatchPolicy> {
  if(!dispatchConfigurationEnabled())return structuredClone(DEFAULT_DISPATCH_POLICY);
  return rounds.length ? structuredClone(rounds[0]!.policySnapshot ?? DEFAULT_DISPATCH_POLICY) : effectiveDispatchPolicy(repositories,true);
}
function radiusMetersForStep(policy:DispatchPolicy,step:number){const steps=policy["dispatch.radius_steps_km"];return Math.round(steps[Math.min(step-1,steps.length-1)]! * 1000);}
function isTotalWaitExceeded(rounds: DispatchRound[], now: Date, policy: DispatchPolicy): boolean {
  const firstStartedAt = rounds[0]?.startedAt;
  if (!firstStartedAt) {
    return false;
  }
  return now.getTime() - firstStartedAt.getTime() >= policy["dispatch.total_wait_seconds"] * 1000;
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
