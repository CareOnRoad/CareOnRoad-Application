import { createDefaultHealthRouteHandlers } from "@/features/health/health.route-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return createDefaultHealthRouteHandlers().ready();
}
