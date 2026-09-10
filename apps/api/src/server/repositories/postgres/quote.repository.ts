import type { TransactionSql } from "postgres";

import type {
  CreateQuote,
  Quote,
  QuoteLine,
  QuoteLineType,
  QuoteRepository,
  QuoteStatus
} from "../contracts/quote.repository";

type QuoteRow = {
  id: string;
  request_id: string;
  assignment_id: string;
  diagnosis_id: string | null;
  version: number;
  status: QuoteStatus;
  currency: "VND";
  subtotal_amount: string;
  discount_amount: string;
  total_amount: string;
  notes: string | null;
  expires_at: Date | null;
  created_by: string;
  created_at: Date;
  responded_at: Date | null;
};

type QuoteLineRow = {
  id: string;
  quote_id: string;
  line_type: QuoteLineType;
  description: string;
  quantity: string;
  unit_amount: string;
  line_total_amount: string;
  sort_order: number;
};

export class PostgresQuoteRepository implements QuoteRepository {
  constructor(private readonly sql: TransactionSql) {}

  async create(input: CreateQuote): Promise<Quote> {
    const rows = await this.sql<QuoteRow[]>`
      insert into quotes (
        id, request_id, assignment_id, diagnosis_id, version, status, currency,
        subtotal_amount, discount_amount, total_amount, notes, expires_at,
        created_by, created_at, responded_at
      )
      values (
        ${input.id}, ${input.requestId}, ${input.assignmentId},
        ${input.diagnosisId ?? null}, ${input.version}, ${input.status ?? "pending"},
        ${input.currency ?? "VND"}, ${input.subtotalAmount}, ${input.discountAmount},
        ${input.totalAmount}, ${input.notes ?? null}, ${input.expiresAt ?? null},
        ${input.createdBy}, ${input.createdAt}, ${input.respondedAt ?? null}
      )
      returning *
    `;
    for (const line of input.lines) {
      await this.sql`
        insert into quote_lines (
          id, quote_id, line_type, description, quantity, unit_amount,
          line_total_amount, sort_order
        )
        values (
          ${line.id}, ${input.id}, ${line.lineType}, ${line.description},
          ${line.quantity}, ${line.unitAmount}, ${line.lineTotalAmount}, ${line.sortOrder}
        )
      `;
    }
    return this.withLines(mapQuote(rows[0]!));
  }

  async findById(id: string): Promise<Quote | undefined> {
    const rows = await this.sql<QuoteRow[]>`
      select * from quotes where id = ${id} limit 1
    `;
    return rows[0] ? this.withLines(mapQuote(rows[0])) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<Quote | undefined> {
    const rows = await this.sql<QuoteRow[]>`
      select * from quotes where id = ${id} for update limit 1
    `;
    return rows[0] ? this.withLines(mapQuote(rows[0])) : undefined;
  }

  async findLatestByRequest(requestId: string): Promise<Quote | undefined> {
    const rows = await this.sql<QuoteRow[]>`
      select * from quotes
      where request_id = ${requestId}
      order by version desc
      limit 1
    `;
    return rows[0] ? this.withLines(mapQuote(rows[0])) : undefined;
  }

  async findLatestByRequestForUpdate(requestId: string): Promise<Quote | undefined> {
    const rows = await this.sql<QuoteRow[]>`
      select * from quotes
      where request_id = ${requestId}
      order by version desc
      for update
      limit 1
    `;
    return rows[0] ? this.withLines(mapQuote(rows[0])) : undefined;
  }

  async listByRequest(requestId: string): Promise<Quote[]> {
    const rows = await this.sql<QuoteRow[]>`
      select * from quotes
      where request_id = ${requestId}
      order by version desc
    `;
    return Promise.all(rows.map((row) => this.withLines(mapQuote(row))));
  }

  async hasAnyByDiagnosis(diagnosisId: string): Promise<boolean> {
    const rows = await this.sql<{ exists: boolean }[]>`
      select exists(select 1 from quotes where diagnosis_id = ${diagnosisId}) as exists
    `;
    return rows[0]?.exists ?? false;
  }

  async updateStatus(input: {
    id: string;
    status: QuoteStatus;
    respondedAt?: Date;
  }): Promise<Quote | undefined> {
    const rows = await this.sql<QuoteRow[]>`
      update quotes
      set status = ${input.status},
          responded_at = ${input.respondedAt ?? null}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? this.withLines(mapQuote(rows[0])) : undefined;
  }

  private async withLines(quote: Omit<Quote, "lines">): Promise<Quote> {
    const rows = await this.sql<QuoteLineRow[]>`
      select * from quote_lines
      where quote_id = ${quote.id}
      order by sort_order, id
    `;
    return { ...quote, lines: rows.map(mapLine) };
  }
}

function mapQuote(row: QuoteRow): Omit<Quote, "lines"> {
  return {
    id: row.id,
    requestId: row.request_id,
    assignmentId: row.assignment_id,
    diagnosisId: row.diagnosis_id ?? undefined,
    version: row.version,
    status: row.status,
    currency: row.currency,
    subtotalAmount: Number(row.subtotal_amount),
    discountAmount: Number(row.discount_amount),
    totalAmount: Number(row.total_amount),
    notes: row.notes ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? undefined
  };
}

function mapLine(row: QuoteLineRow): QuoteLine {
  return {
    id: row.id,
    quoteId: row.quote_id,
    lineType: row.line_type,
    description: row.description,
    quantity: Number(row.quantity),
    unitAmount: Number(row.unit_amount),
    lineTotalAmount: Number(row.line_total_amount),
    sortOrder: row.sort_order
  };
}
