import { createDefaultServiceRequestRouteHandlers } from "@/features/service-requests/service-request.route-handlers";

export const runtime = "nodejs";

type ServiceRequestRouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function POST(request: Request, context: ServiceRequestRouteContext) {
  const { requestId } = await context.params;
  return createDefaultServiceRequestRouteHandlers().cancelServiceRequest(request, requestId);
}
