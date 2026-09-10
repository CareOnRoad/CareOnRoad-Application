import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FakeMediaStorageProvider } from "@/features/media-uploads/fake-media-storage.provider";
import { MediaUploadService } from "@/features/media-uploads/media-upload.service";
import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

describeDatabase("media upload repository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  const now = new Date("2026-08-23T07:00:00.000Z");

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 8 });
    sql = context.sql;
    for (const migrationFile of migrationFiles) {
      await sql.unsafe(readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8"));
    }
    riderId = randomUUID();
    const motorcycleId = randomUUID();
    const requestId = randomUUID();
    await sql`insert into auth.users (id, created_at, updated_at) values (${riderId}, now(), now())`;
    await sql`insert into app_users (id, status) values (${riderId}, 'active')`;
    await sql`insert into user_roles (user_id, role) values (${riderId}, 'rider')`;
    await sql`
      insert into motorcycles (id, rider_id, brand_text, model_text)
      values (${motorcycleId}, ${riderId}, 'Honda', 'Wave')
    `;
    await sql`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type,
        problem_description, address_text, status, priority
      ) values (
        ${requestId}, 'COR-MOB-20260823-1', ${riderId}, ${motorcycleId},
        'mobile_repair', 'Khong no may', '1 Nguyen Trai', 'submitted', 'normal'
      )
    `;
  }, 120_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: riderId ? [riderId] : [] });
  }, 30_000);

  it("persists one verified media row under concurrent finalization", async () => {
    const requestRows = await sql<{ id: string }[]>`select id from service_requests limit 1`;
    const requestId = requestRows[0]!.id;
    const bytes = new TextEncoder().encode("postgres-verified-image");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const storage = new FakeMediaStorageProvider();
    const service = new MediaUploadService(
      new PostgresUnitOfWork(sql),
      storage,
      "private-media",
      { now: () => now }
    );
    const identity = { subject: riderId, issuer: "issuer", audience: ["authenticated"] };
    const intent = await service.createIntent(
      identity,
      {
        resource_type: "service_request",
        resource_id: requestId,
        purpose: "problem_photo",
        content_type: "image/jpeg",
        size_bytes: bytes.byteLength,
        sha256
      },
      "postgres-create-media"
    );
    storage.put("private-media", intent.object_key, bytes, "image/jpeg");
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        service.finalizeIntent(identity, intent.intent_id, `postgres-finalize-${index}`)
      )
    );
    expect(new Set(results.map((result) => result.media.id)).size).toBe(1);
    const [intentRows, mediaRows, auditRows, outboxRows] = await Promise.all([
      sql`select status, media_metadata_id from media_upload_intents where id = ${intent.intent_id}`,
      sql`select id, object_reference from request_media_metadata where request_id = ${requestId}`,
      sql`select metadata from audit_logs where entity_id = ${requestId}`,
      sql`select payload from outbox_events where aggregate_id = ${requestId}`
    ]);
    expect(intentRows).toEqual([expect.objectContaining({ status: "finalized" })]);
    expect(mediaRows).toHaveLength(1);
    expect(auditRows).toHaveLength(1);
    expect(outboxRows).toHaveLength(1);
    expect(JSON.stringify([...auditRows, ...outboxRows])).not.toMatch(new RegExp(`${sha256}|storage://`));
  }, 90_000);
});
