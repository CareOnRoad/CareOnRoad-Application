import type { TransactionSql } from "postgres";

import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";

import type {
  CreateDispatchCandidate,
  CreateDispatchRound,
  DispatchCandidate,
  DispatchCandidateMechanic,
  DispatchCandidateStatus,
  DispatchRepository,
  DispatchRound,
  DispatchRoundStatus
} from "../contracts/dispatch.repository";

type DispatchRoundRow = {
  id: string;
  request_id: string;
  round_number: number;
  radius_m: number;
  status: DispatchRoundStatus;
  started_at: Date;
  expires_at: Date;
  completed_at: Date | null;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  failure_count: number;
};

type DispatchCandidateRow = {
  id: string;
  round_id: string;
  request_id: string;
  mechanic_id: string;
  rank: number;
  distance_m: number | null;
  status: DispatchCandidateStatus;
  offered_at: Date | null;
  expires_at: Date | null;
  responded_at: Date | null;
  created_at: Date;
};

type CandidateMechanicRow = {
  mechanic_id: string;
  service_types: ServiceType[];
  is_available: boolean;
  profile_status: DispatchCandidateMechanic["profileStatus"];
  service_radius_km: string;
  latitude: number;
  longitude: number;
  location_updated_at: Date;
  availability_updated_at: Date;
  rating_avg: string;
  rating_count: number;
  distance_m: number;
};

export class PostgresDispatchRepository implements DispatchRepository {
  constructor(private readonly sql: TransactionSql) {}

  async listRoundsByRequest(requestId: string): Promise<DispatchRound[]> {
    const rows = await this.sql<DispatchRoundRow[]>`
      select *
      from dispatch_rounds
      where request_id = ${requestId}
      order by round_number asc
    `;
    return rows.map(mapRound);
  }

  async listRoundsByRequestForUpdate(requestId: string): Promise<DispatchRound[]> {
    const rows = await this.sql<DispatchRoundRow[]>`
      select *
      from dispatch_rounds
      where request_id = ${requestId}
      order by round_number asc, id asc
      for update
    `;
    return rows.map(mapRound);
  }

  async findRoundById(roundId: string): Promise<DispatchRound | undefined> {
    const rows = await this.sql<DispatchRoundRow[]>`
      select *
      from dispatch_rounds
      where id = ${roundId}
      limit 1
    `;
    return rows[0] ? mapRound(rows[0]) : undefined;
  }

  async findActiveRoundByRequest(requestId: string): Promise<DispatchRound | undefined> {
    const rows = await this.sql<DispatchRoundRow[]>`
      select *
      from dispatch_rounds
      where request_id = ${requestId}
        and status = 'active'
      order by round_number desc
      limit 1
    `;
    return rows[0] ? mapRound(rows[0]) : undefined;
  }

  async claimExpiredRounds(input: {
    now: Date;
    leaseOwner: string;
    leaseUntil: Date;
    limit: number;
  }): Promise<DispatchRound[]> {
    const rows = await this.sql<DispatchRoundRow[]>`
      with due as (
        select id
        from dispatch_rounds
        where status = 'active'
          and expires_at <= ${input.now}
          and (lease_expires_at is null or lease_expires_at <= ${input.now})
        order by expires_at, id
        for update skip locked
        limit ${input.limit}
      )
      update dispatch_rounds round
      set lease_owner = ${input.leaseOwner},
          lease_expires_at = ${input.leaseUntil}
      from due
      where round.id = due.id
      returning round.*
    `;
    return rows.map(mapRound);
  }

  async releaseRoundClaim(input: { id: string; leaseOwner: string }): Promise<boolean> {
    const rows = await this.sql<{ id: string }[]>`
      update dispatch_rounds
      set lease_owner = null,
          lease_expires_at = null,
          failure_count = failure_count + 1
      where id = ${input.id}
        and lease_owner = ${input.leaseOwner}
        and status = 'active'
      returning id
    `;
    return rows.length > 0;
  }

