import type { TransactionSql } from "postgres";

import type {
  RequestCodePrefix,
  RequestCodeRepository,
  RequestCodeSequence
} from "../contracts/request-code.repository";

type RequestCodeSequenceRow = {
  local_date: string;
  service_prefix: RequestCodePrefix;
  last_sequence: number;
  updated_at: Date;
};

export class PostgresRequestCodeRepository implements RequestCodeRepository {
  constructor(private readonly sql: TransactionSql) {}

  async allocateNext(
    servicePrefix: RequestCodePrefix,
    localDate: string,
    updatedAt: Date
  ): Promise<RequestCodeSequence> {
    const rows = await this.sql<RequestCodeSequenceRow[]>`
      insert into daily_request_sequences (local_date, service_prefix, last_sequence, updated_at)
      values (${localDate}, ${servicePrefix}, 1, ${updatedAt})
      on conflict (local_date, service_prefix)
      do update set
        last_sequence = daily_request_sequences.last_sequence + 1,
        updated_at = excluded.updated_at
      returning local_date::text, service_prefix, last_sequence, updated_at
    `;
    const row = rows[0]!;
    return {
      localDate: row.local_date,
      servicePrefix: row.service_prefix,
      lastSequence: row.last_sequence,
      updatedAt: row.updated_at
    };
  }
}
