import type {
  AdminMechanicListInput,
  AdminMechanicPage,
  AdminMechanicPerformance,
  AdminMechanicWorkHistoryPage,
  CreateMechanicProfile,
  GeoPoint,
  MechanicProfile,
  MechanicProfileStatus,
  MechanicRepository,
  UpdateMechanicProfileSettings
} from "../contracts/mechanic.repository";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  type Assignment
} from "../contracts/assignment.repository";

export class InMemoryMechanicRepository implements MechanicRepository {
  constructor(
    private readonly profiles: MechanicProfile[],
    private readonly assignments: Assignment[] = []
  ) {}

  async createProfile(input: CreateMechanicProfile): Promise<MechanicProfile> {
    const profile: MechanicProfile = {
      userId: input.userId,
      profileStatus: input.profileStatus ?? "pending",
      isAvailable: input.isAvailable ?? false,
      serviceRadiusKm: input.serviceRadiusKm,
      availabilityUpdatedAt: input.availabilityUpdatedAt,
      ratingAvg: 0,
      ratingCount: 0,
      serviceTypes: input.serviceTypes ?? [],
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    };
    this.profiles.push(profile);
    return cloneProfile(profile);
  }

  async findProfileByUserId(userId: string): Promise<MechanicProfile | undefined> {
    const profile = this.profiles.find((candidate) => candidate.userId === userId);
    return profile ? cloneProfile(profile) : undefined;
  }

  async findProfileByUserIdForUpdate(userId: string): Promise<MechanicProfile | undefined> {
    return this.findProfileByUserId(userId);
  }

  async updateSettings(input: UpdateMechanicProfileSettings): Promise<MechanicProfile | undefined> {
    const profile = this.profiles.find((candidate) => candidate.userId === input.userId);
    if (!profile) {
      return undefined;
    }
    if (input.serviceRadiusKm !== undefined) {
      profile.serviceRadiusKm = input.serviceRadiusKm;
    }
    if (input.serviceTypes !== undefined) {
      profile.serviceTypes = [...input.serviceTypes];
    }
    profile.updatedAt = input.updatedAt;
    return cloneProfile(profile);
  }

  async updateAvailability(
    userId: string,
    isAvailable: boolean,
    updatedAt: Date
  ): Promise<MechanicProfile | undefined> {
    const profile = this.profiles.find((candidate) => candidate.userId === userId);
    if (!profile) {
      return undefined;
    }
    profile.isAvailable = isAvailable;
    profile.availabilityUpdatedAt = updatedAt;
    profile.updatedAt = updatedAt;
    return cloneProfile(profile);
  }

  async updateLocation(
    userId: string,
    location: GeoPoint,
    updatedAt: Date
  ): Promise<MechanicProfile | undefined> {
    const profile = this.profiles.find((candidate) => candidate.userId === userId);
    if (!profile) {
      return undefined;
    }
    profile.latestLocation = { ...location };
    profile.locationUpdatedAt = updatedAt;
    profile.updatedAt = updatedAt;
    return cloneProfile(profile);
  }

  async listAdminProfiles(input: AdminMechanicListInput): Promise<AdminMechanicPage> {
    const filtered = this.profiles
      .filter(
        (profile) =>
          !input.profileStatus || profile.profileStatus === input.profileStatus
      )
      .filter(
        (profile) =>
          !input.serviceType || profile.serviceTypes.includes(input.serviceType)
      )
      .filter(
        (profile) =>
          input.isAvailable === undefined ||
          profile.isAvailable === input.isAvailable
      )
      .filter((profile) => {
        if (!input.locationFreshness) return true;
        return locationFreshness(profile, input.now) === input.locationFreshness;
      })
      .filter((profile) => {
        if (!input.workState) return true;
        const active = this.hasActiveAssignment(profile.userId);
        return input.workState === "active_assignment" ? active : !active;
      })
      .sort(compareProfileDesc)
      .filter(
        (profile) =>
          !input.cursor ||
          compareDateIdDesc(
            profile.updatedAt,
            profile.userId,
            input.cursor.timestamp,
            input.cursor.id
          ) > 0
      );
    const page = filtered.slice(0, input.limit + 1);
    const items = page.slice(0, input.limit).map((profile) => ({
      ...cloneProfile(profile),
      hasActiveAssignment: this.hasActiveAssignment(profile.userId)
    }));
    const last = items.at(-1);
    return {
      items,
      ...(page.length > input.limit && last
        ? { nextCursor: { timestamp: last.updatedAt, id: last.userId } }
        : {})
    };
  }

