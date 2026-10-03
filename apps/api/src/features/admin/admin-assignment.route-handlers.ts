import { NextResponse } from "next/server";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { listQuery } from "@/lib/list-pagination";
import { AdminAssignmentService, type AdminAssignmentAction } from "./admin-assignment.service";
import { createDefaultAdminRouteDependencies, adminRouteError, readAdminJson, readAdminIdempotencyKey } from "./admin-route-helpers";

export function createAdminAssignmentRouteHandlers(dependencies: { authenticate(request: Request): Promise<VerifiedSupabaseIdentity>; service: AdminAssignmentService }) {
  return {
    async read(request: Request, id: string, view: "detail" | "timeline") {
      try { return NextResponse.json(await dependencies.service.read(await dependencies.authenticate(request), id, view, listQuery(request)), { headers: { "cache-control": "private, no-store" } }); }
      catch (error) { return adminRouteError(error); }
    },
    async command(request: Request, id: string, action: AdminAssignmentAction) {
      try { return NextResponse.json(await dependencies.service.command(await dependencies.authenticate(request), id, action, await readAdminJson(request), readAdminIdempotencyKey(request)),
        { status: ["manual_assign", "reassign", "note"].includes(action) ? 201 : 200 }); }
      catch (error) { return adminRouteError(error); }
    }
  };
}

export function createDefaultAdminAssignmentRouteHandlers() {
  const dependencies = createDefaultAdminRouteDependencies();
  return createAdminAssignmentRouteHandlers({ authenticate: dependencies.authenticate, service: new AdminAssignmentService(dependencies.unitOfWork) });
}
