import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { loadActiveMechanicActor } from "./mechanic-operations.authorization";
import { MechanicOperationsError } from "./mechanic-operations.errors";
import {
  decodeCursor,
  toJobPageResponse,
  type MechanicJobPageResponse
} from "./mechanic-operations.mappers";
import { mechanicJobListQuerySchema } from "./mechanic-operations.schemas";

export class MechanicJobListService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async listJobs(
    identity: VerifiedSupabaseIdentity,
    query: unknown
  ): Promise<MechanicJobPageResponse> {
    const filters = parseJobFilters(query);
    return this.unitOfWork.execute(async ({ mechanicOperations, users }) => {
      const actor = await loadActiveMechanicActor(identity, users);
      const page = await mechanicOperations.listJobs({
        mechanicId: actor.id,
        limit: filters.limit,
        ...(filters.cursor ? { cursor: filters.cursor } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.activeOnly !== undefined ? { activeOnly: filters.activeOnly } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {})
      });
      return toJobPageResponse(page.items, filters.limit, page.nextCursor);
    });
  }
}

function parseJobFilters(input: unknown) {
  const parsed = mechanicJobListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new MechanicOperationsError("INVALID_INPUT", "Mechanic job filters are invalid.", 400, {
      issues: parsed.error.issues
    });
  }
  try {
    return {
      limit: parsed.data.limit,
      ...(parsed.data.cursor ? { cursor: decodeCursor(parsed.data.cursor) } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.active_only !== undefined ? { activeOnly: parsed.data.active_only } : {}),
      ...(parsed.data.date_from ? { dateFrom: new Date(parsed.data.date_from) } : {}),
      ...(parsed.data.date_to ? { dateTo: new Date(parsed.data.date_to) } : {})
    };
  } catch {
    throw new MechanicOperationsError("INVALID_INPUT", "Mechanic job cursor is invalid.", 400);
  }
}
