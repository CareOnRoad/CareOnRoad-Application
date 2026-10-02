import { NextResponse } from "next/server";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { listQuery } from "@/lib/list-pagination";
import { AdminSupervisionService, type SupervisionCommand } from "./admin-supervision.service";
import { createDefaultAdminRouteDependencies, adminRouteError, readAdminJson, readAdminIdempotencyKey } from "./admin-route-helpers";
export function createAdminSupervisionRouteHandlers(dependencies: { authenticate(request: Request): Promise<VerifiedSupabaseIdentity>; service: AdminSupervisionService }) {
  return {
    async read(request: Request, id: string, kind: "diagnosis" | "quote" | "quotes" | "actions") {
      try { return NextResponse.json(await dependencies.service.read(await dependencies.authenticate(request), id, kind, listQuery(request)), { headers: { "cache-control": "private, no-store" } }); }
      catch (error) { return adminRouteError(error); }
    },
    async command(request: Request, id: string, action: SupervisionCommand) {
      try { return NextResponse.json(await dependencies.service.command(await dependencies.authenticate(request), id, action, await readAdminJson(request), readAdminIdempotencyKey(request)), { status: action.endsWith("revision") ? 202 : 200 }); }
      catch (error) { return adminRouteError(error); }
    }
  };
}
export function createDefaultAdminSupervisionRouteHandlers() {
  const dependencies = createDefaultAdminRouteDependencies();
  return createAdminSupervisionRouteHandlers({ authenticate: dependencies.authenticate, service: new AdminSupervisionService(dependencies.unitOfWork) });
}
