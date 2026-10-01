import type { ApiErrorCode } from "@/lib/api-error";

// Enum values live in the contract package so the backend and the admin web
// frontend share a single definition. `src/__tests__/enum-parity.test.ts` in
// that package keeps them aligned with the PostgreSQL enums.
export { userRoles, userStatuses } from "@careonroad/api-contract/enums";
export type { UserRole, UserStatus } from "@careonroad/api-contract/enums";

import type { UserRole, UserStatus } from "@careonroad/api-contract/enums";

export type VerifiedSupabaseIdentity = {
  subject: string;
  issuer: string;
  audience: string[];
};

export type RequestActor = {
  id: string;
  display_name?: string;
  phone?: string;
  address?: string;
  avatar_url?: string;
  roles: UserRole[];
  status: UserStatus;
};

export type RegisteredUserDevice = {
  id: string;
  platform: string;
  enabled: boolean;
  last_registered_at: string;
  push_token_registered: boolean;
  push_provider?: "fcm" | "apns" | "webpush";
  push_token_updated_at?: string;
};

export class AuthError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      | "UNAUTHORIZED"
      | "INVALID_TOKEN"
      | "ACTOR_SUSPENDED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "INVALID_INPUT"
      | "CONFLICT"
    >,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}
