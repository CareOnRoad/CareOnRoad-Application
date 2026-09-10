import { createDefaultMotorcycleRouteHandlers } from "@/features/motorcycles/motorcycle.route-handlers";

export const runtime = "nodejs";

type MotorcycleRouteContext = {
  params: Promise<{ motorcycleId: string }>;
};

export async function GET(request: Request, context: MotorcycleRouteContext) {
  const { motorcycleId } = await context.params;
  return createDefaultMotorcycleRouteHandlers().getMotorcycle(request, motorcycleId);
}

export async function PATCH(request: Request, context: MotorcycleRouteContext) {
  const { motorcycleId } = await context.params;
  return createDefaultMotorcycleRouteHandlers().updateMotorcycle(request, motorcycleId);
}

export async function DELETE(request: Request, context: MotorcycleRouteContext) {
  const { motorcycleId } = await context.params;
  return createDefaultMotorcycleRouteHandlers().archiveMotorcycle(request, motorcycleId);
}