  async createRoundWithCandidates(input: {
    round: CreateDispatchRound;
    candidates: CreateDispatchCandidate[];
  }): Promise<{ round: DispatchRound; candidates: DispatchCandidate[] }> {
    const roundRows = await this.sql<DispatchRoundRow[]>`
      insert into dispatch_rounds (
        id, request_id, round_number, radius_m, status, started_at, expires_at
      )
      values (
        ${input.round.id}, ${input.round.requestId}, ${input.round.roundNumber},
        ${input.round.radiusMeters}, ${input.round.status ?? "active"},
        ${input.round.startedAt}, ${input.round.expiresAt}
      )
      returning *
    `;
    const candidates: DispatchCandidate[] = [];
    for (const candidate of input.candidates) {
      const rows = await this.sql<DispatchCandidateRow[]>`
        insert into dispatch_candidates (
          id, round_id, request_id, mechanic_id, rank, distance_m, status,
          offered_at, expires_at, created_at
        )
        values (
          ${candidate.id}, ${candidate.roundId}, ${candidate.requestId},
          ${candidate.mechanicId}, ${candidate.rank}, ${candidate.distanceMeters ?? null},
          ${candidate.status ?? "offered"}, ${candidate.offeredAt ?? null},
          ${candidate.expiresAt ?? null}, ${candidate.createdAt}
        )
        returning *
      `;
      candidates.push(mapCandidate(rows[0]!));
    }
    return { round: mapRound(roundRows[0]!), candidates };
  }

  async updateRoundStatus(input: {
    id: string;
    status: DispatchRoundStatus;
    completedAt?: Date;
  }): Promise<DispatchRound | undefined> {
    const rows = await this.sql<DispatchRoundRow[]>`
      update dispatch_rounds
      set status = ${input.status},
          completed_at = ${input.completedAt ?? null},
          lease_owner = case when ${input.status} = 'active' then lease_owner else null end,
          lease_expires_at = case when ${input.status} = 'active' then lease_expires_at else null end
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapRound(rows[0]) : undefined;
  }

  async findCandidateByIdForUpdate(id: string): Promise<DispatchCandidate | undefined> {
    const rows = await this.sql<DispatchCandidateRow[]>`
      select *
      from dispatch_candidates
      where id = ${id}
      for update
      limit 1
    `;
    return rows[0] ? mapCandidate(rows[0]) : undefined;
  }

  async findCandidateById(id: string): Promise<DispatchCandidate | undefined> {
    const rows = await this.sql<DispatchCandidateRow[]>`
      select *
      from dispatch_candidates
      where id = ${id}
      limit 1
    `;
    return rows[0] ? mapCandidate(rows[0]) : undefined;
  }

  async listCandidatesByRequest(requestId: string): Promise<DispatchCandidate[]> {
    const rows = await this.sql<DispatchCandidateRow[]>`
      select *
      from dispatch_candidates
      where request_id = ${requestId}
      order by rank asc, id asc
    `;
    return rows.map(mapCandidate);
  }

  async listCandidatesByRequestForUpdate(
    requestId: string
  ): Promise<DispatchCandidate[]> {
    const rows = await this.sql<DispatchCandidateRow[]>`
      select *
      from dispatch_candidates
      where request_id = ${requestId}
      order by round_id asc, rank asc, id asc
      for update
    `;
    return rows.map(mapCandidate);
  }

  async listCandidatesByMechanic(mechanicId: string, now: Date): Promise<DispatchCandidate[]> {
    const rows = await this.sql<DispatchCandidateRow[]>`
      select *
      from dispatch_candidates
      where mechanic_id = ${mechanicId}
        and status = 'offered'
        and expires_at > ${now}
      order by expires_at asc, id asc
    `;
    return rows.map(mapCandidate);
  }

  async updateCandidateStatus(input: {
    id: string;
    status: DispatchCandidateStatus;
    respondedAt?: Date;
  }): Promise<DispatchCandidate | undefined> {
    const rows = await this.sql<DispatchCandidateRow[]>`
      update dispatch_candidates
      set status = ${input.status},
          responded_at = ${input.respondedAt ?? null}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapCandidate(rows[0]) : undefined;
  }

  async updateCandidatesForRoundStatus(input: {
    roundId: string;
    fromStatuses: DispatchCandidateStatus[];
    status: DispatchCandidateStatus;
    respondedAt?: Date;
  }): Promise<DispatchCandidate[]> {
    const rows = await this.sql<DispatchCandidateRow[]>`
      update dispatch_candidates
      set status = ${input.status},
          responded_at = ${input.respondedAt ?? null}
      where round_id = ${input.roundId}
        and status in ${this.sql(input.fromStatuses)}
      returning *
    `;
    return rows.map(mapCandidate);
  }

  async updateOtherCandidatesForRequestStatus(input: {
    requestId: string;
    exceptCandidateId: string;
    fromStatuses: DispatchCandidateStatus[];
    status: DispatchCandidateStatus;
    respondedAt?: Date;
  }): Promise<DispatchCandidate[]> {
    const rows = await this.sql<DispatchCandidateRow[]>`
      update dispatch_candidates
      set status = ${input.status},
          responded_at = ${input.respondedAt ?? null}
      where request_id = ${input.requestId}
        and id <> ${input.exceptCandidateId}
        and status in ${this.sql(input.fromStatuses)}
      returning *
    `;
    return rows.map(mapCandidate);
  }

