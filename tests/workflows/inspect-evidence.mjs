import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
for(const file of ['.env','.env.local','apps/api/.env','apps/api/.env.local'])if(existsSync(file))process.loadEnvFile(file);
const postgres=createRequire(new URL('../../apps/api/package.json',import.meta.url))('postgres');
const schema=process.argv[2];
if(schema&&!/^cor_http_[a-f0-9]{16}$/.test(schema))throw Error('Private test schema required');
const sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false,onnotice:()=>{},connection:{search_path:schema?`${schema},public,extensions`:'public'}});
try{
  if(schema){const [row]=await sql`select exists(select 1 from information_schema.tables where table_schema=${schema} and table_name='notification_delivery_receipts') as present`;if(!row.present)throw Error('Private test evidence schema does not exist');}
  if(!schema)console.log(JSON.stringify(await sql`select nspname from pg_namespace where nspname like 'cor_http_%' order by oid desc limit 3`));
  else console.log(JSON.stringify({
    outbox:await sql`select topic,status,last_error_code,count(*)::int n from outbox_events group by topic,status,last_error_code order by n desc`,
    receipts:await sql`select status,last_error_code,count(*)::int n from notification_delivery_receipts group by status,last_error_code`,
    latest_receipts:await sql`select notification_id,status,attempt_count,last_attempted_at,completed_at,
      lease_token is not null as leased,lease_expires_at from notification_delivery_receipts order by created_at desc limit 6`,
    credentials:await sql`select id,device_id,credential_version,enabled,disabled_reason from device_delivery_credentials order by created_at`,
    notices:await sql`select status,last_error_code,count(*)::int n from notifications group by status,last_error_code`,
    latest_notices:await sql`select id,status,last_error_code,created_at from notifications order by created_at desc limit 6`,
    latest_notice_events:await sql`select aggregate_id,payload->>'notification_id' as notification_id,status,attempt_count,next_attempt_at from outbox_events where topic='notification.created' order by created_at desc limit 6`,
    active_assignments:await sql`select id,request_id,status,scheduled_start_at,activated_at from assignments where status in ('accepted','en_route','on_site','diagnosis','quoted','awaiting_payment','in_progress')`,
    mechanic_flags:await sql`select user_id,is_available,profile_status,location_updated_at from mechanic_profiles`
  },null,2));
}finally{await sql.end();}
