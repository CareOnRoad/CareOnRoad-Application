/* global console, URL */
import process from "node:process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

for (const relative of ["../.env.local", "../../../.env.local"]) {
  const file = fileURLToPath(new URL(relative, import.meta.url));
  if (existsSync(file)) process.loadEnvFile(file);
}
const execute = process.argv.includes("--execute");
const ids = [...new Set((process.argv.find((arg) => arg.startsWith("--ids="))?.slice(6) ?? "").split(",").filter(Boolean))];
if (!ids.length || ids.length > 100 || ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
  throw new Error("Provide 1–100 explicit occurrence UUIDs with --ids=id1,id2. Preview is the default; --execute applies repairs.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
try {
  let repaired = 0;
  let eligible = 0;
  for (const id of ids) await sql.begin(async (transaction) => {
    // Match the rule -> occurrence lock order used by booking and reminder generation.
    if (execute) {
      const [selected] = await transaction`select rule_id from reminder_occurrences where id = ${id}`;
      if (!selected) return;
      await transaction`select id from reminder_rules where id = ${selected.rule_id} for update`;
    }
    const [occurrence] = await transaction`
      select o.*, r.title from reminder_occurrences o
      join reminder_rules r on r.id = o.rule_id
      join motorcycles m on m.id = o.motorcycle_id
      join app_users u on u.id = o.rider_id
      where o.id = ${id} and o.notification_id is null and o.status <> 'dismissed'
        and o.due_at <= now() and m.archived_at is null and u.status = 'active'
        and not exists (select 1 from service_requests s where s.reminder_context_id = o.id)
      ${execute ? transaction`for update of o` : transaction``}
    `;
    if (!occurrence) return;
    eligible++;
    if (!execute) return;
    const now = new Date();
    const dedupe = `maintenance.reminder:${id}`;
    const data = { reminder_id: occurrence.rule_id, reminder_context_id: id,
      motorcycle_id: occurrence.motorcycle_id, due_at: occurrence.due_at.toISOString() };
    const [created] = await transaction`insert into notifications (id, user_id, type, title, body, data, dedupe_key, created_at)
      values (${randomUUID()}, ${occurrence.rider_id}, 'maintenance.reminder', 'Đến lịch bảo dưỡng xe',
        ${occurrence.title}, ${transaction.json(data)}, ${dedupe}, ${now})
      on conflict (dedupe_key) do nothing returning id`;
    const [notification] = created ? [created] : await transaction`select id from notifications where dedupe_key = ${dedupe}`;
    if (created) {
      const payload = { resource_id: notification.id, actor_id: occurrence.rider_id, event_type: "maintenance.reminder", status: "pending" };
      await transaction`insert into outbox_events (id, topic, aggregate_type, aggregate_id, dedupe_key, payload, created_at, next_attempt_at)
        values (${randomUUID()}, 'notification.created', 'notification', ${notification.id},
          ${`notification.created:${dedupe}`}, ${transaction.json(payload)}, ${now}, ${now})`;
      await transaction`insert into audit_logs (id, action, entity_type, entity_id, metadata, created_at)
        values (${randomUUID()}, 'notification.created', 'notification', ${notification.id}, ${transaction.json(payload)}, ${now})`;
    }
    await transaction`update reminder_occurrences set notification_id = ${notification.id}, status = 'queued',
      processed_at = ${now} where id = ${id}`;
    repaired++;
  });
  console.log(JSON.stringify({ dry_run: !execute, selected: ids.length, eligible, repaired, skipped: ids.length - eligible }));
} catch {
  console.error(JSON.stringify({ error: "REMINDER_REPAIR_FAILED" }));
  process.exitCode = 1;
} finally {
  await sql.end();
}
