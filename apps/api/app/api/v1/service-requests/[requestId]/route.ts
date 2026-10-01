import { createDefaultServiceRequestRouteHandlers } from "@/features/service-requests/service-request.route-handlers";

export const runtime = "nodejs";

type ServiceRequestRouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function GET(request: Request, context: ServiceRequestRouteContext) {
  const { requestId } = await context.params;
  return createDefaultServiceRequestRouteHandlers().getServiceRequest(request, requestId);
}

export async function PATCH(request: Request, context: ServiceRequestRouteContext) {
  const { requestId } = await context.params;
  return createDefaultServiceRequestRouteHandlers().updateAppointment(request, requestId);
}
