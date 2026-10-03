import { NextResponse } from "next/server";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { listQuery } from "@/lib/list-pagination";
import { AdminDeliveryService, type DeliveryAction, type DeliveryKind } from "./admin-delivery.service";
import { createDefaultAdminRouteDependencies, adminRouteError, readAdminJson, readAdminIdempotencyKey } from "./admin-route-helpers";
export function createAdminDeliveryRouteHandlers(dependencies: { authenticate(request: Request): Promise<VerifiedSupabaseIdentity>; service: AdminDeliveryService }) {
  return {
    async read(request: Request, kind: DeliveryKind, view: "list" | "detail" | "summary" | "health" | "dead_letter", id?: string) {
      try { return NextResponse.json(await dependencies.service.read(await dependencies.authenticate(request), kind, view, listQuery(request), id), { headers: { "cache-control": "private, no-store" } }); }
      catch (error) { return adminRouteError(error); }
    },
    async command(request: Request, kind: DeliveryKind, id: string, action: DeliveryAction) {
      try { return NextResponse.json(await dependencies.service.command(await dependencies.authenticate(request), kind, id, action, await readAdminJson(request), readAdminIdempotencyKey(request)), { status: action === "retry" ? 202 : 200 }); }
      catch (error) { return adminRouteError(error); }
    }
  };
}
export function createDefaultAdminDeliveryRouteHandlers() {
  const dependencies = createDefaultAdminRouteDependencies();
  return createAdminDeliveryRouteHandlers({ authenticate: dependencies.authenticate, service: new AdminDeliveryService(dependencies.unitOfWork) });
}
