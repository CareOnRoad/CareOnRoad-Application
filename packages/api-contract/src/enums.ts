/**
 * Shared enum definitions. This module is the single source of truth for these
 * value sets across the workspace.
 *
 * The values must stay in sync with the PostgreSQL enums they mirror:
 * - `userRoles`   -> `app_role`      (202606250004_identity_and_roles.sql)
 * - `userStatuses` -> `user_status`  (202606250004_identity_and_roles.sql)
 * - `serviceTypes` -> `service_type` (202606250006_motorcycles_and_mechanics.sql)
 *
 * `src/__tests__/enum-parity.test.ts` enforces that synchronisation.
 */

export const userRoles = ["rider", "mechanic", "admin"] as const;

export const userStatuses = ["active", "suspended", "archived"] as const;

export const serviceTypes = [
  "emergency_rescue",
  "mobile_repair",
  "at_home_service",
  "periodic_maintenance",
  "other"
] as const;

export type UserRole = (typeof userRoles)[number];
export type UserStatus = (typeof userStatuses)[number];
export type ServiceType = (typeof serviceTypes)[number];
