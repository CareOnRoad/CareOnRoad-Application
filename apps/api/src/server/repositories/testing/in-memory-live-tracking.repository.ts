import type {
  AssignmentLiveLocation,
  LiveTrackingRepository,
  UpsertAssignmentLiveLocation
} from "../contracts/live-tracking.repository";

export class InMemoryLiveTrackingRepository implements LiveTrackingRepository {
  constructor(private readonly locations: AssignmentLiveLocation[]) {}

  async findByAssignmentIdForUpdate(
    assignmentId: string
  ): Promise<AssignmentLiveLocation | undefined> {
    const location = this.locations.find((item) => item.assignmentId === assignmentId);
    return location ? clone(location) : undefined;
  }

  async findCurrentByAssignmentId(
    assignmentId: string,
    now: Date
  ): Promise<AssignmentLiveLocation | undefined> {
    const location = this.locations.find(
      (item) => item.assignmentId === assignmentId && item.expiresAt.getTime() > now.getTime()
    );
    return location ? clone(location) : undefined;
  }

  async upsert(input: UpsertAssignmentLiveLocation) {
    const existing = this.locations.find((item) => item.assignmentId === input.assignmentId);
    if (existing) {
      const createdAt = existing.createdAt;
      Object.assign(existing, clone(input), { createdAt });
      return { location: clone(existing), created: false };
    }
    const location = clone(input);
    this.locations.push(location);
    return { location: clone(location), created: true };
  }

  async deleteExpired(now: Date, limit: number): Promise<number> {
    const eligible = this.locations
      .filter((item) => item.expiresAt.getTime() <= now.getTime())
      .sort((left, right) =>
        left.expiresAt.getTime() - right.expiresAt.getTime() ||
        left.assignmentId.localeCompare(right.assignmentId)
      )
      .slice(0, limit);
    const ids = new Set(eligible.map((item) => item.assignmentId));
    for (let index = this.locations.length - 1; index >= 0; index -= 1) {
      if (ids.has(this.locations[index]!.assignmentId)) {
        this.locations.splice(index, 1);
      }
    }
    return eligible.length;
  }
}

function clone(location: AssignmentLiveLocation): AssignmentLiveLocation {
  return {
    ...location,
    observedAt: new Date(location.observedAt),
    receivedAt: new Date(location.receivedAt),
    expiresAt: new Date(location.expiresAt),
    createdAt: new Date(location.createdAt),
    updatedAt: new Date(location.updatedAt)
  };
}
