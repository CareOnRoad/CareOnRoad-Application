import type {
  CompleteIdempotencyRecord,
  CreateIdempotencyRecord,
  IdempotencyRecord,
  IdempotencyRepository
} from "../contracts/idempotency.repository";

export class InMemoryIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly records: IdempotencyRecord[]) {}

  async find(
    actorId: string,
    scope: string,
    idempotencyKey: string
  ): Promise<IdempotencyRecord | undefined> {
    return this.records.find(
      (record) =>
        record.actorId === actorId &&
        record.scope === scope &&
        record.idempotencyKey === idempotencyKey
    );
  }

  async create(input: CreateIdempotencyRecord): Promise<IdempotencyRecord> {
    if (await this.find(input.actorId, input.scope, input.idempotencyKey)) {
      throw new Error("IDEMPOTENCY_RECORD_EXISTS");
    }

    const record: IdempotencyRecord = {
      ...input,
      createdAt: input.createdAt ?? new Date()
    };
    this.records.push(record);
    return record;
  }

  async complete(input: CompleteIdempotencyRecord): Promise<IdempotencyRecord> {
    const record = await this.find(input.actorId, input.scope, input.idempotencyKey);
    if (!record) {
      throw new Error("IDEMPOTENCY_RECORD_NOT_FOUND");
    }

    Object.assign(record, {
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      completedAt: input.completedAt ?? new Date()
    });
    return record;
  }
}
