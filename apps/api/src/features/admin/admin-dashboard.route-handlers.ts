import { NextResponse } from "next/server";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { listQuery } from "@/lib/list-pagination";
import { AdminDashboardService, type DashboardView } from "./admin-dashboard.service";
import { createDefaultAdminRouteDependencies, adminRouteError } from "./admin-route-helpers";
export function createAdminDashboardRouteHandlers(dependencies: { authenticate(request: Request): Promise<VerifiedSupabaseIdentity>; service: AdminDashboardService }) {
  return { async read(request: Request, view: DashboardView) {
    try { return NextResponse.json(await dependencies.service.read(await dependencies.authenticate(request), view, listQuery(request)), { headers: { "cache-control": "private, no-store" } }); }
    catch (error) { return adminRouteError(error); }
  } };
}
export function createDefaultAdminDashboardRouteHandlers() {
  const dependencies = createDefaultAdminRouteDependencies();
  return createAdminDashboardRouteHandlers({ authenticate: dependencies.authenticate, service: new AdminDashboardService(dependencies.unitOfWork) });
}
