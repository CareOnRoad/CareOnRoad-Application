import { createDefaultAdminConfigurationRouteHandlers } from "@/features/admin/admin-configuration.route-handlers";
export const runtime="nodejs";
export const PUT=(request:Request)=>createDefaultAdminConfigurationRouteHandlers().update(request);
