import type { TransactionSql } from "postgres";

import type {
  AssignmentLiveLocation,
  LiveTrackingRepository,
  UpsertAssignmentLiveLocation
} from "../contracts/live-tracking.repository";

type LiveLocationRow = {
  assignment_id: string;
  mechanic_id: string;
  latitude: number;
  longitude: number;
  observed_at: Date;
  accuracy_meters: string;
  received_at: Date;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
  created?: boolean;
};

export class PostgresLiveTrackingRepository implements LiveTrackingRepository {
  constructor(private readonly sql: TransactionSql) {}

  async findByAssignmentIdForUpdate(assignmentId: string) {
    const rows = await this.sql<LiveLocationRow[]>`
      select ${this.selection()}
      from assignment_live_locations
      where assignment_id = ${assignmentId}
      for update
      limit 1
    `;
    return rows[0] ? mapLocation(rows[0]) : undefined;
  }

  async findCurrentByAssignmentId(assignmentId: string, now: Date) {
    const rows = await this.sql<LiveLocationRow[]>`
      select ${this.selection()}
      from assignment_live_locations
      where assignment_id = ${assignmentId}
        and expires_at > ${now}
      limit 1
    `;
    return rows[0] ? mapLocation(rows[0]) : undefined;
  }

  async upsert(input: UpsertAssignmentLiveLocation) {
    const rows = await this.sql<LiveLocationRow[]>`
      insert into assignment_live_locations (
        assignment_id, mechanic_id, location, observed_at, accuracy_meters,
        received_at, expires_at, created_at, updated_at
      ) values (
        ${input.assignmentId}, ${input.mechanicId},
        ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
        ${input.observedAt}, ${input.accuracyMeters}, ${input.receivedAt},
        ${input.expiresAt}, ${input.createdAt}, ${input.updatedAt}
      )
      on conflict (assignment_id) do update set
        mechanic_id = excluded.mechanic_id,
        location = excluded.location,
        observed_at = excluded.observed_at,
        accuracy_meters = excluded.accuracy_meters,
        received_at = excluded.received_at,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
      returning ${this.selection()}, (xmax = 0) as created
    `;
    return { location: mapLocation(rows[0]!), created: Boolean(rows[0]!.created) };
  }

  async deleteExpired(now: Date, limit: number): Promise<number> {
    const rows = await this.sql<{ assignment_id: string }[]>`
      with eligible as (
        select assignment_id
        from assignment_live_locations
        where expires_at <= ${now}
        order by expires_at, assignment_id
        for update skip locked
        limit ${limit}
      )
      delete from assignment_live_locations location
      using eligible
      where location.assignment_id = eligible.assignment_id
      returning location.assignment_id
    `;
    return rows.length;
  }

  private selection() {
    return this.sql`
      assignment_id,
      mechanic_id,
      ST_Y(location::geometry) as latitude,
      ST_X(location::geometry) as longitude,
      observed_at,
      accuracy_meters::text,
      received_at,
      expires_at,
      created_at,
      updated_at
    `;
  }
}

function mapLocation(row: LiveLocationRow): AssignmentLiveLocation {
  return {
    assignmentId: row.assignment_id,
    mechanicId: row.mechanic_id,
    latitude: row.latitude,
    longitude: row.longitude,
    observedAt: row.observed_at,
    accuracyMeters: Number(row.accuracy_meters),
    receivedAt: row.received_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
