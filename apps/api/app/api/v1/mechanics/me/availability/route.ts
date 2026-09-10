import { createDefaultMotorcycleRouteHandlers } from "@/features/motorcycles/motorcycle.route-handlers";

export const runtime = "nodejs";

export function PUT(request: Request) {
  return createDefaultMotorcycleRouteHandlers().updateMechanicAvailability(request);
}
