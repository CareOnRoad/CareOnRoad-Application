import { createDefaultMediaUploadRouteHandlers } from "@/features/media-uploads/media-upload.route-handlers";

export const runtime = "nodejs";

export function POST(request: Request) {
  return createDefaultMediaUploadRouteHandlers().createIntent(request);
}
