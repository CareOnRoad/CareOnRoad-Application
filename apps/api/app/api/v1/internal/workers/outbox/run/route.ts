import { createDefaultOutboxRouteHandlers } from "@/features/outbox/outbox.route-handlers";

export const runtime = "nodejs";

export function POST(request: Request) {
  return createDefaultOutboxRouteHandlers().runOutboxWorker(request);
}
