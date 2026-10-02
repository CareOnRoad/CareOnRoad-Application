export type QuoteStatus = "pending" | "approved" | "rejected" | "superseded" | "expired" | "voided";
export type QuoteLineType = "labor" | "part" | "other";
export type QuotePurpose = "standard" | "rescue_labor" | "rescue_final" | "maintenance_labor" | "maintenance_work";
export type RescuePaymentTiming = "labor_upfront" | "after_repair";
export type RescueLaborPricing = {
  base_amount: number;
  distance_amount: number;
  weather_amount: number;
  time_amount: number;
  weather: "sunny" | "rain";
  distance_m: number;
  time_slot: "morning" | "midday" | "evening" | "late_night";
};

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
  purpose?: QuotePurpose;
  laborPricing?: RescueLaborPricing;
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
  hasOpenByAssignment(assignmentId: string): Promise<boolean>;
  listPageByRequest(requestId: string, limit: number, cursor?: import("@/lib/list-pagination").PageCursor): Promise<Quote[]>;
  hasOpenByRequest(requestId: string): Promise<boolean>;
  hasAnyByAssignment(assignmentId: string): Promise<boolean>;
  create(input: CreateQuote): Promise<Quote>;
  findById(id: string): Promise<Quote | undefined>;
  findByIdForUpdate(id: string): Promise<Quote | undefined>;
  findLatestByRequest(requestId: string): Promise<Quote | undefined>;
  findLatestByAssignment(assignmentId: string): Promise<Quote | undefined>;
  findLatestByRequestForUpdate(requestId: string): Promise<Quote | undefined>;
  findLatestApprovedByAssignment(assignmentId: string, purpose: QuotePurpose): Promise<Quote | undefined>;
  listByRequest(requestId: string): Promise<Quote[]>;
  hasAnyByDiagnosis(diagnosisId: string): Promise<boolean>;
  updateStatus(input: {
    id: string;
    status: QuoteStatus;
    respondedAt?: Date;
  }): Promise<Quote | undefined>;
}
