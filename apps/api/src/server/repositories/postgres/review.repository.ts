import type { TransactionSql } from "postgres";

import type {
  CreateServiceReview,
  MechanicRatingAggregate,
  ReviewRepository,
  ServiceReview
} from "../contracts/review.repository";

type ReviewRow = {
  id: string;
  assignment_id: string;
  request_id: string;
  rider_id: string;
  mechanic_id: string;
  rating: number;
  comment: string | null;
  created_at: Date;
};

export class PostgresReviewRepository implements ReviewRepository {
  constructor(private readonly sql: TransactionSql) {}

  async createIfAbsent(input: CreateServiceReview) {
    const inserted = await this.sql<ReviewRow[]>`
      insert into service_reviews (
        id, assignment_id, request_id, rider_id, mechanic_id, rating, comment, created_at
      ) values (
        ${input.id}, ${input.assignmentId}, ${input.requestId}, ${input.riderId},
        ${input.mechanicId}, ${input.rating}, ${input.comment ?? null}, ${input.createdAt}
      )
      on conflict (assignment_id) do nothing
      returning *
    `;
    if (inserted[0]) return { review: mapReview(inserted[0]), created: true };
    const existing = await this.findByAssignmentForUpdate(input.assignmentId);
    if (!existing) throw new Error("Review conflict did not return the canonical row.");
    return { review: existing, created: false };
  }

  async findByAssignmentForUpdate(assignmentId: string) {
    const rows = await this.sql<ReviewRow[]>`
      select * from service_reviews where assignment_id = ${assignmentId} for update
    `;
    return rows[0] ? mapReview(rows[0]) : undefined;
  }

  async rebuildMechanicRating(mechanicId: string, updatedAt: Date) {
    const rows = await this.sql<{
      user_id: string;
      rating_avg: string;
      rating_count: number;
    }[]>`
      update mechanic_profiles profile
      set
        rating_avg = coalesce((
          select round(avg(review.rating)::numeric, 2)
          from service_reviews review
          where review.mechanic_id = ${mechanicId}
        ), 0),
        rating_count = (
          select count(*)::integer
          from service_reviews review
          where review.mechanic_id = ${mechanicId}
        ),
        updated_at = ${updatedAt}
      where profile.user_id = ${mechanicId}
      returning user_id, rating_avg::text, rating_count
    `;
    if (!rows[0]) throw new Error("Mechanic profile not found for rating rebuild.");
    return mapAggregate(rows[0]);
  }

  async rebuildAllMechanicRatings(updatedAt: Date) {
    const rows = await this.sql<{ user_id: string }[]>`
      update mechanic_profiles profile
      set
        rating_avg = coalesce((
          select round(avg(review.rating)::numeric, 2)
          from service_reviews review
          where review.mechanic_id = profile.user_id
        ), 0),
        rating_count = (
          select count(*)::integer
          from service_reviews review
          where review.mechanic_id = profile.user_id
        ),
        updated_at = ${updatedAt}
      returning user_id
    `;
    return rows.length;
  }
}

function mapReview(row: ReviewRow): ServiceReview {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    requestId: row.request_id,
    riderId: row.rider_id,
    mechanicId: row.mechanic_id,
    rating: row.rating,
    ...(row.comment ? { comment: row.comment } : {}),
    createdAt: row.created_at
  };
}

function mapAggregate(row: { user_id: string; rating_avg: string; rating_count: number }): MechanicRatingAggregate {
  return {
    mechanicId: row.user_id,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count
  };
}
