import { createDefaultMotorcycleRouteHandlers } from "@/features/motorcycles/motorcycle.route-handlers";

export const runtime = "nodejs";

type MotorcycleDetailsRouteContext = {
  params: Promise<{ motorcycleId: string }>;
};

export async function PATCH(request: Request, context: MotorcycleDetailsRouteContext) {
  const { motorcycleId } = await context.params;
  return createDefaultMotorcycleRouteHandlers().updateMotorcycleDetails(request, motorcycleId);
}
