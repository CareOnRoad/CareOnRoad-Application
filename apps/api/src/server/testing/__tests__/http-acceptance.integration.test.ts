import { randomUUID } from "node:crypto";
import { execFile,spawn,type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { createServer,type Server } from "node:http";
import { createWriteStream,readdirSync,readFileSync,existsSync,mkdirSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { once } from "node:events";
import { beforeAll,afterAll,describe,expect,it } from "vitest";
import { decodeJwt } from "jose";
import type { Sql } from "postgres";
import { createPayosSignature } from "@/features/payments/payos-signature";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { createIsolatedPostgresTestContext,hasPostgresTestDatabase,type IsolatedPostgresTestContext } from "../postgres-test-context";
const run=promisify(execFile),authContainer="supabase_auth_careonroad-batch00-test";
const enabled=hasPostgresTestDatabase()&&process.env.RUN_HTTP_ACCEPTANCE==="true";
type ObjectBody=Record<string,unknown>;
type Account={id:string;token:string};
const workerSecret=randomUUID()+randomUUID(),checksum=randomUUID(),reason={reason:"Investigated local acceptance fixture before intervention"};
const location={latitude:10.7769,longitude:106.7009};
const checklist={work_summary:"Completed all approved work and safety inspection",safety_checklist:{test_ride_completed:true,tools_removed:true,area_safe:true,rider_briefed:true,no_fluid_leak:true}};
(enabled?describe:describe.skip)("real HTTP + local Supabase JWT/PostgreSQL acceptance (payOS simulated)",()=>{
  let context:IsolatedPostgresTestContext,sql:Sql,server:ChildProcess,provider:Server,origin:string,rider:Account,admin:Account,mechanic:Account,replacement:Account,bike:string;
  const accounts:Account[]=[],performanceUsers:string[]=[],orders=new Map<number,ObjectBody>();let providerOrigin:string;
  let restartServer:()=>Promise<void>;
  let standard:{requestId:string;assignmentId:string;quoteId:string};
  let providerGate:{started:()=>void;resume:Promise<void>}|undefined;
  async function authAccount():Promise<Account>{
    try{
      const signup=await run("docker",["exec",authContainer,"wget","-q","-O","-","--header=Content-Type: application/json","--post-data",JSON.stringify({email:`acceptance-${randomUUID()}@example.test`,password:randomUUID()+"Aa1!"}),"http://127.0.0.1:9999/signup"],{maxBuffer:1024*1024});
      const body=JSON.parse(signup.stdout) as {access_token?:string;user?:{id:string}};
      if(!body.access_token||!body.user?.id)throw new Error("LOCAL_AUTH_SIGNUP_FAILED");
      const account={id:body.user.id,token:body.access_token};accounts.push(account);return account;
    }catch{throw new Error("LOCAL_AUTH_SIGNUP_FAILED");} // execFile errors must not print temporary signup passwords or tokens.
  }
  async function request(path:string,account?:Account,method="GET",body?:unknown,status=200,worker=false):Promise<ObjectBody>{
    // Process termination invalidates pooled sockets; each acceptance request opens its own connection.
    const response=await fetch(`${origin}/api/v1${path}`,{method,headers:{connection:"close",...(account?{authorization:`Bearer ${account.token}`} : {}),...(body!==undefined?{"content-type":"application/json"}:{}),...(method!=="GET"?{"x-idempotency-key":randomUUID()}:{}),...(worker?{"x-worker-secret":workerSecret}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30_000)});
    const text=await response.text(),result=(text?JSON.parse(text):{}) as ObjectBody;
    if(response.status!==status)throw new Error(`${method} ${path}: expected ${status}, received ${response.status}; code=${String(result.error_code??"unknown")}; message=${String(result.message??"")}`);
    return result;
  }
  const post=(path:string,account:Account|undefined,body:unknown={},status=200)=>request(path,account,"POST",body,status);
  const worker=(name:string)=>request(`/internal/workers/${name}`,undefined,"POST",{},202,true);
  async function drainOutbox(){for(let index=0;index<20;index++){const result=await worker("outbox/run");if(result.claimed===0)return;}throw new Error("LOCAL_OUTBOX_DRAIN_LIMIT");}
  async function exhaustNotification(id:string){
    for(let index=0;index<10;index++){
      const [event]=await sql<{status:string}[]>`select status::text from outbox_events where topic='notification.created' and aggregate_id=${id}`;
      if(["processed","dead_letter"].includes(event!.status))return;
      // Advance retry clocks only; provider failures and dead-letter decisions must come from the HTTP worker.
      await sql`update outbox_events set next_attempt_at=now()-interval '1 second' where topic='notification.created' and aggregate_id=${id}`;
      await sql`update notification_delivery_receipts set next_attempt_at=now()-interval '1 second' where notification_id=${id} and status='retryable_failed'`;
      await drainOutbox();
    }throw new Error("NOTIFICATION_DID_NOT_EXHAUST");
  }
  async function refreshMechanic(account=mechanic){await request("/mechanics/me/location",account,"PUT",location,204);await request("/mechanics/me/availability",account,"PUT",{is_available:true});}
  async function job(serviceType:string){
    await refreshMechanic();
    const created=await post("/service-requests",rider,{motorcycle_id:bike,service_type:serviceType,problem_description:"Motorcycle needs local acceptance service",location,...(serviceType==="periodic_maintenance"?{scheduled_start_at:new Date(Date.now()+120_000).toISOString()}:{})},201);
    if(serviceType==="periodic_maintenance")await drainOutbox();else await post(`/service-requests/${created.id}/dispatch`,rider,{},202);
    const offers=await request("/dispatch/offers",mechanic);
    const offer=(offers.items as ObjectBody[]).find(row=>row.request_id===created.id);if(!offer)throw new Error("EXPECTED_HTTP_OFFER_MISSING");
    const assignment=await post(`/dispatch/offers/${offer.id}/accept`,mechanic,serviceType==="periodic_maintenance"?{estimated_duration_minutes:60}:{},201);
    return {requestId:String(created.id),assignmentId:String(assignment.id)};
  }
  const status=(id:string,value:string)=>post(`/assignments/${id}/status`,mechanic,{status:value});
  async function quote(job:{requestId:string;assignmentId:string},purpose="standard",lines=[{line_type:"labor",description:"Repair labor",quantity:1,unit_amount:100_000}]){
    return post(`/service-requests/${job.requestId}/quotes`,mechanic,{assignment_id:job.assignmentId,purpose,lines,...(purpose==="rescue_labor"?{lines:[],labor_pricing:{base_amount:100_000,distance_amount:0,weather_amount:0,time_amount:0,weather:"sunny"}}:{})},201);
  }
  async function pay(quoteId:string){
    const order=await post("/payments/orders",rider,{quote_id:quoteId},201);
    const data={orderCode:order.provider_order_code,amount:order.amount,currency:"VND",paymentLinkId:order.provider_payment_link_id,reference:randomUUID(),code:"00"};
    await post("/payments/webhooks/payos",undefined,{success:true,data,signature:"invalid"},401);
    const envelope={success:true,data,signature:createPayosSignature(data,checksum)};
    await post("/payments/webhooks/payos",undefined,envelope);await post("/payments/webhooks/payos",undefined,envelope);
    expect(await request(`/payments/orders/${order.id}`,rider)).toMatchObject({status:"succeeded"});
  }
  beforeAll(async()=>{
    context=await createIsolatedPostgresTestContext(process.env,{maxConnections:6});sql=context.sql;
    const migrations=resolve(process.cwd(),"..","..","supabase","migrations");for(const name of readdirSync(migrations).filter(name=>name.endsWith(".sql")).sort())await sql.unsafe(readFileSync(resolve(migrations,name),"utf8"));
    provider=createServer(async(req,res)=>{
      try{
        if(req.url==="/jwks"){const result=await run("docker",["exec",authContainer,"wget","-q","-O","-","http://127.0.0.1:9999/.well-known/jwks.json"]);res.setHeader("content-type","application/json");res.end(result.stdout);return;}
        let text="";for await(const chunk of req)text+=String(chunk);
        let data:ObjectBody;
        if(req.method==="POST"&&req.url==="/v2/payment-requests"){
          const body=JSON.parse(text) as ObjectBody;const signed=Object.fromEntries(["amount","cancelUrl","description","orderCode","returnUrl"].map(key=>[key,body[key]]));
          if(body.signature!==createPayosSignature(signed,checksum))throw new Error("PROVIDER_SIGNATURE_MISMATCH");
          data=orders.get(Number(body.orderCode))??{orderCode:body.orderCode,amount:body.amount,paymentLinkId:randomUUID(),checkoutUrl:`${providerOrigin}/checkout`,qrCode:"local-simulated-qr",status:"PENDING"};
          data.id=data.paymentLinkId;orders.set(Number(body.orderCode),data);
          if(providerGate){const gate=providerGate;providerGate=undefined;gate.started();await gate.resume;}
        }else{data=orders.get(Number(req.url?.split("/").at(-1)))??{};}
        res.setHeader("content-type","application/json");res.end(JSON.stringify({code:"00",desc:"success",data,signature:createPayosSignature(data,checksum)}));
      }catch{res.statusCode=500;res.end(JSON.stringify({code:"LOCAL_PROVIDER_ERROR"}));}
    });provider.listen(0,"127.0.0.1");await once(provider,"listening");providerOrigin=`http://127.0.0.1:${(provider.address() as {port:number}).port}`;
    [rider,admin,mechanic,replacement]=await Promise.all([authAccount(),authAccount(),authAccount(),authAccount()]);
    const portServer=createServer();portServer.listen(0,"127.0.0.1");await once(portServer,"listening");const port=(portServer.address() as {port:number}).port;await new Promise<void>(resolve=>portServer.close(()=>resolve()));origin=`http://127.0.0.1:${port}`;
    // Empty every project env key first, so production .env.local cannot fill a missing provider/worker setting.
    const environment={...process.env};for(const filename of [".env.example",".env.local","../../.env.local"]){if(existsSync(filename))for(const match of readFileSync(filename,"utf8").matchAll(/^([A-Z][A-Z0-9_]*)=/gm))environment[match[1]! ]="";}
    const database=new URL(process.env.TEST_DATABASE_URL!);database.searchParams.set("options",`-c search_path=${context.schema},public`);
    Object.assign(environment,{NODE_ENV:"production",DATABASE_URL:database.toString(),SUPABASE_JWT_ISSUER:String(decodeJwt(rider.token).iss),SUPABASE_JWT_AUDIENCE:"authenticated",SUPABASE_JWKS_URL:`${providerOrigin}/jwks`,INTERNAL_WORKER_SECRET:workerSecret,PAYMENTS_ENABLED:"true",PAYMENT_PROVIDER:"payos",PAYOS_CLIENT_ID:"local-only-client",PAYOS_API_KEY:"local-only-key",PAYOS_CHECKSUM_KEY:checksum,PAYOS_BASE_URL:providerOrigin,PAYOS_RETURN_URL:`${origin}/return`,PAYOS_CANCEL_URL:`${origin}/cancel`,PUSH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,11).toString("base64"),ADMIN_DISPATCH_CONFIGURATION_ENABLED:"true",NEXT_TELEMETRY_DISABLED:"1",ROUTE_ETA_PROVIDER:"disabled",LIVE_TRACKING_ENABLED:"false"});
    const logs=resolve(process.cwd(),"audit","batch-00","fix-batches","14");mkdirSync(logs,{recursive:true});const stream=createWriteStream(resolve(logs,"http-server.log"));
    restartServer=async()=>{
      if(server&&server.exitCode===null&&server.signalCode===null){server.kill();await once(server,"exit");}
      server=spawn(process.execPath,[resolve("node_modules/next/dist/bin/next"),"start","-H","127.0.0.1","-p",String(port)],{env:environment,windowsHide:true,stdio:["ignore","pipe","pipe"]});server.stdout?.pipe(stream,{end:false});server.stderr?.pipe(stream,{end:false});
      const until=Date.now()+60_000;while(true){try{await request("/internal/health/live");break;}catch{if(Date.now()>until||server.exitCode!==null)throw new Error("LOCAL_HTTP_SERVER_START_FAILED");await new Promise(resolve=>setTimeout(resolve,250));}}
    };await restartServer();
    await post("/auth/profile",rider,{account_type:"rider"});await post("/auth/profile",admin,{account_type:"rider"});
    await sql`insert into user_roles(user_id,role) values(${admin.id},'admin')`; // First administrator is a test bootstrap fixture only.
    for(const account of [mechanic,replacement]){await post("/auth/profile",account,{account_type:"mechanic"});await post(`/admin/mechanics/${account.id}/approve`,admin,reason);await request("/mechanics/me/profile",account,"PATCH",{service_types:["mobile_repair","emergency_rescue","periodic_maintenance"],service_radius_km:12});}
    const motorcycle=await post("/motorcycles",rider,{brand_text:"Honda",model_text:"Wave"},201);bike=String(motorcycle.id);
    await post("/auth/devices",rider,{device_key:"local-acceptance-device",platform:"android",push_provider:"fcm",push_token:"local-only-simulated-device-token"});
  },180_000);
  afterAll(async()=>{
    if(server&&server.exitCode===null&&server.signalCode===null){server.kill();await Promise.race([once(server,"exit"),new Promise(resolve=>setTimeout(resolve,5000))]);}
    if(provider)await new Promise<void>(resolve=>provider.close(()=>resolve()));
    await context?.dispose({authUserIds:[...accounts.map(account=>account.id),...performanceUsers]});
    const log=readFileSync(resolve("audit/batch-00/fix-batches/14/http-server.log"),"utf8");
    for(const secret of [checksum,workerSecret,...accounts.map(account=>account.token)])expect(log.includes(secret)).toBe(false);
  },30_000);
  it("standard request/accept restart/diagnosis/quote/signed payment/work/checklist/review/inbox",async()=>{
    const current=await job("mobile_repair");
    await restartServer();
    expect(await request(`/mechanics/me/jobs/${current.assignmentId}`,mechanic)).toBeTruthy();
    await status(current.assignmentId,"en_route");await status(current.assignmentId,"on_site");await status(current.assignmentId,"diagnosis");
    await post(`/assignments/${current.assignmentId}/diagnoses`,mechanic,{diagnosis_text:"Battery and wiring inspected"},201);
    const offer=await quote(current);await post(`/quotes/${offer.id}/approve`,rider);
    standard={...current,quoteId:String(offer.id)};
    await post(`/assignments/${current.assignmentId}/status`,mechanic,{status:"in_progress"},409);
    await pay(String(offer.id));await status(current.assignmentId,"in_progress");await post(`/assignments/${current.assignmentId}/completion-checklist`,mechanic,checklist,201);await status(current.assignmentId,"completed");
    await post(`/assignments/${current.assignmentId}/review`,rider,{rating:5,comment:"Local acceptance completed"},201);
    expect(await request(`/service-requests/${current.requestId}`,rider)).toMatchObject({status:"completed"});
    await worker("outbox/run");expect((await request("/notifications",rider)).items).toBeTruthy();
  },120_000);
  it.each(["labor_upfront","after_repair"])("rescue %s verifies approved labor and full payment before close",async timing=>{
    const current=await job("emergency_rescue"),labor=await quote(current,"rescue_labor");await post(`/quotes/${labor.id}/approve`,rider,{payment_timing:timing});
    if(timing==="labor_upfront")await pay(String(labor.id));
    await status(current.assignmentId,"en_route");await status(current.assignmentId,"on_site");await status(current.assignmentId,"diagnosis");
    const final=await quote(current,"rescue_final",[]);await post(`/quotes/${final.id}/approve`,rider);await status(current.assignmentId,"in_progress");await post(`/assignments/${current.assignmentId}/completion-checklist`,mechanic,checklist,201);
    await status(current.assignmentId,"awaiting_payment");
    if(timing==="after_repair")await pay(String(final.id));
    await status(current.assignmentId,"completed");expect(await request(`/service-requests/${current.requestId}`,rider)).toMatchObject({status:"completed"});
  },120_000);
  it("maintenance reserves, activates, approves materials and collects after quote-bound checklist",async()=>{
    const current=await job("periodic_maintenance"),labor=await quote(current,"maintenance_labor");await post(`/quotes/${labor.id}/approve`,rider);
    await status(current.assignmentId,"en_route");await status(current.assignmentId,"on_site");await status(current.assignmentId,"diagnosis");
    const work=await quote(current,"maintenance_work",[{line_type:"part",description:"Engine oil",quantity:1,unit_amount:120_000}]);await post(`/quotes/${work.id}/approve`,rider);await status(current.assignmentId,"in_progress");
    await post(`/assignments/${current.assignmentId}/completion-checklist`,mechanic,checklist,201);await status(current.assignmentId,"awaiting_payment");await pay(String(work.id));await status(current.assignmentId,"completed");
    expect(await request(`/service-requests/${current.requestId}`,rider)).toMatchObject({status:"completed"});
  },120_000);
  it("protects workers/admin and executes configured dispatch, reminder/outbox/reconciliation HTTP handoffs",async()=>{
    await request("/admin/dashboard/summary",rider,"GET",undefined,403);await request("/internal/workers/reminders/run",rider,"POST",{},401);
    await request("/admin/configuration/dispatch",admin,"PUT",{...reason,values:{"dispatch.max_rounds":2}});
    expect(await request("/admin/configuration",admin)).toMatchObject({enabled:true,values:{"dispatch.max_rounds":2}});
    await expect(sql`update dispatch_rounds set policy_snapshot=jsonb_set(policy_snapshot,'{dispatch.max_rounds}','8') where request_id=${standard.requestId}`).rejects.toMatchObject({code:"23514"});
    for(const route of ["dispatch/run","reminders/run","outbox/run","payments/reconcile"])await worker(route);
    await request("/admin/dashboard/stuck-workflows",admin);await request("/admin/reminders/worker-health",admin);
    await request("/assignments/00000000-0000-4000-8000-000000000000/live-location",rider,"GET",undefined,404);
    await request("/assignments/00000000-0000-4000-8000-000000000000/live-location",mechanic,"PUT",{},409);
  },120_000);
  it("reads admin retry/manual assign/reassign/void and failed reminder/delivery recovery back through role APIs",async()=>{
    for(const account of [mechanic,replacement])await request("/mechanics/me/availability",account,"PUT",{is_available:false});
    await request("/admin/configuration/dispatch",admin,"PUT",{...reason,values:{"dispatch.max_rounds":1}});
    const created=await post("/service-requests",rider,{motorcycle_id:bike,service_type:"mobile_repair",problem_description:"Local admin intervention fixture",location},201);
    const round=await post(`/service-requests/${created.id}/dispatch`,rider,{},202);
    // Advance only the test clock; escalation itself is executed by the protected worker.
    await sql`update dispatch_rounds set started_at=started_at-interval '61 seconds',expires_at=expires_at-interval '61 seconds' where id=${String(round.id)}`;
    await worker("dispatch/run");expect(await request(`/service-requests/${created.id}`,rider)).toMatchObject({status:"manual_escalation"});
    await refreshMechanic();await post(`/admin/service-requests/${created.id}/dispatch/retry`,admin,reason,202);
    const assigned=await post(`/admin/service-requests/${created.id}/dispatch/manual-assign`,admin,{...reason,mechanic_id:mechanic.id},201);
    await refreshMechanic(replacement);const reassigned=await post(`/admin/assignments/${assigned.id}/reassign`,admin,{...reason,mechanic_id:replacement.id},201);
    expect(await request(`/mechanics/me/jobs/${reassigned.id}`,replacement)).toBeTruthy();
    expect(await request(`/service-requests/${created.id}`,rider)).toMatchObject({status:"assigned"});
    for(const value of ["en_route","on_site","diagnosis"])await post(`/assignments/${reassigned.id}/status`,replacement,{status:value});
    const pending=await post(`/service-requests/${created.id}/quotes`,replacement,{assignment_id:reassigned.id,lines:[{line_type:"labor",description:"Repair",quantity:1,unit_amount:100_000}]},201);
    await post(`/admin/quotes/${pending.id}/void`,admin,reason);
    expect((await request(`/service-requests/${created.id}/quotes`,rider)).items).toEqual(expect.arrayContaining([expect.objectContaining({id:pending.id,status:"voided"})]));
    await post(`/admin/assignments/${reassigned.id}/cancel`,admin,reason);
    const reminder=await post("/reminders",rider,{motorcycle_id:bike,title:"Local recoverable reminder",interval_days:30,next_due_at:new Date(Date.now()+1000).toISOString(),enabled:true},201);
    await new Promise(resolve=>setTimeout(resolve,1100));await worker("reminders/run");await drainOutbox();
    const occurrences=await request(`/admin/reminders/${reminder.id}/occurrences`,admin),occurrence=(occurrences.items as ObjectBody[])[0]!;
    await exhaustNotification(String(occurrence.notification_id));
    // Inject an occurrence failure at the boundary; actual receipt/provider failure comes from the disabled FCM adapter.
    await sql`update reminder_occurrences set status='failed' where id=${String(occurrence.id)}`;
    await post(`/admin/reminder-occurrences/${occurrence.id}/retry`,admin,reason,202);
    expect((await request("/notifications",rider)).items).toEqual(expect.arrayContaining([expect.objectContaining({id:occurrence.notification_id,status:"pending"})]));
    await exhaustNotification(String(occurrence.notification_id));await post(`/admin/notifications/${occurrence.notification_id}/retry`,admin,reason,202);
    expect(await request(`/admin/notifications/${occurrence.notification_id}`,admin)).toMatchObject({status:"pending"});
    await post(`/admin/reminders/${reminder.id}/disable`,admin,reason);
  },120_000);
  it("reclaims an actual outbox worker lease after API termination and redispatches without duplicate recovery",async()=>{
    await request("/admin/configuration/dispatch",admin,"PUT",{...reason,values:{"dispatch.max_rounds":2,"dispatch.radius_steps_km":[1.0001,3.1234]}});
    await request("/mechanics/me/availability",replacement,"PUT",{is_available:false});
    const current=await job("mobile_repair");await refreshMechanic(replacement);await drainOutbox();
    await post(`/assignments/${current.assignmentId}/recover`,mechanic,{reason_code:"cannot_continue"});
    const [event]=await sql<{id:string}[]>`select id from outbox_events where aggregate_id=${current.assignmentId} and topic='assignment.recovery.requested'`;
    let unlock!:()=>void,locked!:()=>void;
    const ready=new Promise<void>(resolve=>{locked=resolve;}),release=new Promise<void>(resolve=>{unlock=resolve;});
    const blocker=sql.begin(async transaction=>{await transaction`select id from service_requests where id=${current.requestId} for update`;locked();await release;});
    await ready;let execution:Promise<unknown>|undefined;
    try{
      execution=worker("outbox/run").catch(()=>undefined);
      const deadline=Date.now()+10_000;
      while(true){const [claimed]=await sql<{status:string}[]>`select status::text from outbox_events where id=${event!.id}`;if(claimed!.status==="processing")break;if(Date.now()>deadline)throw new Error("OUTBOX_WORKER_DID_NOT_CLAIM");await new Promise(resolve=>setTimeout(resolve,50));}
      server.kill();await once(server,"exit");
    }finally{unlock();await blocker;await execution;}
    await restartServer();
    // Advance only the crashed worker's lease clock; the HTTP worker must perform recovery itself.
    await sql`update outbox_events set lease_expires_at=now()-interval '1 second' where id=${event!.id} and status='processing'`;
    await drainOutbox();
    expect(await request(`/service-requests/${current.requestId}`,rider)).toMatchObject({status:"offered"});
    expect((await request("/dispatch/offers",replacement)).items).toEqual(expect.arrayContaining([expect.objectContaining({request_id:current.requestId})]));
    expect(await sql`select status::text from outbox_events where id=${event!.id}`).toEqual([{status:"processed"}]);
    expect(await sql`select count(*)::int amount from outbox_events where topic='assignment.recovery.requested' and aggregate_id=${current.assignmentId}`).toEqual([{amount:1}]);
    await post(`/service-requests/${current.requestId}/cancel`,rider,{reason:"Local acceptance fixture cleanup"});
  },120_000);
  it("recovers an initializing payment link through HTTP after a real API process restart",async()=>{
    const current=await job("mobile_repair");for(const value of ["en_route","on_site","diagnosis"])await status(current.assignmentId,value);
    const pending=await quote(current);await post(`/quotes/${pending.id}/approve`,rider);
    let started!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>{started=resolve;}),paused=new Promise<void>(resolve=>{release=resolve;});providerGate={started,resume:paused};
    const creation=post("/payments/orders",rider,{quote_id:pending.id},201).catch(()=>undefined);
    await Promise.race([entered,new Promise((_,reject)=>setTimeout(()=>reject(new Error("PROVIDER_CREATION_NOT_ENTERED")),10_000))]);
    const [reserved]=await sql<{id:string;status:string;provider_order_code:number}[]>`select id,status,provider_order_code from payment_orders where request_id=${current.requestId}`;expect(reserved!.status).toBe("created");
    server.kill();await once(server,"exit");release();await creation;await restartServer();
    // Move only fixture timestamps past the worker's two-minute stale threshold.
    await sql`update payment_orders set created_at=created_at-interval '3 minutes',updated_at=updated_at-interval '3 minutes' where id=${reserved!.id}`;
    await worker("payments/reconcile");expect(await request(`/payments/orders/${reserved!.id}`,rider)).toMatchObject({status:"pending",provider_payment_link_id:orders.get(Number(reserved!.provider_order_code))!.paymentLinkId});
    await pay(String(pending.id));await status(current.assignmentId,"in_progress");await post(`/assignments/${current.assignmentId}/completion-checklist`,mechanic,checklist,201);await status(current.assignmentId,"completed");
  },120_000);
  it("measures every contracted admin GET with five warmups and twenty bounded PostgreSQL-backed HTTP requests",async()=>{
    // Only nonfinancial read-load fixtures are seeded; preceding workflow tests execute every money transition over HTTP.
    performanceUsers.push(...Array.from({length:100},()=>randomUUID()));
    await sql`insert into auth.users ${sql(performanceUsers.map(id=>({id})),"id")}`;
    await sql`insert into app_users(id) select id from auth.users where id=any(${performanceUsers}::uuid[])`;
    for(const [index,id] of performanceUsers.entries())await sql`insert into user_roles(user_id,role) values(${id},${index<50?"rider":"mechanic"})`;
    await sql`insert into mechanic_profiles(user_id,profile_status,service_radius_km) select user_id,'active',12 from user_roles where role='mechanic' and user_id=any(${performanceUsers}::uuid[])`;
    const fixtureTime=new Date();
    await new PostgresUnitOfWork(sql).execute(async repositories=>{
      for(let index=0;index<100;index++){
        const riderId=performanceUsers[index%50]!,motorcycleId=randomUUID(),requestId=randomUUID(),ruleId=randomUUID();
        await repositories.motorcycles.create({id:motorcycleId,riderId,brandText:"Honda",modelText:"Wave",createdAt:fixtureTime,updatedAt:fixtureTime});
        await repositories.serviceRequests.create({id:requestId,requestCode:`COR-MOB-20261002-${100000+index}`,riderId,motorcycleId,serviceType:"mobile_repair",problemDescription:"Local performance read fixture",status:index<50?"assigned":"submitted",serviceLocation:location,createdAt:fixtureTime,updatedAt:fixtureTime});
        if(index<50)await repositories.assignments.create({id:randomUUID(),requestId,mechanicId:performanceUsers[index+50]!,source:"admin_manual",assignedByAdminId:admin.id,dispatchDistanceMeters:0,acceptedAt:fixtureTime,createdAt:fixtureTime,updatedAt:fixtureTime});
        await repositories.reminders.createRule({id:ruleId,riderId,motorcycleId,title:"Local performance reminder",nextDueAt:new Date(fixtureTime.getTime()+86400_000),enabled:true,createdAt:fixtureTime,updatedAt:fixtureTime});
        await repositories.reminders.createOccurrenceIfNotExists({id:randomUUID(),ruleId,riderId,motorcycleId,dueAt:fixtureTime,status:"due",createdAt:fixtureTime});
        await repositories.notifications.createIfAbsent({id:randomUUID(),userId:riderId,type:"local.performance",title:"Local performance notification",body:"Bounded read fixture",data:{},dedupeKey:`local.performance:${index}`,createdAt:fixtureTime});
        await repositories.outbox.append({id:randomUUID(),topic:"motorcycle.created",aggregateType:"motorcycle",aggregateId:motorcycleId,dedupeKey:`local.performance.outbox:${index}`,payload:{},createdAt:fixtureTime,nextAttemptAt:fixtureTime});
      }
      for(let index=0;index<500;index++)await repositories.audit.append({id:randomUUID(),actorId:admin.id,actorRole:"admin",action:"local.performance",entityType:"test",entityId:randomUUID(),metadata:{},createdAt:fixtureTime});
    });
    const reminder=await post("/reminders",rider,{motorcycle_id:bike,title:"Local maintenance reminder",next_due_at:new Date(Date.now()+60_000).toISOString(),enabled:true},201);
    const [notification]=await sql<{id:string}[]>`select id from notifications where user_id=${rider.id} limit 1`,[event]=await sql<{id:string}[]>`select id from outbox_events limit 1`,[round]=await sql<{id:string}[]>`select id from dispatch_rounds where request_id=${standard.requestId} limit 1`;
    const ids:Record<string,string>={userId:rider.id,mechanicId:mechanic.id,requestId:standard.requestId,assignmentId:standard.assignmentId,quoteId:standard.quoteId,reminderId:String(reminder.id),notificationId:notification!.id,eventId:event!.id,roundId:round!.id,actorId:rider.id,entityType:"assignment",entityId:standard.assignmentId};
    const contract=readFileSync(resolve("../../specs/003-careonroad-admin-operations/contracts/admin-api.yaml"),"utf8"),results=[];
    for(const match of contract.matchAll(/^ {2}(\/admin\/[^:\n]+):\r?\n([\s\S]*?)(?=^ {2}\/|^components:|$(?![\s\S]))/gm)){
      if(!/^ {4}get:/m.test(match[2]!))continue;
      const path=match[1]!.replace(/\{([^}]+)\}/g,(_,key:string)=>{if(!ids[key])throw new Error(`PERFORMANCE_FIXTURE_MISSING:${key}`);return ids[key]!;});
      const durations=[];
      for(let index=0;index<25;index++){
        const started=performance.now(),body=await request(path,admin),elapsed=performance.now()-started;
        if(index>=5)durations.push(elapsed);
        if(Array.isArray(body.items))expect(body.items.length).toBeLessThanOrEqual(path.endsWith("/export")?10000:100);
        const serialized=JSON.stringify(body);expect(Buffer.byteLength(serialized)).toBeLessThan(2_000_000);
        for(const secret of [checksum,workerSecret,...accounts.map(account=>account.token)])expect(serialized.includes(secret),path).toBe(false);
      }
      const passed=durations.filter(value=>value<=2000).length;results.push({path,warmups:5,measured:20,within_two_seconds:passed,p95_ms:[...durations].sort((a,b)=>a-b)[18],max_ms:Math.max(...durations)});expect(passed,path).toBeGreaterThanOrEqual(19);
      writeFileSync(resolve("audit/batch-00/fix-batches/14/admin-performance.json"),JSON.stringify({complete:false,results},null,2));
    }
    expect(results.length).toBeGreaterThan(35);
    writeFileSync(resolve("audit/batch-00/fix-batches/14/admin-performance.json"),JSON.stringify({complete:true,mode:"local Supabase JWT/PostgreSQL HTTP",minimum_fixture:{users:100,mechanics:50,requests:100,assignments:50,audit:500,notifications:100,outbox:100,reminders:100,occurrences:100},results},null,2));
  },600_000);
});
