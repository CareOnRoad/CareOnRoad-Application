import { createDefaultDispatchWorkerRouteHandlers } from "@/features/dispatch/dispatch-worker.route-handlers";

export const runtime = "nodejs";

export function POST(request: Request) {
  return createDefaultDispatchWorkerRouteHandlers().runDispatchWorker(request);
}
