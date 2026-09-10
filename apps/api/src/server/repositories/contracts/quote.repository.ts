export type QuoteStatus = "pending" | "approved" | "rejected" | "superseded" | "expired";
export type QuoteLineType = "labor" | "part" | "other";

export type QuoteLine = {
  id: string;
  quoteId: string;
  lineType: QuoteLineType;
  description: string;
  quantity: number;
  unitAmount: number;
  lineTotalAmount: number;
  sortOrder: number;
};

export type Quote = {
  id: string;
  requestId: string;
  assignmentId: string;
  diagnosisId?: string;
  version: number;
  status: QuoteStatus;
  currency: "VND";
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string;
  expiresAt?: Date;
  createdBy: string;
  createdAt: Date;
  respondedAt?: Date;
  lines: QuoteLine[];
};

export type CreateQuote = Omit<Quote, "lines" | "status" | "currency"> & {
  status?: QuoteStatus;
  currency?: "VND";
  lines: Array<Omit<QuoteLine, "quoteId">>;
};

export interface QuoteRepository {
  create(input: CreateQuote): Promise<Quote>;
  findById(id: string): Promise<Quote | undefined>;
  findByIdForUpdate(id: string): Promise<Quote | undefined>;
  findLatestByRequest(requestId: string): Promise<Quote | undefined>;
  findLatestByRequestForUpdate(requestId: string): Promise<Quote | undefined>;
  listByRequest(requestId: string): Promise<Quote[]>;
  hasAnyByDiagnosis(diagnosisId: string): Promise<boolean>;
  updateStatus(input: {
    id: string;
    status: QuoteStatus;
    respondedAt?: Date;
  }): Promise<Quote | undefined>;
}
