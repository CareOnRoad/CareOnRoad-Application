import { AuthError, type RequestActor, type UserRole } from "./auth.types";

export function requireActiveActor(actor: RequestActor): void {
  if (actor.status === "suspended") {
    throw new AuthError("ACTOR_SUSPENDED", "The authenticated actor is suspended.", 403);
  }
  if (actor.status === "archived") {
    throw new AuthError("FORBIDDEN", "The authenticated actor is archived.", 403);
  }
}

export function requireActorRole(actor: RequestActor, role: UserRole): void {
  requireActiveActor(actor);
  if (!actor.roles.includes(role)) {
    throw new AuthError("FORBIDDEN", `The authenticated actor lacks the required role: ${role}.`, 403);
  }
}

export function assertActorOwns(actor: RequestActor, ownerId: string): void {
  requireActiveActor(actor);
  if (actor.id !== ownerId && !actor.roles.includes("admin")) {
    throw new AuthError("NOT_FOUND", "The requested resource is not visible to this actor.", 404);
  }
}
