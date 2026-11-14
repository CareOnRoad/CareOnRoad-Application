/* global console, process */
// Read-only diagnostic 2: eligibility reason codes for the newest dispatch request.
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
    const rows = await tx`
      with profiles as (
        select p.user_id as mechanic_id, p.is_available, p.profile_status, p.service_radius_km::text,
          ST_Y(p.latest_location::geometry) as latitude, ST_X(p.latest_location::geometry) as longitude,
          p.location_updated_at, p.availability_updated_at, p.rating_avg::text, p.rating_count, p.created_at,
          coalesce((select array_agg(s.service_type::text order by s.service_type) from mechanic_skills s where s.mechanic_id = p.user_id), array[]::text[]) as service_types,
          round(ST_Distance(p.latest_location, r.service_location))::integer as distance_m,
          coalesce(u.status = 'active', false) as user_active,
          exists(select 1 from user_roles rr where rr.user_id = p.user_id and rr.role = 'mechanic') as has_role
        from mechanic_profiles p
        left join app_users u on u.id = p.user_id
        cross join (select service_location from service_requests order by created_at desc limit 1) r
      ), eligibility as (
        select *, array_remove(array[
          case when not user_active then 'user_inactive' end,
          case when not has_role then 'mechanic_role_missing' end,
          case when profile_status <> 'active' then 'profile_inactive' end,
          case when not is_available then 'unavailable' end,
          case when not ('emergency_rescue'::text = any(service_types)) then 'skill_mismatch' end,
          case when latitude is null then 'location_missing' end,
          case when location_updated_at is null or location_updated_at < now() - interval '300 seconds' then 'location_stale' end,
          case when distance_m > 2000 or distance_m > service_radius_km::numeric * 1000 then 'outside_radius' end,
          case when distance_m is null then 'request_or_mechanic_location_missing' end
        ], null)::text[] as reason_codes from profiles
      )
      select mechanic_id, is_available, profile_status, service_radius_km, distance_m, service_types,
        location_updated_at, now() - location_updated_at as location_age, reason_codes
      from eligibility order by distance_m asc`;
    console.log("=== ELIGIBILITY (newest request, radius 2000m) ===");
    for (const r of rows) console.log(JSON.stringify(r));

    const req = await tx`
      select id, ST_Y(service_location::geometry) as lat, ST_X(service_location::geometry) as lon, created_at
      from service_requests order by created_at desc limit 1`;
    console.log("\n=== NEWEST REQUEST LOCATION ===");
    console.log(JSON.stringify(req[0]));
  });
} catch (error) {
  console.log("DIAGNOSTIC_FAILED", error?.code ?? error?.name ?? "unknown", error?.message ?? "");
} finally {
  await sql.end({ timeout: 3 });
}
