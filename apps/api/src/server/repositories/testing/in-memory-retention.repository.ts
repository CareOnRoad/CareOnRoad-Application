import type { RetentionDataClass, RetentionRepository } from "../contracts/retention.repository";
export class InMemoryRetentionRepository implements RetentionRepository {
  lease?: { owner: string; expiresAt: Date };
  constructor(readonly rows: Record<RetentionDataClass, Array<{ id: string; eligibleAt: Date }>>) {}
  async claimLease(input: { workerId: string; now: Date; leaseExpiresAt: Date }) { if (this.lease && this.lease.expiresAt > input.now && this.lease.owner !== input.workerId) return false; this.lease = { owner: input.workerId, expiresAt: input.leaseExpiresAt }; return true; }
  async releaseLease(workerId: string) { if (this.lease?.owner === workerId) this.lease = undefined; }
  async countEligible(dataClass: RetentionDataClass, cutoff: Date, limit: number) { return this.rows[dataClass].filter((row) => row.eligibleAt < cutoff).slice(0, limit).length; }
  async deleteEligible(dataClass: RetentionDataClass, cutoff: Date, limit: number) { const selected = new Set(this.rows[dataClass].filter((row) => row.eligibleAt < cutoff).slice(0, limit).map((row) => row.id)); this.rows[dataClass] = this.rows[dataClass].filter((row) => !selected.has(row.id)); return selected.size; }
}
