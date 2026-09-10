export type AssignmentLiveLocation = {
  assignmentId: string;
  mechanicId: string;
  latitude: number;
  longitude: number;
  observedAt: Date;
  accuracyMeters: number;
  receivedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertAssignmentLiveLocation = AssignmentLiveLocation;

export interface LiveTrackingRepository {
  findByAssignmentIdForUpdate(assignmentId: string): Promise<AssignmentLiveLocation | undefined>;
  findCurrentByAssignmentId(
    assignmentId: string,
    now: Date
  ): Promise<AssignmentLiveLocation | undefined>;
  upsert(input: UpsertAssignmentLiveLocation): Promise<{
    location: AssignmentLiveLocation;
    created: boolean;
  }>;
  deleteExpired(now: Date, limit: number): Promise<number>;
}
