import type { TransactionSql } from "postgres";

import type {
  CreateRequestMediaMetadata,
  RequestMediaMetadata,
  RequestMediaRepository
} from "../contracts/request-media.repository";

type RequestMediaRow = {
  id: string;
  request_id: string;
  media_type: string;
  object_reference: string;
  content_type: string;
  size_bytes: string | null;
  checksum: string | null;
  created_by: string;
  created_at: Date;
};

export class PostgresRequestMediaRepository implements RequestMediaRepository {
  constructor(private readonly sql: TransactionSql) {}

  async create(input: CreateRequestMediaMetadata): Promise<RequestMediaMetadata> {
    const rows = await this.sql<RequestMediaRow[]>`
      insert into request_media_metadata (
        id, request_id, media_type, object_reference, content_type,
        size_bytes, checksum, created_by, created_at
      )
      values (
        ${input.id}, ${input.requestId}, ${input.mediaType}, ${input.objectReference},
        ${input.contentType}, ${input.sizeBytes ?? null}, ${input.checksum ?? null},
        ${input.createdBy}, ${input.createdAt ?? new Date()}
      )
      returning *
    `;
    return mapMedia(rows[0]!);
  }

  async listByRequest(requestId: string): Promise<RequestMediaMetadata[]> {
    const rows = await this.sql<RequestMediaRow[]>`
      select *
      from request_media_metadata
      where request_id = ${requestId}
      order by created_at, id
    `;
    return rows.map(mapMedia);
  }
}

function mapMedia(row: RequestMediaRow): RequestMediaMetadata {
  return {
    id: row.id,
    requestId: row.request_id,
    mediaType: row.media_type,
    objectReference: row.object_reference,
    contentType: row.content_type,
    sizeBytes: row.size_bytes === null ? undefined : Number(row.size_bytes),
    checksum: row.checksum ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}
