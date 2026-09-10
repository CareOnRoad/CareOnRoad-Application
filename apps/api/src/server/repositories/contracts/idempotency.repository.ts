export type JsonObject = Record<string, unknown>;

export type IdempotencyRecord = {
  id: string;
  actorId: string;
  scope: string;
  idempotencyKey: string;
  requestHash: string;
  responseStatus?: number;
  responseBody?: JsonObject;
  resourceType?: string;
  resourceId?: string;
  expiresAt: Date;
  createdAt: Date;
  completedAt?: Date;
};

export type CreateIdempotencyRecord = Omit<IdempotencyRecord, "createdAt"> & {
  createdAt?: Date;
};

export type CompleteIdempotencyRecord = {
  actorId: string;
  scope: string;
  idempotencyKey: string;
  responseStatus: number;
  responseBody: JsonObject;
  resourceType?: string;
  resourceId?: string;
  completedAt?: Date;
};

export interface IdempotencyRepository {
  find(actorId: string, scope: string, idempotencyKey: string): Promise<IdempotencyRecord | undefined>;
  create(record: CreateIdempotencyRecord): Promise<IdempotencyRecord>;
  complete(input: CompleteIdempotencyRecord): Promise<IdempotencyRecord>;
}
