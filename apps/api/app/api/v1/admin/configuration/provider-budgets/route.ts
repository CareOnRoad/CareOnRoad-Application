import { createDefaultAdminConfigurationRouteHandlers } from "@/features/admin/admin-configuration.route-handlers";
export const runtime="nodejs";
export const GET=(request:Request)=>createDefaultAdminConfigurationRouteHandlers().read(request,true);
