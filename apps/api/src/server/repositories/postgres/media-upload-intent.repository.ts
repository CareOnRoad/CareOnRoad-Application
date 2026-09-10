import type { TransactionSql } from "postgres";

import type {
  CreateMediaUploadIntent,
  MediaUploadIntent,
  MediaUploadIntentRepository
} from "../contracts/media-upload-intent.repository";

type IntentRow = {
  id: string;
  actor_id: string;
  actor_role: "rider" | "mechanic";
  resource_type: "service_request" | "assignment";
  request_id: string;
  assignment_id: string | null;
  purpose: string;
  storage_bucket: string;
  object_key: string;
  content_type: "image/jpeg" | "image/png" | "image/webp";
  size_bytes: string;
  sha256: string;
  status: "pending" | "finalized" | "expired";
  media_metadata_id: string | null;
  finalized_response: Record<string, unknown> | null;
  expires_at: Date;
  finalized_at: Date | null;
  cleanup_lease_owner: string | null;
  cleanup_lease_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class PostgresMediaUploadIntentRepository implements MediaUploadIntentRepository {
  constructor(private readonly sql: TransactionSql) {}

  async create(input: CreateMediaUploadIntent): Promise<MediaUploadIntent> {
    const rows = await this.sql<IntentRow[]>`
      insert into media_upload_intents (
        id, actor_id, actor_role, resource_type, request_id, assignment_id,
        purpose, storage_bucket, object_key, content_type, size_bytes, sha256,
        expires_at, created_at, updated_at
      ) values (
        ${input.id}, ${input.actorId}, ${input.actorRole}, ${input.resourceType},
        ${input.requestId}, ${input.assignmentId ?? null}, ${input.purpose},
        ${input.storageBucket}, ${input.objectKey}, ${input.contentType},
        ${input.sizeBytes}, ${input.sha256}, ${input.expiresAt},
        ${input.createdAt}, ${input.updatedAt}
      )
      returning *
    `;
    return mapIntent(rows[0]!);
  }

  async findById(id: string): Promise<MediaUploadIntent | undefined> {
    const rows = await this.sql<IntentRow[]>`
      select * from media_upload_intents where id = ${id} limit 1
    `;
    return rows[0] ? mapIntent(rows[0]) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<MediaUploadIntent | undefined> {
    const rows = await this.sql<IntentRow[]>`
      select * from media_upload_intents where id = ${id} for update
    `;
    return rows[0] ? mapIntent(rows[0]) : undefined;
  }

  async countForResource(input: Parameters<MediaUploadIntentRepository["countForResource"]>[0]) {
    const rows = await this.sql<{ count: string }[]>`
      select count(*)::text as count
      from media_upload_intents
      where resource_type = ${input.resourceType}
        and request_id = ${input.requestId}
        and assignment_id is not distinct from ${input.assignmentId ?? null}
        and status = 'pending' and expires_at > ${input.now}
    `;
    return Number(rows[0]?.count ?? 0);
  }

  async markFinalized(input: Parameters<MediaUploadIntentRepository["markFinalized"]>[0]) {
    const rows = await this.sql<IntentRow[]>`
      update media_upload_intents
      set status = 'finalized', media_metadata_id = ${input.mediaMetadataId},
          finalized_response = ${this.sql.json(
            input.finalizedResponse as Parameters<TransactionSql["json"]>[0]
          )},
          finalized_at = ${input.finalizedAt}, updated_at = ${input.finalizedAt},
          cleanup_lease_owner = null, cleanup_lease_expires_at = null
      where id = ${input.id} and status = 'pending'
      returning *
    `;
    return rows[0] ? mapIntent(rows[0]) : undefined;
  }

  async claimExpired(input: Parameters<MediaUploadIntentRepository["claimExpired"]>[0]) {
    const rows = await this.sql<IntentRow[]>`
      with claimable as (
        select id
        from media_upload_intents
        where status = 'pending'
          and expires_at <= ${input.now}
          and (cleanup_lease_expires_at is null or cleanup_lease_expires_at <= ${input.now})
        order by expires_at, id
        for update skip locked
        limit ${input.limit}
      )
      update media_upload_intents intent
      set cleanup_lease_owner = ${input.workerId},
          cleanup_lease_expires_at = ${input.leaseExpiresAt},
          updated_at = ${input.now}
      from claimable
      where intent.id = claimable.id
      returning intent.*
    `;
    return rows.map(mapIntent);
  }

  async markExpired(input: Parameters<MediaUploadIntentRepository["markExpired"]>[0]) {
    const rows = await this.sql<{ id: string }[]>`
      update media_upload_intents
      set status = 'expired', cleanup_lease_owner = null,
          cleanup_lease_expires_at = null, updated_at = ${input.updatedAt}
      where id = ${input.id} and status = 'pending'
        and cleanup_lease_owner = ${input.workerId}
      returning id
    `;
    return rows.length === 1;
  }

  async releaseCleanupLease(input: Parameters<MediaUploadIntentRepository["releaseCleanupLease"]>[0]) {
    const rows = await this.sql<{ id: string }[]>`
      update media_upload_intents
      set cleanup_lease_owner = null, cleanup_lease_expires_at = null,
          updated_at = ${input.updatedAt}
      where id = ${input.id} and status = 'pending'
        and cleanup_lease_owner = ${input.workerId}
      returning id
    `;
    return rows.length === 1;
  }
}

function mapIntent(row: IntentRow): MediaUploadIntent {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    resourceType: row.resource_type,
    requestId: row.request_id,
    ...(row.assignment_id ? { assignmentId: row.assignment_id } : {}),
    purpose: row.purpose,
    storageBucket: row.storage_bucket,
    objectKey: row.object_key,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    status: row.status,
    ...(row.media_metadata_id ? { mediaMetadataId: row.media_metadata_id } : {}),
    ...(row.finalized_response ? { finalizedResponse: row.finalized_response } : {}),
    expiresAt: row.expires_at,
    ...(row.finalized_at ? { finalizedAt: row.finalized_at } : {}),
    ...(row.cleanup_lease_owner ? { cleanupLeaseOwner: row.cleanup_lease_owner } : {}),
    ...(row.cleanup_lease_expires_at
      ? { cleanupLeaseExpiresAt: row.cleanup_lease_expires_at }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
