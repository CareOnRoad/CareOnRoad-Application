import type { UserRole, UserStatus } from "@/features/auth/auth.types";

import type {
  AdminUserActivityPage,
  AdminUserDevicePage,
  AdminUserListInput,
  AdminUserPage,
  ApplicationActor,
  ApplicationUser,
  CreateApplicationUser,
  RegisterUserDevice,
  UpdateApplicationUser,
  UserDevice,
  UserRepository,
  UserRoleRecord
} from "../contracts/user.repository";
import type { AuditLog } from "../contracts/audit.repository";

export class InMemoryUserRepository implements UserRepository {
  constructor(
    private readonly users: ApplicationUser[],
    private readonly roles: UserRoleRecord[],
    private readonly devices: UserDevice[],
    private readonly auditLogs: AuditLog[] = []
  ) {}

  async findById(id: string): Promise<ApplicationUser | undefined> {
    return this.users.find((user) => user.id === id);
  }

  async findActorById(id: string): Promise<ApplicationActor | undefined> {
    const user = await this.findById(id);
    if (!user) {
      return undefined;
    }
    return {
      ...user,
      roles: this.roles
        .filter((record) => record.userId === id)
        .map((record) => record.role)
        .sort()
    };
  }

  async createProfile(input: CreateApplicationUser): Promise<ApplicationUser> {
    const existing = await this.findById(input.id);
    if (existing) {
      return existing;
    }
    const now = new Date();
    const user: ApplicationUser = {
      id: input.id,
      displayName: input.displayName,
      phone: input.phone,
      phoneMasked: input.phoneMasked,
      address: input.address,
      avatarUrl: input.avatarUrl,
      status: input.status ?? "active",
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    };
    this.users.push(user);
    return user;
  }

  async updateProfile(
    id: string,
    input: UpdateApplicationUser,
    updatedAt: Date
  ): Promise<ApplicationActor> {
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new Error("USER_NOT_FOUND");
    if (input.displayName !== undefined && input.displayName !== null) {
      user.displayName = input.displayName;
    }
    if (input.phone !== undefined && input.phone !== null) {
      user.phone = input.phone;
    }
    if (input.phoneMasked !== undefined && input.phoneMasked !== null) {
      user.phoneMasked = input.phoneMasked;
    }
    if (input.address !== undefined && input.address !== null) {
      user.address = input.address;
    }
    if (input.avatarUrl !== undefined && input.avatarUrl !== null) {
      user.avatarUrl = input.avatarUrl;
    }
    user.updatedAt = updatedAt;
    return this.toActor(user);
  }

  async addRole(userId: string, role: UserRole): Promise<void> {
    if (!this.roles.some((record) => record.userId === userId && record.role === role)) {
      this.roles.push({ userId, role });
    }
  }

  async registerDevice(input: RegisterUserDevice): Promise<UserDevice> {
    const existing = this.devices.find(
      (device) =>
        device.userId === input.userId && device.deviceKeyHash === input.deviceKeyHash
    );
    if (existing) {
      existing.platform = input.platform;
      existing.enabled = true;
      existing.lastRegisteredAt = input.registeredAt;
      existing.updatedAt = input.registeredAt;
      return existing;
    }

    const device: UserDevice = {
      id: input.id,
      userId: input.userId,
      deviceKeyHash: input.deviceKeyHash,
      platform: input.platform,
      enabled: true,
      lastRegisteredAt: input.registeredAt,
      createdAt: input.registeredAt,
      updatedAt: input.registeredAt
    };
    this.devices.push(device);
    return device;
  }

  async listAdminUsers(input: AdminUserListInput): Promise<AdminUserPage> {
    const filtered = this.users
      .filter((user) => !input.status || user.status === input.status)
      .filter(
        (user) =>
          !input.role ||
          this.roles.some(
            (record) => record.userId === user.id && record.role === input.role
          )
      )
      .filter((user) => {
        if (!input.query) return true;
        const query = input.query.toLowerCase();
        return (
          user.id.toLowerCase().includes(query) ||
          user.displayName?.toLowerCase().includes(query) ||
          user.phoneMasked?.toLowerCase().includes(query)
        );
      })
      .filter((user) => !input.from || user.updatedAt >= input.from)
      .filter((user) => !input.to || user.updatedAt <= input.to)
      .sort(compareTimestampIdDesc)
      .filter((user) => !input.cursor || isAfterCursor(user, input.cursor));

    const page = filtered.slice(0, input.limit + 1);
    const items = page.slice(0, input.limit).map((user) => this.toActor(user));
    const last = items.at(-1);
    return {
      items,
      ...(page.length > input.limit && last
        ? { nextCursor: { timestamp: last.updatedAt, id: last.id } }
        : {})
    };
  }

  async findActorForUpdate(id: string): Promise<ApplicationActor | undefined> {
    return this.findActorById(id);
  }

  async updateStatus(
    id: string,
    status: UserStatus,
    updatedAt: Date
  ): Promise<ApplicationActor> {
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new Error("USER_NOT_FOUND");
    user.status = status;
    user.updatedAt = updatedAt;
    return this.toActor(user);
  }

