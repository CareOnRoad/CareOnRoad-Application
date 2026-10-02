import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Sql } from "postgres";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { AdminReminderService } from "@/features/admin/admin-reminder.service";
import { AdminDashboardService } from "@/features/admin/admin-dashboard.service";
import { ReminderWorker } from "@/server/workers/reminder.worker";
import { createIsolatedPostgresTestContext, hasPostgresTestDatabase, cleanupPostgresTables, type IsolatedPostgresTestContext } from "@/server/testing/postgres-test-context";
import { PostgresUnitOfWork } from "../postgres-unit-of-work";
const now=new Date("2026-10-02T03:00:00Z"), earlier=new Date(now.getTime()-3_600_000);
const admin=randomUUID(),rider=randomUUID(),bike=randomUUID(),rule=randomUUID(),occurrence=randomUUID();
const identity=(subject:string)=>({subject,issuer:"test",audience:["authenticated"]});
const reason={reason:"Checked reminder eligibility before safe recovery"};
(hasPostgresTestDatabase()?describe:describe.skip)("admin reminders/dashboard PostgreSQL",()=>{
  let context:IsolatedPostgresTestContext,sql:Sql,uow:PostgresUnitOfWork;
  beforeAll(async()=>{
    context=await createIsolatedPostgresTestContext(process.env,{maxConnections:6});sql=context.sql;
    const directory=resolve(process.cwd(),"..","..","supabase","migrations");
    for(const name of readdirSync(directory).filter(name=>name.endsWith(".sql")).sort()) await sql.unsafe(readFileSync(resolve(directory,name),"utf8"));
    for(const id of [admin,rider]) await sql`insert into auth.users(id,created_at,updated_at) values(${id},now(),now())`;
    uow=new PostgresUnitOfWork(sql);
  },30_000);
  beforeEach(async()=>{
    await cleanupPostgresTables(sql,["app_users","outbox_events","audit_logs","idempotency_records","worker_run_records"],{resetAppendOnlyTables:true});
    for(const id of [admin,rider]) await sql`insert into app_users(id,status,created_at,updated_at) values(${id},'active',${earlier},${now})`;
    await sql`insert into user_roles(user_id,role) values(${admin},'admin'),(${rider},'rider')`;
    await sql`insert into motorcycles(id,rider_id,brand_text,model_text,created_at,updated_at) values(${bike},${rider},'Honda','Wave',${earlier},${now})`;
    await sql`insert into reminder_rules(id,rider_id,motorcycle_id,title,interval_days,next_due_at,failure_count,created_at,updated_at) values(${rule},${rider},${bike},'private title',30,${earlier},3,${earlier},${earlier})`;
    await sql`insert into reminder_occurrences(id,rule_id,rider_id,motorcycle_id,due_at,status,created_at) values(${occurrence},${rule},${rider},${bike},${earlier},'failed',${earlier})`;
  });
  afterAll(async()=>{await context?.dispose({authUserIds:[admin,rider]});},30_000);
  it("serializes competing retries, preserves occurrence/notification identity and rule failures",async()=>{
    const service=new AdminReminderService(uow,{now:()=>now}),keys=["native-reminder-retry-one","native-reminder-retry-two"];
    const race=await Promise.allSettled(keys.map(key=>service.command(identity(admin),occurrence,"retry",reason,key)));
    expect(race.filter(result=>result.status==="fulfilled")).toHaveLength(1);
    const winner=race[0]!.status==="fulfilled"?keys[0]!:keys[1]!;
    await service.command(identity(admin),occurrence,"retry",reason,winner);
    await new ReminderWorker(uow,{now:()=>now}).processDueReminders();
    expect(await sql`select status::text,retry_count from reminder_occurrences`).toEqual([{status:"queued",retry_count:1}]);
    expect(await sql`select count(*)::int amount from notifications`).toEqual([{amount:1}]);
    expect(await sql`select count(*)::int amount from service_requests`).toEqual([{amount:0}]);
    expect(await sql`select failure_count from reminder_rules`).toEqual([{failure_count:3}]);
  });
  it("blocks retry during claimed lease and preserves terminal occurrences",async()=>{
    const service=new AdminReminderService(uow,{now:()=>now});
    await uow.execute(({reminders})=>reminders.claimDueRules({now,leaseOwner:"claimed-worker",leaseUntil:new Date(now.getTime()+60_000),limit:1}));
    await expect(service.command(identity(admin),occurrence,"retry",reason,"leased-reminder-retry")).rejects.toMatchObject({status:409});
    await sql`update reminder_rules set lease_owner=null,lease_expires_at=null where id=${rule}`;
    for(const status of ["sent","dismissed"]){
      await sql`update reminder_occurrences set status=${status} where id=${occurrence}`;
      await expect(service.command(identity(admin),occurrence,"retry",reason,`terminal-${status}-retry`)).rejects.toMatchObject({status:409});
    }
    expect(await sql`select count(*)::int amount from notifications`).toEqual([{amount:0}]);
  });
  it("serializes archive and enable with motorcycle first, rejecting all later enable/retry",async()=>{
    const service=new AdminReminderService(uow,{now:()=>now});
    await service.command(identity(admin),rule,"disable",reason,"disable-before-archive");
    const race=await Promise.allSettled([
      service.command(identity(admin),rule,"enable",{...reason,next_due_at:new Date(now.getTime()+86400_000).toISOString()},"enable-archive-race"),
      uow.execute(async({motorcycles})=>{await motorcycles.findByIdForUpdate(bike);return motorcycles.archive(bike,now);})
    ]);
    expect(race[1]!.status).toBe("fulfilled");
    expect(await sql`select enabled from reminder_rules where id=${rule}`).toEqual([{enabled:false}]);
    await expect(service.command(identity(admin),rule,"enable",{...reason,next_due_at:new Date(now.getTime()+86400_000).toISOString()},"enable-after-archive")).rejects.toMatchObject({status:409});
    await expect(sql`update reminder_rules set enabled=true where id=${rule}`).rejects.toMatchObject({code:"23514"});
  });
  it("reconciles native source aggregates and stable finding pagination without writing history",async()=>{
    await sql`insert into outbox_events(id,topic,aggregate_type,aggregate_id,dedupe_key,payload,status,created_at,next_attempt_at) values(${randomUUID()},'quote.created','quote',${randomUUID()},${randomUUID()},'{}','dead_letter',${earlier},${earlier}),(${randomUUID()},'quote.created','quote',${randomUUID()},${randomUUID()},'{}','pending',${earlier},${earlier})`;
    const service=new AdminDashboardService(uow,{now:()=>now});
    expect(await service.read(identity(admin),"summary")).toMatchObject({groups:{users:{active:2},reminders:{true:1},occurrences:{failed:1},outbox:{dead_letter:1,pending:1}}});
    const all=await service.read(identity(admin),"stuck-workflows",{limit:100});
    expect(all).toMatchObject({items:expect.arrayContaining([expect.objectContaining({category:"reminder_failures"}),expect.objectContaining({category:"outbox_dead_letter"}),expect.objectContaining({category:"worker_missing_progress"})])});
    const first=await service.read(identity(admin),"stuck-workflows",{limit:1}) as {items:{id:string}[];page:{next_cursor:string}};
    const second=await service.read(identity(admin),"stuck-workflows",{limit:1,cursor:first.page.next_cursor}) as {items:{id:string}[]};
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
    expect(await sql`select count(*)::int amount from audit_logs`).toEqual([{amount:0}]);
  });
  it("detects all nine categories exactly once per target/category and excludes future reservations from current work",async()=>{
    await sql`insert into user_roles(user_id,role) values(${rider},'mechanic')`;
    await sql`insert into mechanic_profiles(user_id,profile_status,service_radius_km,availability_updated_at,created_at,updated_at) values(${rider},'active',12,${earlier},${earlier},${earlier})`;
    await uow.execute(async r=>{
      const createRequest=(status:"manual_escalation"|"offered"|"in_service"|"assigned",schedule?:Date)=>r.serviceRequests.create({id:randomUUID(),requestCode:`COR-${schedule?"HOME":"MOB"}-20261002-${Math.floor(Math.random()*1000000)}`,riderId:rider,motorcycleId:bike,serviceType:schedule?"at_home_service":"mobile_repair",addressText:schedule?"Local fixture address":undefined,problemDescription:"private dashboard fixture",status,serviceLocation:{latitude:10,longitude:106},scheduledStartAt:schedule,createdAt:earlier,updatedAt:earlier});
      await createRequest("manual_escalation");const offered=await createRequest("offered");
      await r.dispatch.createRoundWithCandidates({round:{id:randomUUID(),requestId:offered.id,roundNumber:1,radiusMeters:2000,startedAt:earlier,expiresAt:now},candidates:[]});
      const current=await createRequest("in_service"),assignment=await r.assignments.create({id:randomUUID(),requestId:current.id,mechanicId:rider,source:"admin_manual",assignedByAdminId:admin,dispatchDistanceMeters:0,acceptedAt:earlier,createdAt:earlier,updatedAt:earlier});
      await r.quotes.create({id:randomUUID(),requestId:current.id,assignmentId:assignment.id,version:1,subtotalAmount:100,discountAmount:0,totalAmount:100,createdBy:rider,createdAt:earlier,expiresAt:now,lines:[{id:randomUUID(),lineType:"labor",description:"Labor",quantity:1,unitAmount:100,lineTotalAmount:100,sortOrder:1}]});
      for(const offset of [-30,60,180]){
        const schedule=new Date(now.getTime()+offset*60_000),request=await createRequest("assigned",schedule);
        const reserved=await r.assignments.create({id:randomUUID(),requestId:request.id,mechanicId:rider,source:"admin_manual",assignedByAdminId:admin,dispatchDistanceMeters:0,scheduledStartAt:schedule,reservationStartAt:new Date(schedule.getTime()-15*60_000),reservationEndAt:new Date(schedule.getTime()+15*60_000),acceptedAt:earlier,createdAt:earlier,updatedAt:earlier});
        if(offset===180){
          const quote=await r.quotes.create({id:randomUUID(),requestId:request.id,assignmentId:reserved.id,version:1,status:"approved",subtotalAmount:100,discountAmount:0,totalAmount:100,createdBy:rider,createdAt:earlier,lines:[{id:randomUUID(),lineType:"labor",description:"Labor",quantity:1,unitAmount:100,lineTotalAmount:100,sortOrder:1}]});
          await r.payments.create({id:randomUUID(),quoteId:quote.id,requestId:request.id,assignmentId:reserved.id,riderId:rider,providerOrderCode:123456,amount:100,description:"CORTEST",createdAt:earlier,updatedAt:earlier});
        }
      }
      for(const sequence of [1,2])await r.outbox.append({id:randomUUID(),topic:"quote.created",aggregateType:"quote",aggregateId:randomUUID(),dedupeKey:`dashboard-${sequence}`,payload:{},createdAt:earlier,nextAttemptAt:earlier});
    });
    // Only the operational failure fixture is seeded; no financial workflow is accepted by SQL seeding.
    await sql`update outbox_events set status='dead_letter' where id=(select id from outbox_events order by id limit 1)`;
    const service=new AdminDashboardService(uow,{now:()=>now}),response=await service.read(identity(admin),"stuck-workflows",{limit:100}) as {items:{id:string;category:string;target_id:string}[]};
    expect(new Set(response.items.map(row=>row.category)).size).toBe(9);
    expect(new Set(response.items.map(row=>`${row.category}:${row.target_id}`)).size).toBe(response.items.length);
    expect(response.items.filter(row=>row.category==="assignment_stalled")).toHaveLength(2);
    expect(await service.read(identity(admin),"assignments")).toMatchObject({groups:{assignment_slots:{current:1,future_reservation:3}}});
    const [current]=await sql<{id:string}[]>`select id from assignments where scheduled_start_at is null`;
    await sql`update assignments set updated_at=${new Date(now.getTime()-30*60_000+1)} where id=${current!.id}`;
    expect(await service.read(identity(admin),"stuck-workflows",{category:"assignment_stalled"})).toMatchObject({items:[expect.anything()]});
    await sql`update assignments set updated_at=${new Date(now.getTime()-30*60_000)} where id=${current!.id}`;
    const boundary=await service.read(identity(admin),"stuck-workflows",{category:"assignment_stalled"}) as {items:unknown[]};
    expect(boundary.items).toHaveLength(2);
  });
  it("paginates reminder worker health with millisecond cursor precision and excludes other workers",async()=>{
    const ids=[randomUUID(),randomUUID()].sort().reverse();
    for(const [index,id] of ids.entries())await sql`insert into worker_run_records(id,worker_name,status,items_claimed,items_succeeded,items_failed,started_at,completed_at,created_at) values(${id},'reminders','succeeded',0,0,0,${earlier},${now}::timestamptz+${(index+1)*100}*interval '1 microsecond',${now})`;
    await sql`insert into worker_run_records(id,worker_name,status,items_claimed,items_succeeded,items_failed,started_at,completed_at,created_at) values(${randomUUID()},'outbox','succeeded',0,0,0,${earlier},${now},${now})`;
    const service=new AdminReminderService(uow,{now:()=>now});
    const first=await service.read(identity(admin),"health",{limit:1}) as {items:{id:string}[];page:{next_cursor:string}};
    const second=await service.read(identity(admin),"health",{limit:1,cursor:first.page.next_cursor}) as {items:{id:string}[]};
    expect([...first.items,...second.items].map(row=>row.id)).toEqual(ids);
  });
});
