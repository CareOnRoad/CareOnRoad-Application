import { randomUUID } from "node:crypto";

import { requireActorRole } from "@/features/auth/authorization";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { prepareIdempotency } from "@/lib/idempotency";
import type { MechanicRatingAggregate, ServiceReview } from "@/server/repositories/contracts/review.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { ReviewError } from "./review.errors";
import { assignmentReviewIdSchema, createReviewSchema } from "./review.schemas";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type ReviewResponse = {
  id: string;
  assignment_id: string;
  request_id: string;
  mechanic_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  mechanic_rating: { average: number; count: number };
};

export class ReviewService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: { now?: () => Date; createId?: () => string } = {}
  ) {}

  async createReview(
    identity: VerifiedSupabaseIdentity,
    assignmentId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<ReviewResponse> {
    validateIdempotencyKey(idempotencyKey);
    if (!assignmentReviewIdSchema.safeParse(assignmentId).success) {
      throw new ReviewError("INVALID_INPUT", "Assignment id must be a valid UUID.", 400);
    }
    const parsed = createReviewSchema.safeParse(input);
    if (!parsed.success) {
      throw new ReviewError("INVALID_INPUT", "Review input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }
    const now = this.options.now?.() ?? new Date();
    const createId = this.options.createId ?? randomUUID;
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await repositories.users.findActorById(identity.subject);
      if (!actor) throw notFound();
      requireActorRole(
        {
          id: actor.id,
          ...(actor.displayName ? { display_name: actor.displayName } : {}),
          roles: actor.roles,
          status: actor.status
        },
        "rider"
      );

      const assignment = await repositories.assignments.findByIdForUpdate(assignmentId);
      if (!assignment || assignment.mechanicId === actor.id) throw notFound();
      const request = await repositories.serviceRequests.findByIdForUpdate(assignment.requestId);
      if (!request || request.riderId !== actor.id) throw notFound();
      if (assignment.status !== "completed" || request.status !== "completed") {
        throw new ReviewError(
          "CONFLICT",
          "A review can only be created after assignment completion.",
          409
        );
      }

      const scope = `POST /api/v1/assignments/${assignmentId}/review`;
      const decision = await prepareIdempotency(repositories.idempotency, {
        actorId: actor.id,
        scope,
        idempotencyKey: idempotencyKey.trim(),
        request: parsed.data,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        id: createId()
      });
      if (decision.action === "conflict") throw conflict("Idempotency key payload mismatch.");
      if (decision.action === "in_progress") throw conflict("Idempotency key is already in progress.");
      if (decision.action === "replay") return decision.responseBody as ReviewResponse;

      const result = await repositories.reviews.createIfAbsent({
        id: createId(),
        assignmentId: assignment.id,
        requestId: assignment.requestId,
        riderId: actor.id,
        mechanicId: assignment.mechanicId,
        rating: parsed.data.rating,
        ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
        createdAt: now
      });
      if (!sameReviewPayload(result.review, parsed.data.rating, parsed.data.comment)) {
        throw conflict("This assignment already has an immutable review.");
      }

      let aggregate: MechanicRatingAggregate;
      if (result.created) {
        aggregate = await repositories.reviews.rebuildMechanicRating(assignment.mechanicId, now);
        await appendReviewAuditOutbox(repositories, result.review, now, createId);
      } else {
        const profile = await repositories.mechanics.findProfileByUserId(assignment.mechanicId);
        if (!profile) throw new Error("Mechanic profile not found for review replay.");
        aggregate = {
          mechanicId: profile.userId,
          ratingAvg: profile.ratingAvg,
          ratingCount: profile.ratingCount
        };
      }
      const response = toReviewResponse(result.review, aggregate);
      await repositories.idempotency.complete({
        actorId: actor.id,
        scope,
        idempotencyKey: idempotencyKey.trim(),
        responseStatus: 201,
        responseBody: response as unknown as Record<string, unknown>,
        resourceType: "service_review",
        resourceId: result.review.id,
        completedAt: now
      });
      return response;
    });
  }
}

function sameReviewPayload(review: ServiceReview, rating: number, comment?: string): boolean {
  return review.rating === rating && review.comment === comment;
}

function toReviewResponse(
  review: ServiceReview,
  aggregate: MechanicRatingAggregate
): ReviewResponse {
  return {
    id: review.id,
    assignment_id: review.assignmentId,
    request_id: review.requestId,
    mechanic_id: review.mechanicId,
    rating: review.rating,
    ...(review.comment ? { comment: review.comment } : {}),
    created_at: review.createdAt.toISOString(),
    mechanic_rating: { average: aggregate.ratingAvg, count: aggregate.ratingCount }
  };
}

async function appendReviewAuditOutbox(
  repositories: FoundationRepositories,
  review: ServiceReview,
  now: Date,
  createId: () => string
): Promise<void> {
  const payload = {
    review_id: review.id,
    assignment_id: review.assignmentId,
    request_id: review.requestId,
    mechanic_id: review.mechanicId,
    rating: review.rating
  };
  const eventId = createId();
  await repositories.outbox.append({
    id: eventId,
    topic: "review.created",
    aggregateType: "service_review",
    aggregateId: review.id,
    dedupeKey: `review.created:${review.id}`,
    payload,
    createdAt: now,
    nextAttemptAt: now
  });
  await repositories.audit.append({
    id: createId(),
    actorId: review.riderId,
    actorRole: "rider",
    action: "review.created",
    entityType: "service_review",
    entityId: review.id,
    requestId: review.requestId,
    metadata: payload,
    createdAt: now
  });
}

function validateIdempotencyKey(key: string): void {
  const normalized = key.trim();
  if (normalized.length < 8 || normalized.length > 200) {
    throw new ReviewError("INVALID_INPUT", "X-Idempotency-Key is required.", 400);
  }
}

function notFound(): ReviewError {
  return new ReviewError("NOT_FOUND", "Completed assignment not found.", 404);
}

function conflict(message: string): ReviewError {
  return new ReviewError("CONFLICT", message, 409);
}
