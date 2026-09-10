import { createDefaultMediaUploadCleanupRouteHandlers } from "@/features/media-uploads/media-upload.route-handlers";

export const runtime = "nodejs";

export function POST(request: Request) {
  return createDefaultMediaUploadCleanupRouteHandlers().cleanup(request);
}
