import { createDefaultMotorcycleRouteHandlers } from "@/features/motorcycles/motorcycle.route-handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return createDefaultMotorcycleRouteHandlers().getMyMechanicProfile(request);
}

export function PATCH(request: Request) {
  return createDefaultMotorcycleRouteHandlers().updateMyMechanicProfile(request);
}
