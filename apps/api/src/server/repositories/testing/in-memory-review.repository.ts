import type { MechanicProfile } from "../contracts/mechanic.repository";
import type {
  CreateServiceReview,
  ReviewRepository,
  ServiceReview
} from "../contracts/review.repository";

export class InMemoryReviewRepository implements ReviewRepository {
  constructor(
    private readonly reviews: ServiceReview[],
    private readonly mechanicProfiles: MechanicProfile[]
  ) {}

  async createIfAbsent(input: CreateServiceReview) {
    const existing = this.reviews.find((review) => review.assignmentId === input.assignmentId);
    if (existing) return { review: structuredClone(existing), created: false };
    this.reviews.push(structuredClone(input));
    return { review: structuredClone(input), created: true };
  }

  async findByAssignmentForUpdate(assignmentId: string) {
    const review = this.reviews.find((item) => item.assignmentId === assignmentId);
    return review ? structuredClone(review) : undefined;
  }

  async rebuildMechanicRating(mechanicId: string, updatedAt: Date) {
    const profile = this.mechanicProfiles.find((item) => item.userId === mechanicId);
    if (!profile) throw new Error("Mechanic profile not found for rating rebuild.");
    const aggregate = aggregateFor(this.reviews, mechanicId);
    profile.ratingAvg = aggregate.ratingAvg;
    profile.ratingCount = aggregate.ratingCount;
    profile.updatedAt = updatedAt;
    return { mechanicId, ...aggregate };
  }

  async rebuildAllMechanicRatings(updatedAt: Date) {
    for (const profile of this.mechanicProfiles) {
      const aggregate = aggregateFor(this.reviews, profile.userId);
      profile.ratingAvg = aggregate.ratingAvg;
      profile.ratingCount = aggregate.ratingCount;
      profile.updatedAt = updatedAt;
    }
    return this.mechanicProfiles.length;
  }
}

function aggregateFor(reviews: ServiceReview[], mechanicId: string) {
  const ratings = reviews.filter((review) => review.mechanicId === mechanicId).map((review) => review.rating);
  return {
    ratingAvg: ratings.length === 0
      ? 0
      : Math.round((ratings.reduce((total, rating) => total + rating, 0) / ratings.length) * 100) / 100,
    ratingCount: ratings.length
  };
}
