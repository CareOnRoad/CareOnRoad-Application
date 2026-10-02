import { randomUUID } from "node:crypto";
import { readdirSync,readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Sql } from "postgres";
import { beforeAll,afterAll,describe,expect,it,vi } from "vitest";
import { AdminConfigurationService } from "@/features/admin/admin-configuration.service";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import { createIsolatedPostgresTestContext,hasPostgresTestDatabase,type IsolatedPostgresTestContext } from "@/server/testing/postgres-test-context";
import { PostgresUnitOfWork } from "../postgres-unit-of-work";
(hasPostgresTestDatabase()?describe:describe.skip)("dispatch configuration PostgreSQL invariants",()=>{
  let context:IsolatedPostgresTestContext,sql:Sql,uow:PostgresUnitOfWork;const admin=randomUUID(),rider=randomUUID(),bike=randomUUID(),now=new Date(),identity={subject:admin,issuer:"test",audience:["authenticated"]},reason="Reviewed and approved bounded dispatch configuration";
  beforeAll(async()=>{
    context=await createIsolatedPostgresTestContext(process.env,{maxConnections:5});sql=context.sql;
    const directory=resolve(process.cwd(),"..","..","supabase","migrations");for(const name of readdirSync(directory).filter(name=>name.endsWith(".sql")).sort())await sql.unsafe(readFileSync(resolve(directory,name),"utf8"));
    await sql`insert into auth.users(id) values(${admin})`;await sql`insert into app_users(id) values(${admin})`;await sql`insert into user_roles(user_id,role) values(${admin},'admin')`;uow=new PostgresUnitOfWork(sql);
    await sql`insert into auth.users(id) values(${rider})`;await sql`insert into app_users(id) values(${rider})`;await sql`insert into user_roles(user_id,role) values(${rider},'rider')`;
    await sql`insert into motorcycles(id,rider_id,brand_text,model_text) values(${bike},${rider},'Honda','Wave')`;
  },30_000);
  afterAll(async()=>{await context?.dispose({authUserIds:[admin,rider]});},30_000);
  it("serializes policy updates and idempotent replay, stores exact append-only version history",async()=>{
    const service=new AdminConfigurationService(uow,{enabled:true,now:()=>now});
    await service.update(identity,{reason,values:{"dispatch.offer_expiry_seconds":300,"dispatch.total_wait_seconds":300}},"initial-configuration-key");
    await Promise.all([1,8].map(value=>service.update(identity,{reason,values:{"dispatch.max_rounds":value}},`parallel-configuration-${value}`)));
    await service.update(identity,{reason,values:{"dispatch.max_rounds":8}},"parallel-configuration-8");
    expect(await sql`select version from admin_operation_configs where config_key='dispatch.max_rounds'`).toEqual([{version:2}]);
    expect(await sql`select count(*)::int amount from admin_operation_config_versions`).toEqual([{amount:4}]);
    const before=await sql`select * from admin_operation_configs order by config_key`;
    await expect(service.update(identity,{reason,values:{"dispatch.total_wait_seconds":60}},"invalid-partial-budget")).rejects.toMatchObject({status:400});
    expect(await sql`select * from admin_operation_configs order by config_key`).toEqual(before);
    for(const statement of ["update admin_operation_config_versions set reason='tampered history'","delete from admin_operation_config_versions","truncate admin_operation_config_versions","delete from admin_operation_configs","truncate admin_operation_configs cascade"])
      await expect(sql.unsafe(statement)).rejects.toMatchObject({code:"55000"});
    expect(await sql`select relrowsecurity from pg_class where oid in ('admin_operation_configs'::regclass,'admin_operation_config_versions'::regclass)`).toEqual([{relrowsecurity:true},{relrowsecurity:true}]);
    expect(await sql`select count(*)::int amount from information_schema.role_table_grants where table_schema=${context.schema} and table_name like 'admin_operation_config%' and grantee in ('anon','authenticated')`).toEqual([{amount:0}]);
  });
  it("native SQL rejects unknown keys, invalid values, nonsequential versions and cross-field budget",async()=>{
    await expect(sql`insert into admin_operation_configs(config_key,value_json,version,updated_by,updated_at,reason) values('PAYOS_API_KEY','"secret"',1,${admin},${now},${reason})`).rejects.toMatchObject({code:"23514"});
    await expect(sql`update admin_operation_configs set value_json='29',version=version+1 where config_key='dispatch.offer_expiry_seconds'`).rejects.toMatchObject({code:"23514"});
    await expect(sql`update admin_operation_configs set version=version+2 where config_key='dispatch.max_rounds'`).rejects.toMatchObject({code:"23514"});
    await expect(sql`update admin_operation_configs set value_json='60',version=version+1 where config_key='dispatch.total_wait_seconds'`).rejects.toMatchObject({code:"23514"});
  });
  it("persists non-default fractional radii and the worker retains the episode snapshot",async()=>{
    vi.stubEnv("ADMIN_DISPATCH_CONFIGURATION_ENABLED","true");
    try{
      const configuration=new AdminConfigurationService(uow,{enabled:true,now:()=>now});
      await configuration.update(identity,{reason,values:{"dispatch.radius_steps_km":[1.0001,3.1234,99.9999],"dispatch.offer_expiry_seconds":30,"dispatch.max_rounds":3,"dispatch.total_wait_seconds":180}},"custom-radius-configuration");
      const request=await uow.execute(r=>r.serviceRequests.create({id:randomUUID(),requestCode:"COR-MOB-20261003-1",riderId:rider,motorcycleId:bike,serviceType:"mobile_repair",problemDescription:"Local configurable radius fixture",status:"submitted",serviceLocation:{latitude:10,longitude:106},createdAt:now,updatedAt:now}));
      const first=await new DispatchService(uow,{now:()=>now}).startDispatch({...identity,subject:rider},request.id);expect(first.radius_m).toBe(1000);
      await configuration.update(identity,{reason,values:{"dispatch.radius_steps_km":[10]}},"change-radius-for-next-episode");
      for(const index of [1,2]){
        const time=new Date(now.getTime()+index*30_000);
        const [claimed]=await uow.execute(r=>r.dispatch.claimExpiredRounds({now:time,leaseOwner:"radius-worker",leaseUntil:new Date(time.getTime()+60_000),limit:1}));
        expect(await new DispatchService(uow,{now:()=>time}).processClaimedRound(claimed!.id,"radius-worker")).toBe("advanced");
      }
      expect(await sql`select radius_m from dispatch_rounds where request_id=${request.id} order by round_number`).toEqual([{radius_m:1000},{radius_m:3123},{radius_m:100000}]);
      await expect(sql`update dispatch_rounds set radius_m=999 where id=${first.id}`).rejects.toMatchObject({code:"23514"});
      await expect(sql`update dispatch_rounds set radius_m=100001 where id=${first.id}`).rejects.toMatchObject({code:"23514"});
    }finally{vi.unstubAllEnvs();}
  });
});
