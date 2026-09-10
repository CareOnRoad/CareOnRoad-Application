import type { ApiErrorCode } from "@/lib/api-error";

export const userRoles = ["rider", "mechanic", "admin"] as const;
export const userStatuses = ["active", "suspended", "archived"] as const;

export type UserRole = (typeof userRoles)[number];
export type UserStatus = (typeof userStatuses)[number];

export type VerifiedSupabaseIdentity = {
  subject: string;
  issuer: string;
  audience: string[];
};

export type RequestActor = {
  id: string;
  display_name?: string;
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