  async listDevicesForAdmin(input: {
    userId: string;
    limit: number;
    cursor?: { timestamp: Date; id: string };
  }): Promise<AdminUserDevicePage> {
    const filtered = this.devices
      .filter((device) => device.userId === input.userId)
      .sort(compareTimestampIdDesc)
      .filter((device) => !input.cursor || isAfterCursor(device, input.cursor));
    const page = filtered.slice(0, input.limit + 1);
    const items = page.slice(0, input.limit);
    const last = items.at(-1);
    return {
      items,
      ...(page.length > input.limit && last
        ? { nextCursor: { timestamp: last.updatedAt, id: last.id } }
        : {})
    };
  }

  async deviceSummary(userId: string) {
    const devices = this.devices.filter((device) => device.userId === userId);
    return {
      total: devices.length,
      enabled: devices.filter((device) => device.enabled).length
    };
  }

  async findDeviceForUpdate(id: string): Promise<UserDevice | undefined> {
    return this.devices.find((device) => device.id === id);
  }

  async revokeDevice(id: string, updatedAt: Date): Promise<UserDevice> {
    const device = this.devices.find((item) => item.id === id);
    if (!device) throw new Error("DEVICE_NOT_FOUND");
    device.enabled = false;
    device.updatedAt = updatedAt;
    return device;
  }

  async disableExcessDevices(input: {
    userId: string;
    maximum: number;
    protectedDeviceId: string;
    updatedAt: Date;
  }): Promise<UserDevice[]> {
    const enabled = this.devices
      .filter((device) => device.userId === input.userId && device.enabled)
      .sort((left, right) =>
        left.id === input.protectedDeviceId
          ? -1
          : right.id === input.protectedDeviceId
            ? 1
            : right.lastRegisteredAt.getTime() - left.lastRegisteredAt.getTime() ||
              right.id.localeCompare(left.id)
      );
    const disabled = enabled.slice(input.maximum);
    for (const device of disabled) {
      device.enabled = false;
      device.updatedAt = input.updatedAt;
    }
    return disabled;
  }

  async grantRole(userId: string, role: UserRole): Promise<boolean> {
    if (this.roles.some((record) => record.userId === userId && record.role === role)) {
      return false;
    }
    this.roles.push({ userId, role });
    return true;
  }

  async revokeRole(userId: string, role: UserRole): Promise<boolean> {
    const index = this.roles.findIndex(
      (record) => record.userId === userId && record.role === role
    );
    if (index < 0) return false;
    this.roles.splice(index, 1);
    return true;
  }

  async acquireLastAdminGuard(): Promise<void> {
    // InMemoryUnitOfWork serializes transactions, providing the equivalent guard.
  }

  async countActiveAdmins(): Promise<number> {
    return this.users.filter(
      (user) =>
        user.status === "active" &&
        this.roles.some((record) => record.userId === user.id && record.role === "admin")
    ).length;
  }

  async listAdminActivity(input: {
    userId: string;
    limit: number;
    cursor?: { timestamp: Date; id: string };
    from?: Date;
    to?: Date;
  }): Promise<AdminUserActivityPage> {
    const filtered = this.auditLogs
      .filter(
        (log) =>
          (log.entityType === "app_user" && log.entityId === input.userId) ||
          log.metadata.user_id === input.userId
      )
      .filter((log) => !input.from || log.createdAt >= input.from)
      .filter((log) => !input.to || log.createdAt <= input.to)
      .sort((left, right) => compareDateIdDesc(left.createdAt, left.id, right.createdAt, right.id))
      .filter(
        (log) =>
          !input.cursor ||
          compareDateIdDesc(
            log.createdAt,
            log.id,
            input.cursor.timestamp,
            input.cursor.id
          ) > 0
      );
    const page = filtered.slice(0, input.limit + 1);
    const items = page.slice(0, input.limit).map((log) => ({
      id: log.id,
      ...(log.actorId ? { actorId: log.actorId } : {}),
      action: log.action,
      entityType: log.entityType,
      ...(log.entityId ? { entityId: log.entityId } : {}),
      metadata: log.metadata,
      createdAt: log.createdAt
    }));
    const last = items.at(-1);
    return {
      items,
      ...(page.length > input.limit && last
        ? { nextCursor: { timestamp: last.createdAt, id: last.id } }
        : {})
    };
  }

  private toActor(user: ApplicationUser): ApplicationActor {
    return {
      ...user,
      roles: this.roles
        .filter((record) => record.userId === user.id)
        .map((record) => record.role)
        .sort()
    };
  }
}

function compareTimestampIdDesc(
  left: { updatedAt: Date; id: string },
  right: { updatedAt: Date; id: string }
): number {
  return compareDateIdDesc(left.updatedAt, left.id, right.updatedAt, right.id);
}

function compareDateIdDesc(
  leftDate: Date,
  leftId: string,
  rightDate: Date,
  rightId: string
): number {
  return rightDate.getTime() - leftDate.getTime() || rightId.localeCompare(leftId);
}

function isAfterCursor(
  item: { updatedAt: Date; id: string },
  cursor: { timestamp: Date; id: string }
): boolean {
  return (
    item.updatedAt < cursor.timestamp ||
    (item.updatedAt.getTime() === cursor.timestamp.getTime() && item.id < cursor.id)
  );
}
