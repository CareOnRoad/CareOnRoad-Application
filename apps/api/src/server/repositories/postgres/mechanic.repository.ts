import type { TransactionSql } from "postgres";

import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";

import type {
  AdminMechanicListInput,
  AdminMechanicPage,
  AdminMechanicPerformance,
  AdminMechanicWorkHistoryPage,
  CreateMechanicProfile,
  GeoPoint,
  MechanicProfile,
  MechanicRepository,
  MechanicProfileStatus,
  UpdateMechanicProfileSettings
} from "../contracts/mechanic.repository";
import { ACTIVE_ASSIGNMENT_STATUSES } from "../contracts/assignment.repository";
import type { AssignmentStatus } from "../contracts/assignment.repository";

type MechanicProfileRow = {
  user_id: string;
  profile_status: MechanicProfileStatus;
  is_available: boolean;
  service_radius_km: string;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: Date | null;
  availability_updated_at: Date;
  rating_avg: string;
  rating_count: number;
  service_types: ServiceType[] | null;
  created_at: Date;
  updated_at: Date;
  has_active_assignment?: boolean;
};

type AssignmentHistoryRow = {
  id: string;
  request_id: string;
  status: AssignmentStatus;
  accepted_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  canceled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class PostgresMechanicRepository implements MechanicRepository {
  constructor(private readonly sql: TransactionSql) {}

  async createProfile(input: CreateMechanicProfile): Promise<MechanicProfile> {
    await this.sql`
      insert into mechanic_profiles (
        user_id, profile_status, is_available, service_radius_km,
        availability_updated_at, created_at, updated_at
      )
      values (
        ${input.userId}, ${input.profileStatus ?? "pending"},
        ${input.isAvailable ?? false}, ${input.serviceRadiusKm},
        ${input.availabilityUpdatedAt}, ${input.createdAt}, ${input.updatedAt}
      )
    `;
    await this.replaceSkills(input.userId, input.serviceTypes ?? []);
    const profile = await this.findProfileByUserId(input.userId);
    if (!profile) {
      throw new Error("Mechanic profile insert did not return a profile.");
    }
    return profile;
  }

  async findProfileByUserId(userId: string): Promise<MechanicProfile | undefined> {
    const rows = await this.sql<MechanicProfileRow[]>`
      select
        profile.user_id,
        profile.profile_status,
        profile.is_available,
        profile.service_radius_km::text,
        case
          when profile.latest_location is null then null
          else ST_Y(profile.latest_location::geometry)
        end as latitude,
        case
          when profile.latest_location is null then null
          else ST_X(profile.latest_location::geometry)
        end as longitude,
        profile.location_updated_at,
        profile.availability_updated_at,
        profile.rating_avg::text,
        profile.rating_count,
        coalesce(
          array_agg(skills.service_type::text order by skills.service_type)
            filter (where skills.service_type is not null),
          array[]::text[]
        ) as service_types,
        profile.created_at,
        profile.updated_at
      from mechanic_profiles profile
      left join mechanic_skills skills on skills.mechanic_id = profile.user_id
      where profile.user_id = ${userId}
      group by profile.user_id
      limit 1
    `;
    return rows[0] ? mapProfile(rows[0]) : undefined;
  }

  async findProfileByUserIdForUpdate(userId: string): Promise<MechanicProfile | undefined> {
    const rows = await this.sql<{ user_id: string }[]>`
      select user_id
      from mechanic_profiles
      where user_id = ${userId}
      for update
      limit 1
    `;
    if (!rows[0]) {
      return undefined;
    }
    return this.findProfileByUserId(userId);
  }

  async updateSettings(input: UpdateMechanicProfileSettings): Promise<MechanicProfile | undefined> {
    if (input.serviceRadiusKm !== undefined) {
      await this.sql`
        update mechanic_profiles
        set service_radius_km = ${input.serviceRadiusKm}, updated_at = ${input.updatedAt}
        where user_id = ${input.userId}
      `;
    } else {
      await this.sql`
        update mechanic_profiles
        set updated_at = ${input.updatedAt}
        where user_id = ${input.userId}
      `;
    }

    if (input.serviceTypes !== undefined) {
      await this.replaceSkills(input.userId, input.serviceTypes);
    }

    return this.findProfileByUserId(input.userId);
  }

  async updateAvailability(
    userId: string,
    isAvailable: boolean,
    updatedAt: Date
  ): Promise<MechanicProfile | undefined> {
    await this.sql`
      update mechanic_profiles
      set
        is_available = ${isAvailable},
        availability_updated_at = ${updatedAt},
        updated_at = ${updatedAt}
      where user_id = ${userId}
    `;
    return this.findProfileByUserId(userId);
  }

  async updateLocation(
    userId: string,
    location: GeoPoint,
    updatedAt: Date
  ): Promise<MechanicProfile | undefined> {
    await this.sql`
      update mechanic_profiles
      set
        latest_location = ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography,
        location_updated_at = ${updatedAt},
        updated_at = ${updatedAt}
      where user_id = ${userId}
    `;
    return this.findProfileByUserId(userId);
  }

  async listAdminProfiles(input: AdminMechanicListInput): Promise<AdminMechanicPage> {
    const activeStatuses = [...ACTIVE_ASSIGNMENT_STATUSES];
    const rows = await this.sql<MechanicProfileRow[]>`
      select
        profile.user_id,
        profile.profile_status,
        profile.is_available,
        profile.service_radius_km::text,
        case
          when profile.latest_location is null then null
          else ST_Y(profile.latest_location::geometry)
        end as latitude,
        case
          when profile.latest_location is null then null
          else ST_X(profile.latest_location::geometry)
        end as longitude,
        profile.location_updated_at,
        profile.availability_updated_at,
        profile.rating_avg::text,
        profile.rating_count,
        coalesce(
          array_agg(skills.service_type::text order by skills.service_type)
            filter (where skills.service_type is not null),
          array[]::text[]
        ) as service_types,
        profile.created_at,
        profile.updated_at,
        exists (
          select 1
          from assignments assignment
          where assignment.mechanic_id = profile.user_id
            and assignment.status in ${this.sql(activeStatuses)}
            and (assignment.scheduled_start_at is null or assignment.activated_at is not null)
        ) as has_active_assignment
      from mechanic_profiles profile
      left join mechanic_skills skills on skills.mechanic_id = profile.user_id
      where (
          ${input.profileStatus ?? null}::mechanic_profile_status is null
          or profile.profile_status = ${input.profileStatus ?? null}
        )
        and (
          ${input.serviceType ?? null}::service_type is null
          or exists (
            select 1
            from mechanic_skills filter_skill
            where filter_skill.mechanic_id = profile.user_id
              and filter_skill.service_type = ${input.serviceType ?? null}
          )
        )
        and (
          ${input.isAvailable ?? null}::boolean is null
          or profile.is_available = ${input.isAvailable ?? null}
        )
        and (
          ${input.locationFreshness ?? null}::text is null
          or (
            ${input.locationFreshness ?? null} = 'missing'
            and profile.location_updated_at is null
          )
          or (
            ${input.locationFreshness ?? null} = 'fresh'
            and profile.location_updated_at >= ${input.now} - interval '300 seconds'
          )
          or (
            ${input.locationFreshness ?? null} = 'stale'
            and profile.location_updated_at is not null
            and profile.location_updated_at < ${input.now} - interval '300 seconds'
          )
        )
        and (
          ${input.workState ?? null}::text is null
          or (
            ${input.workState ?? null} = 'active_assignment'
            and exists (
              select 1 from assignments assignment
              where assignment.mechanic_id = profile.user_id
                and assignment.status in ${this.sql(activeStatuses)}
            and (assignment.scheduled_start_at is null or assignment.activated_at is not null)
            )
          )
          or (
            ${input.workState ?? null} = 'idle'
            and not exists (
              select 1 from assignments assignment
              where assignment.mechanic_id = profile.user_id
                and assignment.status in ${this.sql(activeStatuses)}
            and (assignment.scheduled_start_at is null or assignment.activated_at is not null)
            )
          )
        )
        and (
          ${input.cursor?.timestamp ?? null}::timestamptz is null
          or (profile.updated_at, profile.user_id) <
             (${input.cursor?.timestamp ?? null}, ${input.cursor?.id ?? null}::uuid)
        )
      group by profile.user_id
      order by profile.updated_at desc, profile.user_id desc
      limit ${input.limit + 1}
    `;
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        ...mapProfile(row),
        hasActiveAssignment: Boolean(row.has_active_assignment)
      })),
      ...(rows.length > input.limit && last
        ? { nextCursor: { timestamp: last.updated_at, id: last.user_id } }
        : {})
    };
  }

  async updateProfileStatus(
    userId: string,
    profileStatus: MechanicProfileStatus,
    updatedAt: Date
  ): Promise<MechanicProfile | undefined> {
    const rows = await this.sql<{ user_id: string }[]>`
      update mechanic_profiles
      set profile_status = ${profileStatus}, updated_at = ${updatedAt}
      where user_id = ${userId}
      returning user_id
    `;
    return rows[0] ? this.findProfileByUserId(userId) : undefined;
  }

  async listAdminWorkHistory(input: {
    mechanicId: string;
    limit: number;
    cursor?: { timestamp: Date; id: string };
  }): Promise<AdminMechanicWorkHistoryPage> {
    const rows = await this.sql<AssignmentHistoryRow[]>`
      select
        id, request_id, status, accepted_at, started_at, completed_at,
        canceled_at, created_at, updated_at
      from assignments
      where mechanic_id = ${input.mechanicId}
        and (
          ${input.cursor?.timestamp ?? null}::timestamptz is null
          or (created_at, id) <
             (${input.cursor?.timestamp ?? null}, ${input.cursor?.id ?? null}::uuid)
        )
      order by created_at desc, id desc
      limit ${input.limit + 1}
    `;
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map(mapAssignmentHistory),
      ...(rows.length > input.limit && last
        ? { nextCursor: { timestamp: last.created_at, id: last.id } }
        : {})
    };
  }

  async getAdminPerformance(
    mechanicId: string
  ): Promise<AdminMechanicPerformance | undefined> {
    const rows = await this.sql<
      {
        total_assignments: number;
        active_assignments: number;
        completed_assignments: number;
        canceled_assignments: number;
        rating_avg: string;
        rating_count: number;
      }[]
    >`
      select
        count(assignment.id)::integer as total_assignments,
        count(assignment.id) filter (
          where assignment.status in ${this.sql([...ACTIVE_ASSIGNMENT_STATUSES])}
            and (assignment.scheduled_start_at is null or assignment.activated_at is not null)
        )::integer as active_assignments,
        count(assignment.id) filter (
          where assignment.status = 'completed'
        )::integer as completed_assignments,
        count(assignment.id) filter (
          where assignment.status = 'canceled'
        )::integer as canceled_assignments,
        profile.rating_avg::text,
        profile.rating_count
      from mechanic_profiles profile
      left join assignments assignment on assignment.mechanic_id = profile.user_id
      where profile.user_id = ${mechanicId}
      group by profile.user_id
    `;
    const row = rows[0];
    return row
      ? {
          totalAssignments: row.total_assignments,
          activeAssignments: row.active_assignments,
          completedAssignments: row.completed_assignments,
          canceledAssignments: row.canceled_assignments,
          ratingAvg: Number(row.rating_avg),
          ratingCount: row.rating_count
        }
      : undefined;
  }

  private async replaceSkills(userId: string, serviceTypes: ServiceType[]): Promise<void> {
    await this.sql`delete from mechanic_skills where mechanic_id = ${userId}`;
    for (const serviceType of serviceTypes) {
      await this.sql`
        insert into mechanic_skills (mechanic_id, service_type)
        values (${userId}, ${serviceType})
        on conflict (mechanic_id, service_type) do nothing
      `;
    }
  }
}

function mapAssignmentHistory(row: AssignmentHistoryRow) {
  return {
    id: row.id,
    requestId: row.request_id,
    status: row.status,
    acceptedAt: row.accepted_at,
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.canceled_at ? { canceledAt: row.canceled_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapProfile(row: MechanicProfileRow): MechanicProfile {
  return {
    userId: row.user_id,
    profileStatus: row.profile_status,
    isAvailable: row.is_available,
    serviceRadiusKm: Number(row.service_radius_km),
    latestLocation:
      row.latitude === null || row.longitude === null
        ? undefined
        : { latitude: row.latitude, longitude: row.longitude },
    locationUpdatedAt: row.location_updated_at ?? undefined,
    availabilityUpdatedAt: row.availability_updated_at,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count,
    serviceTypes: row.service_types ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
