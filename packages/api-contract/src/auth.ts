import { z } from "zod";

import { userRoles, userStatuses } from "./enums";

/**
 * Authenticated actor as returned by `GET /api/v1/auth/me`. Mirrors
 * `RequestActor` in `apps/api/src/features/auth/auth.types.ts`.
 */
export const requestActorSchema = z.object({
  id: z.string(),
  display_name: z.string().optional(),
  roles: z.array(z.enum(userRoles)),
  status: z.enum(userStatuses)
});

export type RequestActor = z.infer<typeof requestActorSchema>;

/**
 * `GET /api/v1/auth/me` response body.
 *
 * The route handler returns `authService.getCurrentActor(identity)` directly
 * (`auth.route-handlers.ts:55`), so the actor IS the body — there is no
 * `{ actor: ... }` wrapper.
 */
export const authMeResponseSchema = requestActorSchema;
