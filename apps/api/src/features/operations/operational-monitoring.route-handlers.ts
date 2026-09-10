import { NextResponse } from "next/server";

import { adminRouteError } from "@/features/admin/admin-route-helpers";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { OperationalMonitoringService, type OperationalQueue } from "./operational-monitoring.service";

export type OperationalMonitoringRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  service: Pick<OperationalMonitoringService, "list">;
};

export function createOperationalMonitoringRouteHandlers(dependencies: OperationalMonitoringRouteDependencies) {
  return {
    async list(request: Request, queue: OperationalQueue) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.service.list(identity, queue, request.url));
      } catch (error) { return adminRouteError(error); }
    }
  };
}

export function createDefaultOperationalMonitoringRouteHandlers() {
  return createOperationalMonitoringRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    service: new OperationalMonitoringService(new PostgresUnitOfWork(getPostgresClient()))
  });
}
