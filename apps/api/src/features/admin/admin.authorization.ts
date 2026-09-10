import { requireActorRole } from "@/features/auth/authorization";
import {
  AuthError,
  type RequestActor,
  type VerifiedSupabaseIdentity
} from "@/features/auth/auth.types";
import type { UserRepository } from "@/server/repositories/contracts/user.repository";

export async function loadActiveAdminActor(
  identity: VerifiedSupabaseIdentity,
  users: Pick<UserRepository, "findActorById">
): Promise<RequestActor> {
  const actor = await users.findActorById(identity.subject);
  if (!actor) {
    throw new AuthError("FORBIDDEN", "An active administrator role is required.", 403);
  }

  const requestActor: RequestActor = {
    id: actor.id,
    ...(actor.displayName ? { display_name: actor.displayName } : {}),
    roles: actor.roles,
    status: actor.status
  };

  requireActorRole(requestActor, "admin");
  return requestActor;
}

export function requireActiveAdminActor(actor: RequestActor): RequestActor {
  requireActorRole(actor, "admin");
  return actor;
}