  async updateProfileStatus(
    userId: string,
    profileStatus: MechanicProfileStatus,
    updatedAt: Date
  ): Promise<MechanicProfile | undefined> {
    const profile = this.profiles.find((candidate) => candidate.userId === userId);
    if (!profile) return undefined;
    profile.profileStatus = profileStatus;
    profile.updatedAt = updatedAt;
    return cloneProfile(profile);
  }

  async listAdminWorkHistory(input: {
    mechanicId: string;
    limit: number;
    cursor?: { timestamp: Date; id: string };
  }): Promise<AdminMechanicWorkHistoryPage> {
    const filtered = this.assignments
      .filter((assignment) => assignment.mechanicId === input.mechanicId)
      .sort((left, right) =>
        compareDateIdDesc(left.createdAt, left.id, right.createdAt, right.id)
      )
      .filter(
        (assignment) =>
          !input.cursor ||
          compareDateIdDesc(
            assignment.createdAt,
            assignment.id,
            input.cursor.timestamp,
            input.cursor.id
          ) > 0
      );
    const page = filtered.slice(0, input.limit + 1);
    const items = page.slice(0, input.limit).map((assignment) => ({
      id: assignment.id,
      requestId: assignment.requestId,
      status: assignment.status,
      acceptedAt: new Date(assignment.acceptedAt),
      ...(assignment.startedAt
        ? { startedAt: new Date(assignment.startedAt) }
        : {}),
      ...(assignment.completedAt
        ? { completedAt: new Date(assignment.completedAt) }
        : {}),
      ...(assignment.canceledAt
        ? { canceledAt: new Date(assignment.canceledAt) }
        : {}),
      createdAt: new Date(assignment.createdAt),
      updatedAt: new Date(assignment.updatedAt)
    }));
    const last = items.at(-1);
    return {
      items,
      ...(page.length > input.limit && last
        ? { nextCursor: { timestamp: last.createdAt, id: last.id } }
        : {})
    };
  }

  async getAdminPerformance(
    mechanicId: string
  ): Promise<AdminMechanicPerformance | undefined> {
    const profile = this.profiles.find((candidate) => candidate.userId === mechanicId);
    if (!profile) return undefined;
    const assignments = this.assignments.filter(
      (assignment) => assignment.mechanicId === mechanicId
    );
    return {
      totalAssignments: assignments.length,
      activeAssignments: assignments.filter((assignment) =>
        isActiveStatus(assignment.status)
      ).length,
      completedAssignments: assignments.filter(
        (assignment) => assignment.status === "completed"
      ).length,
      canceledAssignments: assignments.filter(
        (assignment) => assignment.status === "canceled"
      ).length,
      ratingAvg: profile.ratingAvg,
      ratingCount: profile.ratingCount
    };
  }

  private hasActiveAssignment(mechanicId: string): boolean {
    return this.assignments.some(
      (assignment) =>
        assignment.mechanicId === mechanicId && isActiveStatus(assignment.status)
    );
  }
}

function isActiveStatus(status: Assignment["status"]): boolean {
  return ACTIVE_ASSIGNMENT_STATUSES.includes(
    status as (typeof ACTIVE_ASSIGNMENT_STATUSES)[number]
  );
}

function locationFreshness(profile: MechanicProfile, now: Date) {
  if (!profile.locationUpdatedAt) return "missing";
  return now.getTime() - profile.locationUpdatedAt.getTime() <= 300_000
    ? "fresh"
    : "stale";
}

function compareProfileDesc(left: MechanicProfile, right: MechanicProfile) {
  return compareDateIdDesc(
    left.updatedAt,
    left.userId,
    right.updatedAt,
    right.userId
  );
}

function compareDateIdDesc(
  leftDate: Date,
  leftId: string,
  rightDate: Date,
  rightId: string
) {
  return rightDate.getTime() - leftDate.getTime() || rightId.localeCompare(leftId);
}

function cloneProfile(profile: MechanicProfile): MechanicProfile {
  return {
    ...profile,
    latestLocation: profile.latestLocation ? { ...profile.latestLocation } : undefined,
    locationUpdatedAt: profile.locationUpdatedAt ? new Date(profile.locationUpdatedAt) : undefined,
    availabilityUpdatedAt: new Date(profile.availabilityUpdatedAt),
    serviceTypes: [...profile.serviceTypes],
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt)
  };
}
