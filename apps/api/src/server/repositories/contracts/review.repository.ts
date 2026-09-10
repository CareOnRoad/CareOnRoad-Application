export type ServiceReview = {
  id: string;
  assignmentId: string;
  requestId: string;
  riderId: string;
  mechanicId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
};

export type CreateServiceReview = ServiceReview;

export type MechanicRatingAggregate = {
  mechanicId: string;
  ratingAvg: number;
  ratingCount: number;
};

export interface ReviewRepository {
  createIfAbsent(input: CreateServiceReview): Promise<{
    review: ServiceReview;
    created: boolean;
  }>;
  findByAssignmentForUpdate(assignmentId: string): Promise<ServiceReview | undefined>;
  rebuildMechanicRating(mechanicId: string, updatedAt: Date): Promise<MechanicRatingAggregate>;
  rebuildAllMechanicRatings(updatedAt: Date): Promise<number>;
}
