import { createDefaultMotorcycleRouteHandlers } from "@/features/motorcycles/motorcycle.route-handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return createDefaultMotorcycleRouteHandlers().listMotorcycles(request);
}

export function POST(request: Request) {
  return createDefaultMotorcycleRouteHandlers().createMotorcycle(request);
}
