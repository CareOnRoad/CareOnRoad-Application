import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AuthService } from "@/features/auth/auth.service";
import { createPushTokenCipher } from "@/features/auth/push-token.crypto";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import {
  cleanupPostgresTables,
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";
import { PostgresUserRepository } from "../user.repository";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = legacyCompatibleMigrationFiles();

describeDatabase("PostgresUserRepository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let userId: string;
  let identity: VerifiedSupabaseIdentity;

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext();
    sql = context.sql;
    userId = randomUUID();
    await sql`
      insert into auth.users (id, created_at, updated_at)
      values (${userId}, now(), now())
    `;
    identity = {
      subject: userId,
      issuer: "https://integration-test.supabase.co/auth/v1",
      audience: ["authenticated"]
    };
    await applyMigrations(sql);
  });

  beforeEach(async () => {
    await cleanupPostgresTables(
      sql,
      ["device_delivery_credentials", "user_devices", "user_roles", "app_users", "audit_logs", "outbox_events", "idempotency_records"],
      { resetAppendOnlyAuditLogs: true }
    );
  });

  afterAll(async () => {
    await context?.dispose({ authUserIds: userId ? [userId] : [] });
  });

  it("creates an idempotent profile, loads roles, and refreshes device metadata", async () => {
    await sql.begin(async (transaction) => {
      const repository = new PostgresUserRepository(transaction);
      await repository.createProfile({ id: userId, displayName: "Rider" });
      await repository.addRole(userId, "rider");
      await repository.createProfile({ id: userId, displayName: "Other" });
      await repository.addRole(userId, "rider");

      await expect(repository.findActorById(userId)).resolves.toMatchObject({
        id: userId,
        displayName: "Rider",
        roles: ["rider"],
        status: "active"
      });

      const first = await repository.registerDevice({
        id: "11111111-1111-4111-8111-111111111111",
        userId,
        deviceKeyHash: "a".repeat(64),
        platform: "android",
        registeredAt: new Date("2026-06-25T01:00:00Z")
      });
      const refreshed = await repository.registerDevice({
        id: "22222222-2222-4222-8222-222222222222",
        userId,
        deviceKeyHash: "a".repeat(64),
        platform: "ios",
        registeredAt: new Date("2026-06-25T02:00:00Z")
      });

      expect(refreshed).toMatchObject({
        id: first.id,
        userId,
        platform: "ios",
        enabled: true
      });
    });
  });

  it("commits profile bootstrap with sanitized audit and outbox rows", async () => {
    const service = new AuthService(new PostgresUnitOfWork(sql), {
      now: () => new Date("2026-06-25T00:00:00Z"),
      createId: sequentialIds([
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444"
      ])
    });

    await service.bootstrapProfile(identity, { display_name: "Private Rider Name" });

    const [users, roles, outbox, audit] = await Promise.all([
      sql`select id from app_users`,
      sql`select user_id from user_roles`,
      sql<{ payload: Record<string, unknown> }[]>`select payload from outbox_events`,
      sql<{ metadata: Record<string, unknown> }[]>`select metadata from audit_logs`
    ]);
    expect(users).toHaveLength(1);
    expect(roles).toHaveLength(1);
    expect(outbox[0]?.payload).toEqual({ resource_id: userId });
    expect(audit[0]?.metadata).toEqual({ resource_id: userId, status: "active" });
    expect(JSON.stringify({ outbox, audit })).not.toContain("Private Rider Name");
  });

  it("rolls profile bootstrap back when the required outbox write conflicts", async () => {
    await sql`
      insert into outbox_events (
        id, topic, aggregate_type, aggregate_id, dedupe_key, payload
      )
      values (
        '55555555-5555-4555-8555-555555555555',
        'user.profile.bootstrapped',
        'app_user',
        ${userId},
        ${`user.profile.bootstrapped:${userId}`},
        '{}'::jsonb
      )
    `;

    await expect(
      new AuthService(new PostgresUnitOfWork(sql)).bootstrapProfile(identity, {
        display_name: "Rollback Rider"
      })
    ).rejects.toBeDefined();

    const [users, roles, outbox, audit] = await Promise.all([
      sql`select id from app_users`,
      sql`select user_id from user_roles`,
      sql`select id from outbox_events`,
      sql`select id from audit_logs`
    ]);
    expect(users).toHaveLength(0);
    expect(roles).toHaveLength(0);
    expect(outbox).toHaveLength(1);
    expect(audit).toHaveLength(0);
  });

  it("rolls device registration back on outbox conflict, then commits sanitized metadata", async () => {
    await sql.begin(async (transaction) => {
      const repository = new PostgresUserRepository(transaction);
      await repository.createProfile({ id: userId, displayName: "Rider" });
      await repository.addRole(userId, "rider");
    });

    const deviceId = "66666666-6666-4666-8666-666666666666";
    const occurrenceId = "77777777-7777-4777-8777-777777777777";
    await sql`
      insert into outbox_events (
        id, topic, aggregate_type, aggregate_id, dedupe_key, payload
      )
      values (
        '88888888-8888-4888-8888-888888888888',
        'user.device.registered',
        'user_device',
        ${deviceId},
        ${`user.device.registered:${deviceId}:${occurrenceId}`},
        '{}'::jsonb
      )
    `;

    const rawDeviceKey = "private-device-token-integration-123";
    const failingService = new AuthService(new PostgresUnitOfWork(sql), {
      now: () => new Date("2026-06-25T01:00:00Z"),
      createId: sequentialIds([
        deviceId,
        occurrenceId,
        "99999999-9999-4999-8999-999999999999"
      ])
    });
    await expect(
      failingService.registerDevice(identity, {
        device_key: rawDeviceKey,
        platform: "android"
      })
    ).rejects.toBeDefined();

    expect(await sql`select id from user_devices`).toHaveLength(0);
    expect(await sql`select id from audit_logs`).toHaveLength(0);

    await sql`delete from outbox_events`;
    const service = new AuthService(new PostgresUnitOfWork(sql), {
      now: () => new Date("2026-06-25T02:00:00Z"),
      createId: sequentialIds([
        deviceId,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      ])
    });
    await service.registerDevice(identity, {
      device_key: rawDeviceKey,
      platform: "android"
    });

    const [devices, outbox, audit] = await Promise.all([
      sql<{ device_key_hash: string }[]>`select device_key_hash from user_devices`,
      sql<{ payload: Record<string, unknown> }[]>`select payload from outbox_events`,
      sql<{ metadata: Record<string, unknown> }[]>`select metadata from audit_logs`
    ]);
    expect(devices).toHaveLength(1);
    expect(devices[0]?.device_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(outbox).toHaveLength(1);
    expect(audit).toHaveLength(1);
    expect(JSON.stringify({ devices, outbox, audit })).not.toContain(rawDeviceKey);
  });

  it("rotates encrypted push credentials and disables the oldest device at the limit", async () => {
    await sql.begin(async (transaction) => {
      const repository = new PostgresUserRepository(transaction);
      await repository.createProfile({ id: userId, displayName: "Rider" });
      await repository.addRole(userId, "rider");
    });
    let minute = 0;
    const service = new AuthService(new PostgresUnitOfWork(sql), {
      now: () => new Date(Date.UTC(2026, 5, 25, 4, minute++)),
      pushTokenCipher: createPushTokenCipher(Buffer.alloc(32, 11).toString("base64"))
    });
    const firstRaw = "private-integration-provider-token-first-123456";
    const secondRaw = "private-integration-provider-token-second-654321";
    const first = await service.registerDevice(identity, {
      device_key: "integration-installation-key-first-123456",
      platform: "android",
      push_provider: "fcm",
      push_token: firstRaw
    });
    await service.rotatePushToken(identity, first.id, {
      push_provider: "fcm",
      push_token: secondRaw
    });

    for (let index = 0; index < 5; index += 1) {
      await service.registerDevice(identity, {
        device_key: `integration-installation-key-${index}-123456`,
        platform: "android"
      });
    }

    const [devices, credentials, operational] = await Promise.all([
      sql<{ id: string; enabled: boolean }[]>`
        select id, enabled from user_devices order by last_registered_at, id
      `,
      sql<{
        enabled: boolean;
        credential_ciphertext: string | null;
        credential_iv: string | null;
        credential_tag: string | null;
        disabled_reason: string | null;
      }[]>`
        select enabled, credential_ciphertext, credential_iv, credential_tag, disabled_reason
        from device_delivery_credentials
        order by credential_version
      `,
      sql<{ payload: Record<string, unknown> }[]>`
        select payload from outbox_events
      `
    ]);
    expect(devices.filter((device) => device.enabled)).toHaveLength(5);
    expect(devices.find((device) => device.id === first.id)?.enabled).toBe(false);
    expect(credentials).toHaveLength(2);
    expect(credentials.every((credential) => !credential.enabled)).toBe(true);
    expect(credentials.at(-1)).toMatchObject({
      credential_ciphertext: null,
      credential_iv: null,
      credential_tag: null,
      disabled_reason: "device_limit"
    });
    expect(JSON.stringify({ devices, credentials, operational })).not.toContain(firstRaw);
    expect(JSON.stringify({ devices, credentials, operational })).not.toContain(secondRaw);
  });
});

async function applyMigrations(sql: Pick<Sql, "unsafe">): Promise<void> {
  for (const migrationFile of migrationFiles) {
    await sql.unsafe(
      readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8")
    );
  }
}

function legacyCompatibleMigrationFiles(): string[] {
  const files = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
    .filter(
      (name) => name.endsWith(".sql") && name.localeCompare("202606250014") < 0
    )
    .sort();
  return [...files, "202606250022_push_device_tokens.sql"];
}

function sequentialIds(ids: string[]): () => string {
  return () => {
    const id = ids.shift();
    if (!id) {
      throw new Error("Test ID sequence exhausted.");
    }
    return id;
  };
}
