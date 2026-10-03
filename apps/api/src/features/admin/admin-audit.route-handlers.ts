import { NextResponse } from "next/server";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { listQuery } from "@/lib/list-pagination";
import { AdminAuditService } from "./admin-audit.service";
import { createDefaultAdminRouteDependencies, adminRouteError } from "./admin-route-helpers";
export function createAdminAuditRouteHandlers(dependencies: { authenticate(request: Request): Promise<VerifiedSupabaseIdentity>; service: AdminAuditService }) {
  return {
    async read(request: Request, mode: "query" | "admin_actions" | "export", filters: { actor_id?: string; entity_type?: string; entity_id?: string } = {}) {
      try { return NextResponse.json(await dependencies.service.read(await dependencies.authenticate(request), { ...listQuery(request), ...filters }, mode), { headers: { "cache-control": "private, no-store" } }); }
      catch (error) { return adminRouteError(error); }
    }
  };
}
export function createDefaultAdminAuditRouteHandlers() {
  const dependencies = createDefaultAdminRouteDependencies();
  return createAdminAuditRouteHandlers({ authenticate: dependencies.authenticate, service: new AdminAuditService(dependencies.unitOfWork) });
}
