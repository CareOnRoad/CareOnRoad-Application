import { NextResponse } from "next/server";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { listQuery } from "@/lib/list-pagination";
import { AdminReminderService } from "./admin-reminder.service";
import { createDefaultAdminRouteDependencies, adminRouteError, readAdminJson, readAdminIdempotencyKey } from "./admin-route-helpers";
export function createAdminReminderRouteHandlers(dependencies: { authenticate(request: Request): Promise<VerifiedSupabaseIdentity>; service: AdminReminderService }) {
  return {
    async read(request: Request, view: "list" | "detail" | "occurrences" | "health", id?: string) {
      try { return NextResponse.json(await dependencies.service.read(await dependencies.authenticate(request), view, listQuery(request), id), { headers: { "cache-control": "private, no-store" } }); }
      catch (error) { return adminRouteError(error); }
    },
    async command(request: Request, id: string, action: "enable" | "disable" | "retry") {
      try { return NextResponse.json(await dependencies.service.command(await dependencies.authenticate(request), id, action, await readAdminJson(request), readAdminIdempotencyKey(request)), { status: action === "retry" ? 202 : 200 }); }
      catch (error) { return adminRouteError(error); }
    }
  };
}
export function createDefaultAdminReminderRouteHandlers() {
  const dependencies = createDefaultAdminRouteDependencies();
  return createAdminReminderRouteHandlers({ authenticate: dependencies.authenticate, service: new AdminReminderService(dependencies.unitOfWork) });
}
