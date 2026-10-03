import type {
  CreateQuote,
  Quote,
  QuoteLine,
  QuoteRepository,
  QuoteStatus
} from "../contracts/quote.repository";
import type { QuotePurpose } from "../contracts/quote.repository";
import { filterPage } from "@/lib/list-pagination";

export class InMemoryQuoteRepository implements QuoteRepository {
  async hasOpenByAssignment(assignmentId: string): Promise<boolean> {
    return this.quotes.some((row) => row.assignmentId === assignmentId && ["pending", "approved"].includes(row.status));
  }
  async listPageByRequest(requestId: string, limit: number, cursor?: import("@/lib/list-pagination").PageCursor): Promise<Quote[]> {
    return filterPage(this.quotes.filter((row) => row.requestId === requestId), { limit, cursor });
  }
  async hasAnyByAssignment(assignmentId: string): Promise<boolean> {
    return this.quotes.some((quote) => quote.assignmentId === assignmentId);
  }
  constructor(
    private readonly quotes: Quote[],
    private readonly quoteLines: QuoteLine[]
  ) {}

  async hasOpenByRequest(requestId: string): Promise<boolean> {
    return this.quotes.some((q) => q.requestId === requestId && ["pending", "approved"].includes(q.status));
  }

  async create(input: CreateQuote): Promise<Quote> {
    if (
      this.quotes.some(
        (quote) => quote.requestId === input.requestId && quote.version === input.version
      )
    ) {
      throw new Error("QUOTE_VERSION_EXISTS");
    }
    if (
      (input.status ?? "pending") === "pending" &&
      this.quotes.some(
        (quote) => quote.requestId === input.requestId && quote.status === "pending"
      )
    ) {
      throw new Error("QUOTE_PENDING_EXISTS");
    }
    const lines = input.lines.map((line) => ({ ...line, quoteId: input.id }));
    const quote: Quote = {
      ...input,
      status: input.status ?? "pending",
      currency: input.currency ?? "VND",
      lines: lines.map(cloneLine)
    };
    this.quotes.push({ ...quote, lines: [] });
    this.quoteLines.push(...lines.map(cloneLine));
    return cloneQuote(quote);
  }

  async findById(id: string): Promise<Quote | undefined> {
    const quote = this.quotes.find((item) => item.id === id);
    return quote ? this.withLines(quote) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<Quote | undefined> {
    return this.findById(id);
  }

  async findLatestByRequest(requestId: string): Promise<Quote | undefined> {
    const quote = this.quotes
      .filter((item) => item.requestId === requestId)
      .sort((left, right) => right.version - left.version)[0];
    return quote ? this.withLines(quote) : undefined;
  }

  async findLatestByRequestForUpdate(requestId: string): Promise<Quote | undefined> {
    return this.findLatestByRequest(requestId);
  }

  async findLatestByAssignment(assignmentId: string): Promise<Quote | undefined> {
    const quote = this.quotes.filter((item) => item.assignmentId === assignmentId).sort((a, b) => b.version - a.version)[0];
    return quote ? this.withLines(quote) : undefined;
  }

  async listByRequest(requestId: string): Promise<Quote[]> {
    return this.quotes
      .filter((quote) => quote.requestId === requestId)
      .sort((left, right) => right.version - left.version)
      .map((quote) => this.withLines(quote));
  }

  async findLatestApprovedByAssignment(assignmentId: string, purpose: QuotePurpose): Promise<Quote | undefined> {
    const quote = this.quotes.filter((item) => item.assignmentId === assignmentId && item.purpose === purpose && item.status === "approved")
      .sort((left, right) => right.version - left.version)[0];
    return quote ? this.withLines(quote) : undefined;
  }

  async hasAnyByDiagnosis(diagnosisId: string): Promise<boolean> {
    return this.quotes.some((quote) => quote.diagnosisId === diagnosisId);
  }

  async updateStatus(input: {
    id: string;
    status: QuoteStatus;
    respondedAt?: Date;
  }): Promise<Quote | undefined> {
    const quote = this.quotes.find((item) => item.id === input.id);
    if (!quote) {
      return undefined;
    }
    quote.status = input.status;
    quote.respondedAt = input.respondedAt;
    return this.withLines(quote);
  }

  private withLines(quote: Quote): Quote {
    return cloneQuote({
      ...quote,
      lines: this.quoteLines.filter((line) => line.quoteId === quote.id)
    });
  }
}

function cloneQuote(quote: Quote): Quote {
  return {
    ...quote,
    expiresAt: quote.expiresAt ? new Date(quote.expiresAt) : undefined,
    createdAt: new Date(quote.createdAt),
    respondedAt: quote.respondedAt ? new Date(quote.respondedAt) : undefined,
    lines: quote.lines.map(cloneLine)
  };
}

function cloneLine(line: QuoteLine): QuoteLine {
  return { ...line };
}
