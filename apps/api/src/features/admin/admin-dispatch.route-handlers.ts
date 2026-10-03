import { NextResponse } from "next/server";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import { listQuery } from "@/lib/list-pagination";
import { createDefaultAdminRouteDependencies, adminRouteError, readAdminJson, readAdminIdempotencyKey } from "./admin-route-helpers";

export function createAdminDispatchRouteHandlers(dependencies: { authenticate(request: Request): Promise<VerifiedSupabaseIdentity>; service: DispatchService }) {
  return {
    async read(request: Request, requestId: string, view: "status" | "rounds" | "eligible" | "explanation") {
      try { return NextResponse.json(await dependencies.service.readAdminDispatch(await dependencies.authenticate(request), requestId, view, listQuery(request)), { headers: { "cache-control": "private, no-store" } }); }
      catch (error) { return adminRouteError(error); }
    },
    async round(request: Request, roundId: string) {
      try { return NextResponse.json(await dependencies.service.readAdminRound(await dependencies.authenticate(request), roundId), { headers: { "cache-control": "private, no-store" } }); }
      catch (error) { return adminRouteError(error); }
    },
    async command(request: Request, resourceId: string, action: "retry" | "cancel" | "expire") {
      try {
        const identity = await dependencies.authenticate(request);
        const key = readAdminIdempotencyKey(request);
        return NextResponse.json(await dependencies.service.commandAdminDispatch(identity, resourceId, action, await readAdminJson(request), key), { status: action === "retry" ? 202 : 200 });
      } catch (error) { return adminRouteError(error); }
    }
  };
}

export function createDefaultAdminDispatchRouteHandlers() {
  const dependencies = createDefaultAdminRouteDependencies();
  return createAdminDispatchRouteHandlers({ authenticate: dependencies.authenticate, service: new DispatchService(dependencies.unitOfWork) });
}
