import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedPostgresTestContext, hasPostgresTestDatabase, type IsolatedPostgresTestContext } from "@/server/testing/postgres-test-context";
import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDb = hasPostgresTestDatabase() ? describe : describe.skip;
const migrations = readdirSync(resolve(process.cwd(), "../../supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
describeDb("chatbot session ownership integration", () => {
  let context: IsolatedPostgresTestContext; const users = [randomUUID(), randomUUID()];
  beforeAll(async () => { context = await createIsolatedPostgresTestContext(); for (const file of migrations) await context.sql.unsafe(readFileSync(resolve(process.cwd(), "../../supabase/migrations", file), "utf8")); for (const id of users) { await context.sql`insert into auth.users (id, created_at, updated_at) values (${id}, now(), now())`; await context.sql`insert into app_users (id, status) values (${id}, 'active')`; } }, 120_000);
  afterAll(async () => { await context?.dispose({ authUserIds: users }); }, 30_000);
  it("authorizes only hash holder and serializes conflicting claims", async () => {
    const unit = new PostgresUnitOfWork(context.sql); const hash = createHash("sha256").update("token").digest("hex");
    const session = await unit.execute(({ chatbotSessions }) => Promise.resolve(chatbotSessions.createSession(new Date(), { ownerCredentialHash: hash })));
    await expect(unit.execute(({ chatbotSessions }) => Promise.resolve(chatbotSessions.getAuthorizedSession(session.session_id, { credentialHash: createHash("sha256").update("wrong").digest("hex") })))).resolves.toBeNull();
    const claims = await Promise.all(users.map((id) => unit.execute(({ chatbotSessions }) => Promise.resolve(chatbotSessions.claimSessionOwner(session.session_id, hash, id)))));
    expect(claims.filter((item) => item?.claimed)).toHaveLength(1);
    const rows = await context.sql`select owner_user_id, owner_credential_hash from chatbot_sessions where id = ${session.session_id}`;
    expect(rows[0].owner_credential_hash).toBe(hash); expect(users).toContain(rows[0].owner_user_id);
  }, 90_000);
});
