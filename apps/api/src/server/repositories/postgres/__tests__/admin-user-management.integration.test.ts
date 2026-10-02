import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AdminUserManagementService } from "@/features/admin/admin-user-management.service";
import { AdminMechanicManagementService } from "@/features/admin/admin-mechanic-management.service";
import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const INTEGRATION_TIMEOUT_MS = 30_000;
const mutationReason = {
  reason: "PostgreSQL administrative integration verification"
};

describeDatabase("admin user management PostgreSQL integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let adminOneId: string;
  let adminTwoId: string;
  let riderId: string;
  let deviceId: string;

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, {
      maxConnections: 8
    });
    sql = context.sql;
    await applyAllMigrations(sql);
  }, 30_000);

  beforeEach(async () => {
    adminOneId = randomUUID();
    adminTwoId = randomUUID();
    riderId = randomUUID();
    deviceId = randomUUID();
    await sql`
      insert into auth.users (id, created_at, updated_at)
      values
        (${adminOneId}, now(), now()),
        (${adminTwoId}, now(), now()),
        (${riderId}, now(), now())
    `;
    await sql`
      insert into app_users (id, display_name, phone_masked, status, updated_at)
      values
        (${adminOneId}, 'Admin One', null, 'active', now() - interval '1 minute'),
        (${adminTwoId}, 'Admin Two', null, 'active', now() - interval '2 minutes'),
        (${riderId}, 'Rider One', '***1234', 'active', now() - interval '3 minutes')
    `;
    await sql`
      insert into user_roles (user_id, role)
      values
        (${adminOneId}, 'admin'),
        (${adminTwoId}, 'admin'),
        (${riderId}, 'rider')
    `;
    await sql`
      insert into user_devices (
        id, user_id, device_key_hash, platform, enabled, last_registered_at
      )
      values (${deviceId}, ${riderId}, ${"a".repeat(64)}, 'android', true, now())
    `;
  });

  afterEach(async () => {
    if (!sql) return;
    await sql`
      delete from auth.users
      where id = any(${[adminOneId, adminTwoId, riderId]})
    `;
  }, INTEGRATION_TIMEOUT_MS);

  afterAll(async () => {
    await context?.dispose();
  }, 30_000);

  it(
    "supports bounded queries, safe devices, idempotent commands, audit, and outbox",
    async () => {
      const service = createService();
      const first = await service.listUsers(identity(adminOneId), { limit: "2" });
      expect(first.items).toHaveLength(2);
      expect(first.page.has_more).toBe(true);
      await expect(
        service.listUsers(identity(adminOneId), {
          limit: "2",
          cursor: first.page.next_cursor
        })
      ).resolves.toMatchObject({ items: [{ id: riderId }] });

      const devices = await service.listDevices(identity(adminOneId), riderId, {
        limit: "10"
      });
      expect(devices.items[0]).toMatchObject({
        id: deviceId,
        device_key_fingerprint: "aaaaaaaaaaaa"
      });
      expect(JSON.stringify(devices)).not.toContain("a".repeat(64));

      const command = () =>
        service.suspendUser(
          identity(adminOneId),
          riderId,
          mutationReason,
          "postgres-suspend-rider"
        );
      await expect(command()).resolves.toMatchObject({ status: "suspended" });
      await expect(command()).resolves.toMatchObject({ status: "suspended" });

      const [auditRows, outboxRows, idempotencyRows] = await Promise.all([
        sql`
          select action, admin_reason, metadata
          from audit_logs
          where entity_id = ${riderId}
        `,
        sql`select topic, payload from outbox_events where aggregate_id = ${riderId}`,
        sql`
          select response_status
          from idempotency_records
          where actor_id = ${adminOneId}
        `
      ]);
      expect(auditRows).toHaveLength(1);
      expect(auditRows[0]).toMatchObject({
        action: "admin.user.suspended",
        admin_reason: mutationReason.reason
      });
      expect(outboxRows).toHaveLength(1);
      expect(idempotencyRows).toEqual([{ response_status: 200 }]);
    },
    INTEGRATION_TIMEOUT_MS
  );

  it("revokes an approved idle mechanic without losing history and re-grants unavailable", async () => {
    const service = createService();
    const mechanics = new AdminMechanicManagementService(new PostgresUnitOfWork(sql));
    const actor = identity(adminOneId);
    const input = { ...mutationReason, role: "mechanic" };
    await service.grantRole(actor, riderId, input, "grant-mechanic");
    await mechanics.approve(actor, riderId, mutationReason, "approve-mechanic");
    await service.revokeRole(actor, riderId, input, "revoke-mechanic");
    await sql`update mechanic_profiles set rating_avg = 4.50, rating_count = 2, updated_at = now() where user_id = ${riderId}`;
    await expect(sql`update mechanic_profiles set is_available = true where user_id = ${riderId}`)
      .rejects.toMatchObject({ code: "23514" });
    await expect(mechanics.reactivate(actor, riderId, mutationReason, "reactivate-without-role"))
      .rejects.toMatchObject({ status: 409 });
    await service.grantRole(actor, riderId, input, "regrant-mechanic");
    expect(await sql`select profile_status, is_available, rating_count from mechanic_profiles where user_id = ${riderId}`)
      .toEqual([{ profile_status: "suspended", is_available: false, rating_count: 2 }]);
    await mechanics.reactivate(actor, riderId, mutationReason, "reactivate-regranted");
  });

  it.each(["suspend", "archive", "revoke-role"] as const)(
    "serializes simultaneous %s commands and preserves one active admin",
    async (operation) => {
      const firstService = createService();
      const secondService = createService();
      const commands = [
        disableAdmin(firstService, operation, adminOneId, adminTwoId, "first"),
        disableAdmin(secondService, operation, adminTwoId, adminOneId, "second")
      ];
      const results = await Promise.allSettled(commands);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
        1
      );
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(
        1
      );

      const rows = await sql<{ count: number }[]>`
        select count(distinct users.id)::integer as count
        from app_users users
        join user_roles roles
          on roles.user_id = users.id and roles.role = 'admin'
        where users.status = 'active'
      `;
      expect(rows[0]?.count).toBe(1);
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "rolls back user, audit, and idempotency writes when outbox append fails",
    async () => {
      const idempotencyId = randomUUID();
      const occurrenceId = randomUUID();
      const auditId = randomUUID();
      await sql`
        insert into outbox_events (
          id, topic, aggregate_type, aggregate_id, dedupe_key, payload
        )
        values (
          ${randomUUID()}, 'admin.user.suspended', 'app_user', ${riderId},
          ${`admin.user.suspended:${riderId}:${occurrenceId}`}, '{}'::jsonb
        )
      `;
      const identifiers = [idempotencyId, occurrenceId, auditId];
      const service = new AdminUserManagementService(
        new PostgresUnitOfWork(sql),
        { createId: () => identifiers.shift()! }
      );

      await expect(
        service.suspendUser(
          identity(adminOneId),
          riderId,
          mutationReason,
          "postgres-rollback-suspend"
        )
      ).rejects.toThrow();

      const [users, auditRows, idempotencyRows] = await Promise.all([
        sql`select status from app_users where id = ${riderId}`,
        sql`select id from audit_logs where id = ${auditId}`,
        sql`select id from idempotency_records where id = ${idempotencyId}`
      ]);
      expect(users).toEqual([{ status: "active" }]);
      expect(auditRows).toHaveLength(0);
      expect(idempotencyRows).toHaveLength(0);
    },
    INTEGRATION_TIMEOUT_MS
  );

  function createService() {
    return new AdminUserManagementService(new PostgresUnitOfWork(sql));
  }
});

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://careonroad.test/auth/v1",
    audience: ["authenticated"]
  };
}

function disableAdmin(
  service: AdminUserManagementService,
  operation: "suspend" | "archive" | "revoke-role",
  actorId: string,
  targetId: string,
  keySuffix: string
) {
  if (operation === "suspend") {
    return service.suspendUser(
      identity(actorId),
      targetId,
      mutationReason,
      `concurrent-suspend-${keySuffix}`
    );
  }
  if (operation === "archive") {
    return service.archiveUser(
      identity(actorId),
      targetId,
      mutationReason,
      `concurrent-archive-${keySuffix}`
    );
  }
  return service.revokeRole(
    identity(actorId),
    targetId,
    { ...mutationReason, role: "admin" },
    `concurrent-revoke-role-${keySuffix}`
  );
}

async function applyAllMigrations(sql: Pick<Sql, "unsafe">): Promise<void> {
  const migrationDirectory = resolve(process.cwd(), "..", "..", "supabase", "migrations");
  const migrationFiles = readdirSync(migrationDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    await sql.unsafe(readFileSync(resolve(migrationDirectory, migrationFile), "utf8"));
  }
}
