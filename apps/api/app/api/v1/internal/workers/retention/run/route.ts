import { createDefaultRetentionRouteHandlers } from "@/features/retention/retention.route-handlers";
export const runtime = "nodejs";
export async function POST(request: Request) { return createDefaultRetentionRouteHandlers().run(request); }
