import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { loadActiveMechanicActor } from "./mechanic-operations.authorization";
import { MechanicOperationsError } from "./mechanic-operations.errors";
import {
  toPerformanceResponse,
  type MechanicPerformanceResponse
} from "./mechanic-operations.mappers";
import { mechanicPerformanceQuerySchema } from "./mechanic-operations.schemas";

export class MechanicPerformanceService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async getPerformance(
    identity: VerifiedSupabaseIdentity,
    query: unknown
  ): Promise<MechanicPerformanceResponse> {
    const filters = parsePerformanceFilters(query);
    return this.unitOfWork.execute(async ({ mechanicOperations, users }) => {
      const actor = await loadActiveMechanicActor(identity, users);
      const model = await mechanicOperations.getPerformance({
        mechanicId: actor.id,
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {})
      });
      if (!model) {
        throw new MechanicOperationsError("NOT_FOUND", "Mechanic profile not found.", 404);
      }
      return toPerformanceResponse(model);
    });
  }
}

function parsePerformanceFilters(input: unknown) {
  const parsed = mechanicPerformanceQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new MechanicOperationsError(
      "INVALID_INPUT",
      "Mechanic performance filters are invalid.",
      400,
      { issues: parsed.error.issues }
    );
  }
  return {
    ...(parsed.data.date_from ? { dateFrom: new Date(parsed.data.date_from) } : {}),
    ...(parsed.data.date_to ? { dateTo: new Date(parsed.data.date_to) } : {})
  };
}
