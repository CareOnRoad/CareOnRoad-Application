/* global console, process */
// Read-only diagnostic: why is dispatch not matching mechanics?
// Prints NO credentials. Uses the same env loading as check-backend-schema.mjs.
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
    const requests = await tx`
      select sr.id, sr.service_type, sr.status, sr.created_at,
        (sr.service_location is not null) as has_location
      from service_requests sr
      order by sr.created_at desc
      limit 5`;
    console.log("=== RECENT SERVICE REQUESTS ===");
    for (const r of requests) console.log(JSON.stringify(r));

    const rounds = await tx`
      select r.id, r.request_id, r.round_number, r.status, r.radius_m, r.started_at, r.expires_at,
        (select count(*)::int from dispatch_candidates c where c.round_id = r.id) as candidate_count
      from dispatch_rounds r
      order by r.started_at desc limit 10`;
    console.log("\n=== RECENT DISPATCH ROUNDS ===");
    for (const r of rounds) console.log(JSON.stringify(r));

    const mechanics = await tx`
      select p.user_id, u.status as user_status, p.profile_status, p.is_available,
        p.service_radius_km,
        (p.latest_location is not null) as has_location,
        p.location_updated_at,
        now() - p.location_updated_at as location_age,
        coalesce((select array_agg(s.service_type::text) from mechanic_skills s where s.mechanic_id = p.user_id), array[]::text[]) as skills,
        exists(select 1 from user_roles r where r.user_id = p.user_id and r.role = 'mechanic') as has_role,
        (select count(*)::int from assignments a where a.mechanic_id = p.user_id
          and a.status in ('accepted','en_route','on_site','diagnosis','quoted','awaiting_payment','in_progress')) as active_work
      from mechanic_profiles p left join app_users u on u.id = p.user_id`;
    console.log("\n=== MECHANIC PROFILES ===");
    for (const m of mechanics) console.log(JSON.stringify(m));

    const candidates = await tx`
      select c.id, c.mechanic_id, c.round_id, c.request_id, c.status, c.rank, c.distance_m, c.created_at
      from dispatch_candidates c order by c.created_at desc limit 15`;
    console.log("\n=== RECENT DISPATCH CANDIDATES ===");
    for (const c of candidates) console.log(JSON.stringify(c));

    const offers = await tx`
      select o.id, o.candidate_id, o.mechanic_id, o.status, o.expires_at, o.created_at
      from dispatch_offers o order by o.created_at desc limit 15`;
    console.log("\n=== RECENT DISPATCH OFFERS ===");
    for (const o of offers) console.log(JSON.stringify(o));

    const assignments = await tx`
      select a.id, a.mechanic_id, a.request_id, a.status, a.created_at
      from assignments a order by a.created_at desc limit 10`;
    console.log("\n=== RECENT ASSIGNMENTS ===");
    for (const a of assignments) console.log(JSON.stringify(a));
  });
} catch (error) {
  console.log("DIAGNOSTIC_FAILED", error?.code ?? error?.name ?? "unknown", error?.message ?? "");
} finally {
  await sql.end({ timeout: 3 });
}
