import type { UserRole, UserStatus } from "@/features/auth/auth.types";
import type { JsonObject } from "./idempotency.repository";

export type ApplicationUser = {
  id: string;
  displayName?: string;
  phone?: string;
  phoneMasked?: string;
  address?: string;
  avatarUrl?: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ApplicationActor = ApplicationUser & {
  roles: UserRole[];
};

export type CreateApplicationUser = {
  id: string;
  displayName?: string;
  phone?: string;
  phoneMasked?: string;
  address?: string;
  avatarUrl?: string;
  status?: UserStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateApplicationUser = {
  displayName?: string | null;
  phone?: string | null;
  phoneMasked?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
};

export type UserRoleRecord = {
  userId: string;
  role: UserRole;
};

export type UserDevice = {
  id: string;
  userId: string;
  deviceKeyHash: string;
  platform: string;
  enabled: boolean;
  lastRegisteredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type RegisterUserDevice = {
  id: string;
  userId: string;
  deviceKeyHash: string;
  platform: string;
  registeredAt: Date;
};

export type AdminUserCursor = {
  timestamp: Date;
  id: string;
};

export type AdminUserListInput = {
  limit: number;
  cursor?: AdminUserCursor;
  role?: UserRole;
  status?: UserStatus;
  query?: string;
  from?: Date;
  to?: Date;
};

export type AdminUserPage = {
  items: ApplicationActor[];
  nextCursor?: AdminUserCursor;
};

export type AdminUserDevicePage = {
  items: UserDevice[];
  nextCursor?: AdminUserCursor;
};

export type AdminUserActivity = {
  id: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata: JsonObject;
  createdAt: Date;
};

export type AdminUserActivityPage = {
  items: AdminUserActivity[];
  nextCursor?: AdminUserCursor;
};

export type AdminDeviceSummary = {
  total: number;
  enabled: number;
};

export interface UserRepository {
  findById(id: string): Promise<ApplicationUser | undefined>;
  findActorById(id: string): Promise<ApplicationActor | undefined>;
  createProfile(input: CreateApplicationUser): Promise<ApplicationUser>;
  addRole(userId: string, role: UserRole): Promise<void>;
  /**
   * Cập nhật các trường profile editable (display_name, phone, address,
   * avatar_url). Chỉ patch những field được cung cấp (undefined = không đổi).
   * Trả về actor đã cập nhật (kèm roles). Caller phải đảm bảo identity đã
   * được verify; repository không enforce authz.
   */
  updateProfile(
    id: string,
    input: UpdateApplicationUser,
    updatedAt: Date,
  ): Promise<ApplicationActor>;
  registerDevice(input: RegisterUserDevice): Promise<UserDevice>;
  listAdminUsers(input: AdminUserListInput): Promise<AdminUserPage>;
  findActorForUpdate(id: string): Promise<ApplicationActor | undefined>;
  updateStatus(id: string, status: UserStatus, updatedAt: Date): Promise<ApplicationActor>;
  listDevicesForAdmin(input: {
    userId: string;
    limit: number;
    cursor?: AdminUserCursor;
  }): Promise<AdminUserDevicePage>;
  deviceSummary(userId: string): Promise<AdminDeviceSummary>;
  findDeviceForUpdate(id: string): Promise<UserDevice | undefined>;
  revokeDevice(id: string, updatedAt: Date): Promise<UserDevice>;
  disableExcessDevices(input: {
    userId: string;
    maximum: number;
    protectedDeviceId: string;
    updatedAt: Date;
  }): Promise<UserDevice[]>;
  grantRole(userId: string, role: UserRole): Promise<boolean>;
  revokeRole(userId: string, role: UserRole): Promise<boolean>;
  acquireLastAdminGuard(): Promise<void>;
  countActiveAdmins(): Promise<number>;
  listAdminActivity(input: {
    userId: string;
    limit: number;
    cursor?: AdminUserCursor;
    from?: Date;
    to?: Date;
  }): Promise<AdminUserActivityPage>;
}
