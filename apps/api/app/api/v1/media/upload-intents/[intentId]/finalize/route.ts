import { createDefaultMediaUploadRouteHandlers } from "@/features/media-uploads/media-upload.route-handlers";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ intentId: string }> }
) {
  const { intentId } = await context.params;
  return createDefaultMediaUploadRouteHandlers().finalizeIntent(request, intentId);
}
