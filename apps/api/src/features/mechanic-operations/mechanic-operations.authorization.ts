import { requireActorRole } from "@/features/auth/authorization";
import type { RequestActor, VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { UserRepository } from "@/server/repositories/contracts/user.repository";

import { MechanicOperationsError } from "./mechanic-operations.errors";

export async function loadActiveMechanicActor(
  identity: VerifiedSupabaseIdentity,
  users: UserRepository
): Promise<RequestActor> {
  const actor = await users.findActorById(identity.subject);
  if (!actor) {
    throw new MechanicOperationsError(
      "NOT_FOUND",
      "Application profile not found.",
      404
    );
  }
  requireActorRole(
    {
      id: actor.id,
      ...(actor.displayName ? { display_name: actor.displayName } : {}),
      roles: actor.roles,
      status: actor.status
    },
    "mechanic"
  );
  return {
    id: actor.id,
    ...(actor.displayName ? { display_name: actor.displayName } : {}),
    roles: actor.roles,
    status: actor.status
  };
}
