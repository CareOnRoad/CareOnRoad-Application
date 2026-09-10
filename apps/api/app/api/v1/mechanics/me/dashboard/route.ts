import { createDefaultMechanicOperationsRouteHandlers } from "@/features/mechanic-operations/mechanic-operations.route-handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return createDefaultMechanicOperationsRouteHandlers().getDashboard(request);
}
