/**
 * Domain types — mirror backend response shapes (`/api/v1/...`).
 * Until BE is wired, mock-data.ts returns objects that conform to these.
 */

export type RequestStatus =
  | "draft"
  | "submitted"
  | "dispatching"
  | "assigned"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "awaiting_payment"
  | "completed"
  | "cancelled";

export interface ServiceCategory {
  id: string;
  slug: string;
  title: string;
  description: string;
  iconKey: string; // mapped to icon component
  basePriceVnd: number;
}

export interface ProcessStep {
  index: number;
  title: string;
  description: string;
}

export interface Testimonial {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  date: string; // ISO
}

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverColor: string; // hex
  publishedAt: string; // ISO
  category: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface ContactChannel {
  id: string;
  label: string;
  value: string;
  hint?: string;
  iconKey: "phone" | "mail" | "chat" | "location";
}

export interface BookingSlot {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  available: boolean;
}

export interface EmergencyRequest {
  requestCode: string; // COR-...
  motorcycle: string;
  location: string;
  status: RequestStatus;
  createdAt: string;
}
