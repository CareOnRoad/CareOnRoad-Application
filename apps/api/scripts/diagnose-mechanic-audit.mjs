/* global console, process */
// Read-only diagnostic 3: audit trail for mechanic profile + skill mutations.
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { loadEnv } from "vite";

const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(api, "../..");
const env = { ...loadEnv("test", root, ""), ...loadEnv("test", api, ""), ...process.env };

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 5,
  connection: { statement_timeout: "8000" },
});

try {
  await sql.begin("read only", async (tx) => {
    const audit = await tx`
      select a.created_at, a.action, a.actor_id, a.entity_type, a.entity_id,
        a.metadata::text as metadata
      from audit_log a
      where a.action like 'mechanic%' or a.action like '%profile%' or a.action like '%skill%'
      order by a.created_at desc limit 25`;
    console.log("=== AUDIT (mechanic/profile/skill) ===");
    for (const a of audit) console.log(JSON.stringify(a));

    const users = await tx`
      select u.id, u.created_at as user_created, u.status,
        p.created_at as profile_created, p.updated_at as profile_updated,
        (select count(*)::int from mechanic_skills s where s.mechanic_id = u.id) as skill_count
      from app_users u
      left join mechanic_profiles p on p.user_id = u.id
      order by u.created_at`;
    console.log("\n=== USERS + PROFILE TIMELINE ===");
    for (const u of users) console.log(JSON.stringify(u));

    const assignments = await tx`
      select a.id, a.mechanic_id, a.request_id, a.status, a.created_at
      from assignments a order by a.created_at desc limit 10`;
    console.log("\n=== RECENT ASSIGNMENTS ===");
    for (const a of assignments) console.log(JSON.stringify(a));

    const outbox = await tx`
      select o.created_at, o.topic, o.aggregate_id
      from outbox_events o
      where o.topic like 'mechanic%' or o.topic like '%profile%'
      order by o.created_at desc limit 25`;
    console.log("\n=== OUTBOX (mechanic/profile) ===");
    for (const o of outbox) console.log(JSON.stringify(o));
  });
} catch (error) {
  console.log("DIAGNOSTIC_FAILED", error?.code ?? error?.name ?? "unknown", error?.message ?? "");
} finally {
  await sql.end({ timeout: 3 });
}
