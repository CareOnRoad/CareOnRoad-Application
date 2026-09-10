import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { loadActiveMechanicActor } from "./mechanic-operations.authorization";
import { MechanicOperationsError } from "./mechanic-operations.errors";
import { toDashboardResponse, type MechanicDashboardResponse } from "./mechanic-operations.mappers";

type ServiceOptions = {
  now?: () => Date;
};

export class MechanicDashboardService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: ServiceOptions = {}
  ) {}

  getDashboard(identity: VerifiedSupabaseIdentity): Promise<MechanicDashboardResponse> {
    const now = this.options.now?.() ?? new Date();
    return this.unitOfWork.execute(async ({ mechanicOperations, users }) => {
      const actor = await loadActiveMechanicActor(identity, users);
      const model = await mechanicOperations.getDashboard({
        mechanicId: actor.id,
        now,
        todayStart: startOfUtcDay(now),
        sevenDaysStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      });
      if (!model) {
        throw new MechanicOperationsError("NOT_FOUND", "Mechanic profile not found.", 404);
      }
      return toDashboardResponse(model, now);
    });
  }
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