  async cancelOpenDispatchForRequest(input: {
    requestId: string;
    now: Date;
  }): Promise<{ canceledRounds: number; canceledCandidates: number }> {
    await this.sql`
      select id
      from dispatch_rounds
      where request_id = ${input.requestId}
      order by round_number, id
      for update
    `;
    await this.sql`
      select id
      from dispatch_candidates
      where request_id = ${input.requestId}
      order by round_id, rank, id
      for update
    `;
    const candidates = await this.sql<DispatchCandidateRow[]>`
      update dispatch_candidates
      set status = 'cancelled', responded_at = ${input.now}
      where request_id = ${input.requestId}
        and status in ('pending', 'offered')
      returning *
    `;
    const rounds = await this.sql<DispatchRoundRow[]>`
      update dispatch_rounds
      set status = 'canceled', completed_at = ${input.now},
          lease_owner = null, lease_expires_at = null
      where request_id = ${input.requestId}
        and status = 'active'
      returning *
    `;
    return {
      canceledRounds: rounds.length,
      canceledCandidates: candidates.length
    };
  }

  async findCandidateMechanics(input: {
    serviceType: ServiceType;
    origin: { latitude: number; longitude: number };
    radiusMeters: number;
    now: Date;
    maxLocationAgeSeconds: number;
  }): Promise<DispatchCandidateMechanic[]> {
    const rows = await this.sql<CandidateMechanicRow[]>`
      with origin as (
        select ST_SetSRID(ST_MakePoint(${input.origin.longitude}, ${input.origin.latitude}), 4326)::geography as point
      )
      select
        profile.user_id as mechanic_id,
        array_agg(skills.service_type::text order by skills.service_type) as service_types,
        profile.is_available,
        profile.profile_status,
        profile.service_radius_km::text,
        ST_Y(profile.latest_location::geometry) as latitude,
        ST_X(profile.latest_location::geometry) as longitude,
        profile.location_updated_at,
        profile.availability_updated_at,
        profile.rating_avg::text,
        profile.rating_count,
        round(ST_Distance(profile.latest_location, origin.point))::int as distance_m
      from mechanic_profiles profile
      join mechanic_skills skills on skills.mechanic_id = profile.user_id
      cross join origin
      where profile.profile_status = 'active'
        and profile.is_available = true
        and profile.latest_location is not null
        and profile.location_updated_at is not null
        and profile.location_updated_at >= ${new Date(
          input.now.getTime() - input.maxLocationAgeSeconds * 1000
        )}
        and skills.service_type = ${input.serviceType}
        and ST_DWithin(profile.latest_location, origin.point, ${input.radiusMeters})
        and ST_DWithin(profile.latest_location, origin.point, profile.service_radius_km * 1000)
      group by profile.user_id, origin.point
    `;
    return rows.map((row) => ({
      mechanicId: row.mechanic_id,
      serviceTypes: row.service_types,
      isAvailable: row.is_available,
      profileStatus: row.profile_status,
      serviceRadiusKm: Number(row.service_radius_km),
      latestLocation: { latitude: row.latitude, longitude: row.longitude },
      locationUpdatedAt: row.location_updated_at,
      availabilityUpdatedAt: row.availability_updated_at,
      ratingAvg: Number(row.rating_avg),
      ratingCount: row.rating_count,
      distanceMeters: row.distance_m
    }));
  }
}

function mapRound(row: DispatchRoundRow): DispatchRound {
  return {
    id: row.id,
    requestId: row.request_id,
    roundNumber: row.round_number,
    radiusMeters: row.radius_m,
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    completedAt: row.completed_at ?? undefined,
    leaseOwner: row.lease_owner ?? undefined,
    leaseExpiresAt: row.lease_expires_at ?? undefined,
    failureCount: row.failure_count
  };
}

function mapCandidate(row: DispatchCandidateRow): DispatchCandidate {
  return {
    id: row.id,
    roundId: row.round_id,
    requestId: row.request_id,
    mechanicId: row.mechanic_id,
    rank: row.rank,
    distanceMeters: row.distance_m ?? undefined,
    status: row.status,
    offeredAt: row.offered_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    respondedAt: row.responded_at ?? undefined,
    createdAt: row.created_at
  };
}
