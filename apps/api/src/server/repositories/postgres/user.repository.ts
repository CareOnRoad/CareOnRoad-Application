import type { TransactionSql } from "postgres";

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
  UserDevice,
  UserRepository
} from "../contracts/user.repository";
import type { JsonObject } from "../contracts/idempotency.repository";

type UserRow = {
  id: string;
  display_name: string | null;
  phone_masked: string | null;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
  roles?: UserRole[] | null;
};

type UserDeviceRow = {
  id: string;
  user_id: string;
  device_key_hash: string;
  platform: string;
  enabled: boolean;
  last_registered_at: Date;
  created_at: Date;
  updated_at: Date;
};

type AuditActivityRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: JsonObject;
  created_at: Date;
};

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly sql: TransactionSql) {}

  async findById(id: string): Promise<ApplicationUser | undefined> {
    const rows = await this.sql<UserRow[]>`
      select id, display_name, phone_masked, status, created_at, updated_at
      from app_users
      where id = ${id}
      limit 1
    `;
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async findActorById(id: string): Promise<ApplicationActor | undefined> {
    const rows = await this.sql<UserRow[]>`
      select
        users.id,
        users.display_name,
        users.phone_masked,
        users.status,
        users.created_at,
        users.updated_at,
        coalesce(
          array_agg(roles.role::text order by roles.role) filter (where roles.role is not null),
          array[]::text[]
        ) as roles
      from app_users users
      left join user_roles roles on roles.user_id = users.id
      where users.id = ${id}
      group by users.id
      limit 1
    `;
    return rows[0] ? { ...mapUser(rows[0]), roles: rows[0].roles ?? [] } : undefined;
  }

  async createProfile(input: CreateApplicationUser): Promise<ApplicationUser> {
    const now = input.createdAt ?? new Date();
    const rows = await this.sql<UserRow[]>`
      insert into app_users (id, display_name, phone_masked, status, created_at, updated_at)
      values (
        ${input.id}, ${input.displayName ?? null}, ${input.phoneMasked ?? null},
        ${input.status ?? "active"}, ${now}, ${input.updatedAt ?? now}
      )
      on conflict (id) do update set id = excluded.id
      returning id, display_name, phone_masked, status, created_at, updated_at
    `;
    return mapUser(rows[0]!);
  }

  async addRole(userId: string, role: UserRole): Promise<void> {
    await this.sql`
      insert into user_roles (user_id, role)
      values (${userId}, ${role})
      on conflict (user_id, role) do nothing
    `;
  }

  async registerDevice(input: RegisterUserDevice): Promise<UserDevice> {
    const rows = await this.sql<UserDeviceRow[]>`
      insert into user_devices (
        id, user_id, device_key_hash, platform, enabled,
        last_registered_at, created_at, updated_at
      )
      values (
        ${input.id}, ${input.userId}, ${input.deviceKeyHash}, ${input.platform}, true,
        ${input.registeredAt}, ${input.registeredAt}, ${input.registeredAt}
      )
      on conflict (user_id, device_key_hash) do update
      set
        platform = excluded.platform,
        enabled = true,
        last_registered_at = excluded.last_registered_at,
        updated_at = excluded.updated_at
      returning *
    `;
    return mapUserDevice(rows[0]!);
  }

  async listAdminUsers(input: AdminUserListInput): Promise<AdminUserPage> {
    const rows = await this.sql<UserRow[]>`
      select
        users.id, users.display_name, users.phone_masked, users.status,
        users.created_at, users.updated_at,
        coalesce(
          array_agg(roles.role::text order by roles.role)
            filter (where roles.role is not null),
          array[]::text[]
        ) as roles
      from app_users users
      left join user_roles roles on roles.user_id = users.id
      where (${input.status ?? null}::user_status is null or users.status = ${input.status ?? null})
        and (
          ${input.role ?? null}::app_role is null
          or exists (
            select 1 from user_roles filter_role
            where filter_role.user_id = users.id
              and filter_role.role = ${input.role ?? null}
          )
        )
        and (
          ${input.query ?? null}::text is null
          or users.id::text ilike '%' || ${input.query ?? null} || '%'
          or coalesce(users.display_name, '') ilike '%' || ${input.query ?? null} || '%'
          or coalesce(users.phone_masked, '') ilike '%' || ${input.query ?? null} || '%'
        )
        and (${input.from ?? null}::timestamptz is null or users.updated_at >= ${input.from ?? null})
        and (${input.to ?? null}::timestamptz is null or users.updated_at <= ${input.to ?? null})
        and (
          ${input.cursor?.timestamp ?? null}::timestamptz is null
          or (users.updated_at, users.id) <
             (${input.cursor?.timestamp ?? null}, ${input.cursor?.id ?? null}::uuid)
        )
      group by users.id
      order by users.updated_at desc, users.id desc
      limit ${input.limit + 1}
    `;
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({ ...mapUser(row), roles: row.roles ?? [] })),
      ...(rows.length > input.limit && last
        ? { nextCursor: { timestamp: last.updated_at, id: last.id } }
        : {})
    };
  }

  async findActorForUpdate(id: string): Promise<ApplicationActor | undefined> {
    const rows = await this.sql<UserRow[]>`
      select id, display_name, phone_masked, status, created_at, updated_at
      from app_users
      where id = ${id}
      for update
    `;
    if (!rows[0]) return undefined;
    const roleRows = await this.sql<{ role: UserRole }[]>`
      select role from user_roles where user_id = ${id} order by role for update
    `;
    return { ...mapUser(rows[0]), roles: roleRows.map((row) => row.role) };
  }

  async updateStatus(
    id: string,
    status: UserStatus,
    updatedAt: Date
  ): Promise<ApplicationActor> {
    const rows = await this.sql<UserRow[]>`
      update app_users
      set status = ${status}, updated_at = ${updatedAt}
      where id = ${id}
      returning id, display_name, phone_masked, status, created_at, updated_at
    `;
    if (!rows[0]) throw new Error("USER_NOT_FOUND");
    const roleRows = await this.sql<{ role: UserRole }[]>`
      select role from user_roles where user_id = ${id} order by role
    `;
    return { ...mapUser(rows[0]), roles: roleRows.map((row) => row.role) };
  }

  async updateDisplayName(id: string, displayName: string, updatedAt: Date): Promise<ApplicationActor> {
    await this.sql`update app_users set display_name = ${displayName}, updated_at = ${updatedAt} where id = ${id}`;
    const actor = await this.findActorById(id);
    if (!actor) throw new Error("USER_NOT_FOUND");
    return actor;
  }

  async listDevicesForAdmin(input: {
    userId: string;
    limit: number;
    cursor?: { timestamp: Date; id: string };
  }): Promise<AdminUserDevicePage> {
    const rows = await this.sql<UserDeviceRow[]>`
      select *
      from user_devices
      where user_id = ${input.userId}
        and (
          ${input.cursor?.timestamp ?? null}::timestamptz is null
          or (updated_at, id) <
             (${input.cursor?.timestamp ?? null}, ${input.cursor?.id ?? null}::uuid)
        )
      order by updated_at desc, id desc
      limit ${input.limit + 1}
    `;
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map(mapUserDevice),
      ...(rows.length > input.limit && last
        ? { nextCursor: { timestamp: last.updated_at, id: last.id } }
        : {})
    };
  }

  async deviceSummary(userId: string) {
    const rows = await this.sql<{ total: number; enabled: number }[]>`
      select
        count(*)::integer as total,
        count(*) filter (where enabled)::integer as enabled
      from user_devices
      where user_id = ${userId}
    `;
    return rows[0] ?? { total: 0, enabled: 0 };
  }

  async findDeviceForUpdate(id: string): Promise<UserDevice | undefined> {
    const rows = await this.sql<UserDeviceRow[]>`
      select * from user_devices where id = ${id} for update
    `;
    return rows[0] ? mapUserDevice(rows[0]) : undefined;
  }

  async revokeDevice(id: string, updatedAt: Date): Promise<UserDevice> {
    const rows = await this.sql<UserDeviceRow[]>`
      update user_devices
      set enabled = false, updated_at = ${updatedAt}
      where id = ${id}
      returning *
    `;
    if (!rows[0]) throw new Error("DEVICE_NOT_FOUND");
    return mapUserDevice(rows[0]);
  }

  async disableExcessDevices(input: {
    userId: string;
    maximum: number;
    protectedDeviceId: string;
    updatedAt: Date;
  }): Promise<UserDevice[]> {
    const locked = await this.sql<UserDeviceRow[]>`
      select * from user_devices
      where user_id = ${input.userId} and enabled = true
      order by
        case when id = ${input.protectedDeviceId} then 0 else 1 end,
        last_registered_at desc,
        id desc
      for update
    `;
    const excessIds = locked.slice(input.maximum).map((row) => row.id);
    if (excessIds.length === 0) return [];
    const rows = await this.sql<UserDeviceRow[]>`
      update user_devices
      set enabled = false, updated_at = ${input.updatedAt}
      where id = any(${excessIds}::uuid[])
      returning *
    `;
    return rows.map(mapUserDevice);
  }

  async grantRole(userId: string, role: UserRole): Promise<boolean> {
    const rows = await this.sql<{ user_id: string }[]>`
      insert into user_roles (user_id, role)
      values (${userId}, ${role})
      on conflict (user_id, role) do nothing
      returning user_id
    `;
    return Boolean(rows[0]);
  }

  async revokeRole(userId: string, role: UserRole): Promise<boolean> {
    const rows = await this.sql<{ user_id: string }[]>`
      delete from user_roles
      where user_id = ${userId} and role = ${role}
      returning user_id
    `;
    return Boolean(rows[0]);
  }

  async acquireLastAdminGuard(): Promise<void> {
    await this.sql`select pg_advisory_xact_lock(3003, 1)`;
  }

  async countActiveAdmins(): Promise<number> {
    const rows = await this.sql<{ count: number }[]>`
      select count(distinct users.id)::integer as count
      from app_users users
      join user_roles roles on roles.user_id = users.id and roles.role = 'admin'
      where users.status = 'active'
    `;
    return rows[0]?.count ?? 0;
  }

  async listAdminActivity(input: {
    userId: string;
    limit: number;
    cursor?: { timestamp: Date; id: string };
    from?: Date;
    to?: Date;
  }): Promise<AdminUserActivityPage> {
    const rows = await this.sql<AuditActivityRow[]>`
      select id, actor_id, action, entity_type, entity_id, metadata, created_at
      from audit_logs
      where (
          (entity_type = 'app_user' and entity_id = ${input.userId})
          or metadata ->> 'user_id' = ${input.userId}
        )
        and (${input.from ?? null}::timestamptz is null or created_at >= ${input.from ?? null})
        and (${input.to ?? null}::timestamptz is null or created_at <= ${input.to ?? null})
        and (
          ${input.cursor?.timestamp ?? null}::timestamptz is null
          or (created_at, id) <
             (${input.cursor?.timestamp ?? null}, ${input.cursor?.id ?? null}::uuid)
        )
      order by created_at desc, id desc
      limit ${input.limit + 1}
    `;
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        id: row.id,
        ...(row.actor_id ? { actorId: row.actor_id } : {}),
        action: row.action,
        entityType: row.entity_type,
        ...(row.entity_id ? { entityId: row.entity_id } : {}),
        metadata: row.metadata,
        createdAt: row.created_at
      })),
      ...(rows.length > input.limit && last
        ? { nextCursor: { timestamp: last.created_at, id: last.id } }
        : {})
    };
  }
}

function mapUser(row: UserRow): ApplicationUser {
  return {
    id: row.id,
    displayName: row.display_name ?? undefined,
    phoneMasked: row.phone_masked ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUserDevice(row: UserDeviceRow): UserDevice {
  return {
    id: row.id,
    userId: row.user_id,
    deviceKeyHash: row.device_key_hash,
    platform: row.platform,
    enabled: row.enabled,
    lastRegisteredAt: row.last_registered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
