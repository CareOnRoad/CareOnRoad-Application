import type { Sql } from "postgres";
import type { RetentionDataClass, RetentionRepository } from "../contracts/retention.repository";

export class PostgresRetentionRepository implements RetentionRepository {
  constructor(private readonly sql: Sql) {}
  async claimLease(input: { workerId: string; now: Date; leaseExpiresAt: Date }) {
    const rows = await this.sql`insert into retention_worker_leases (worker_name, lease_owner, lease_expires_at, updated_at) values ('data_retention', ${input.workerId}, ${input.leaseExpiresAt}, ${input.now}) on conflict (worker_name) do update set lease_owner=excluded.lease_owner, lease_expires_at=excluded.lease_expires_at, updated_at=excluded.updated_at where retention_worker_leases.lease_expires_at <= ${input.now} or retention_worker_leases.lease_owner = ${input.workerId} returning worker_name`;
    return rows.length === 1;
  }
  async releaseLease(workerId: string) { await this.sql`delete from retention_worker_leases where worker_name='data_retention' and lease_owner=${workerId}`; }
  countEligible(dataClass: RetentionDataClass, cutoff: Date, limit: number) {
    switch (dataClass) {
      case "media_upload_intents": return count(this.sql`select count(*)::int as count from (select id from media_upload_intents where status in ('expired','finalized') and updated_at < ${cutoff} order by updated_at,id limit ${limit}) eligible`);
      case "device_delivery_credentials": return count(this.sql`select count(*)::int as count from (select id from device_delivery_credentials where enabled=false and disabled_at < ${cutoff} order by disabled_at,id limit ${limit}) eligible`);
      case "worker_runs": return count(this.sql`select count(*)::int as count from (select id from worker_run_records where completed_at < ${cutoff} order by completed_at,id limit ${limit}) eligible`);
    }
  }
  async deleteEligible(dataClass: RetentionDataClass, cutoff: Date, limit: number) {
    switch (dataClass) {
      case "media_upload_intents": return deleted(this.sql`with eligible as (select id from media_upload_intents where status in ('expired','finalized') and updated_at < ${cutoff} order by updated_at,id limit ${limit}) delete from media_upload_intents where id in (select id from eligible) returning id`);
      case "device_delivery_credentials": return deleted(this.sql`with eligible as (select id from device_delivery_credentials where enabled=false and disabled_at < ${cutoff} order by disabled_at,id limit ${limit}) delete from device_delivery_credentials where id in (select id from eligible) returning id`);
      case "worker_runs": return deleted(this.sql`with eligible as (select id from worker_run_records where completed_at < ${cutoff} order by completed_at,id limit ${limit}) delete from worker_run_records where id in (select id from eligible) returning id`);
    }
  }
}
async function count(rowsPromise: PromiseLike<readonly { count: number }[]>) { const rows = await rowsPromise; return rows[0]?.count ?? 0; }
async function deleted(rowsPromise: PromiseLike<readonly unknown[]>) { return (await rowsPromise).length; }
