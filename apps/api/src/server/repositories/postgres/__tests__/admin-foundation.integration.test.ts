import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;

describeDatabase("admin foundation repositories integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let adminId: string;
  let riderId: string;
  let requestId: string;

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext();
    sql = context.sql;
    await applyAllMigrations(sql);

    adminId = randomUUID();
    riderId = randomUUID();
    const motorcycleId = randomUUID();
    requestId = randomUUID();
    await sql`
      insert into auth.users (id, created_at, updated_at)
      values (${adminId}, now(), now()), (${riderId}, now(), now())
    `;
    await sql`
      insert into app_users (id, status)
      values (${adminId}, 'active'), (${riderId}, 'active')
    `;
    await sql`
      insert into user_roles (user_id, role)
      values (${adminId}, 'admin'), (${riderId}, 'rider')
    `;
    await sql`
      insert into motorcycles (id, rider_id, brand_text, model_text)
      values (${motorcycleId}, ${riderId}, 'Honda', 'Wave')
    `;
    await sql`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type,
        problem_description, address_text
      )
      values (
        ${requestId}, 'COR-MOB-20260705-1', ${riderId}, ${motorcycleId},
        'mobile_repair', 'Engine does not start', 'District 7'
      )
    `;
  }, 30_000);

  afterAll(async () => {
    if (sql && adminId && riderId) {
      await sql.unsafe(`drop schema if exists "${context.schema}" cascade`);
      await sql`delete from auth.users where id = any(${[adminId, riderId]})`;
    }
    await context?.dispose();
  }, 30_000);

  it("persists and cursor-queries request notes without exposing mutation methods", async () => {
    const unitOfWork = new PostgresUnitOfWork(sql);
    const noteId = randomUUID();
    const createdAt = new Date("2026-07-05T01:00:00.000Z");

    await unitOfWork.execute(async ({ adminInternalNotes }) => {
      await adminInternalNotes.create({
        id: noteId,
        adminId,
        serviceRequestId: requestId,
        noteText: "Operational follow-up required.",
        createdAt
      });
    });

    const notes = await unitOfWork.execute(({ adminQueries }) =>
      adminQueries.listInternalNotes({ serviceRequestId: requestId, limit: 10 })
    );
    expect(notes).toEqual([
      {
        id: noteId,
        adminId,
        serviceRequestId: requestId,
        noteText: "Operational follow-up required.",
        createdAt
      }
    ]);
  });

  it("stores admin reason in the dedicated append-only audit column", async () => {
    const auditId = randomUUID();
    const unitOfWork = new PostgresUnitOfWork(sql);
    await unitOfWork.execute(({ audit }) =>
      audit.append({
        id: auditId,
        actorId: adminId,
        actorRole: "admin",
        action: "admin.foundation.test",
        entityType: "service_request",
        entityId: requestId,
        adminReason: "Operational correction required",
        metadata: { resource_id: requestId, status: "noted" }
      })
    );

    const rows = await sql<{ admin_reason: string; metadata: unknown }[]>`
      select admin_reason, metadata from audit_logs where id = ${auditId}
    `;
    expect(rows[0]).toMatchObject({
      admin_reason: "Operational correction required",
      metadata: { resource_id: requestId, status: "noted" }
    });
  });

  it("enforces target, note, and append-only constraints", async () => {
    await expect(
      sql`
        insert into admin_internal_notes (id, admin_id, note_text)
        values (${randomUUID()}, ${adminId}, 'Missing target')
      `
    ).rejects.toThrow();
    await expect(
      sql`
        insert into admin_internal_notes (
          id, admin_id, service_request_id, note_text
        )
        values (${randomUUID()}, ${adminId}, ${requestId}, '   ')
      `
    ).rejects.toThrow();

    const noteId = randomUUID();
    await sql`
      insert into admin_internal_notes (
        id, admin_id, service_request_id, note_text
      )
      values (${noteId}, ${adminId}, ${requestId}, 'Immutable note')
    `;
    await expect(
      sql`update admin_internal_notes set note_text = 'Changed' where id = ${noteId}`
    ).rejects.toThrow("admin_internal_notes is append-only");
    await expect(
      sql`delete from admin_internal_notes where id = ${noteId}`
    ).rejects.toThrow("admin_internal_notes is append-only");
  });

  it("rolls note and audit writes back atomically", async () => {
    const noteId = randomUUID();
    const auditId = randomUUID();
    const unitOfWork = new PostgresUnitOfWork(sql);

    await expect(
      unitOfWork.execute(async ({ adminInternalNotes, audit }) => {
        await adminInternalNotes.create({
          id: noteId,
          adminId,
          serviceRequestId: requestId,
          noteText: "This transaction must roll back."
        });
        await audit.append({
          id: auditId,
          actorId: adminId,
          actorRole: "admin",
          action: "admin.note.created",
          entityType: "service_request",
          entityId: requestId,
          adminReason: "Rollback integration test",
          metadata: { resource_id: requestId }
        });
        throw new Error("ROLLBACK_ADMIN_FOUNDATION");
      })
    ).rejects.toThrow("ROLLBACK_ADMIN_FOUNDATION");

    const [notes, logs] = await Promise.all([
      sql`select id from admin_internal_notes where id = ${noteId}`,
      sql`select id from audit_logs where id = ${auditId}`
    ]);
    expect(notes).toHaveLength(0);
    expect(logs).toHaveLength(0);
  });

  it("does not grant authenticated clients direct table access", async () => {
    const rows = await sql<{ can_select: boolean; can_insert: boolean }[]>`
      select
        has_table_privilege('authenticated', 'admin_internal_notes', 'select') as can_select,
        has_table_privilege('authenticated', 'admin_internal_notes', 'insert') as can_insert
    `;
    expect(rows[0]).toEqual({ can_select: false, can_insert: false });
  });
});

async function applyAllMigrations(sql: Pick<Sql, "unsafe">): Promise<void> {
  const migrationDirectory = resolve(process.cwd(), "..", "..", "supabase", "migrations");
  const migrationFiles = readdirSync(migrationDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    await sql.unsafe(readFileSync(resolve(migrationDirectory, migrationFile), "utf8"));
  }
}
