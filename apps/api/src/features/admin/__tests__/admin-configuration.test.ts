import { randomUUID } from "node:crypto";
import { afterEach,describe,expect,it,vi } from "vitest";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import { AdminConfigurationService } from "../admin-configuration.service";
import { createAdminConfigurationRouteHandlers } from "../admin-configuration.route-handlers";
const now=new Date("2026-10-02T03:00:00Z"),admin=randomUUID(),rider=randomUUID(),bike=randomUUID(),request=randomUUID();
const identity=(subject:string)=>({subject,issuer:"test",audience:["authenticated"]});
const reason="Investigated dispatch workload and approved the policy change";
function fixture(){return new InMemoryUnitOfWork({users:[admin,rider].map(id=>({id,status:"active",createdAt:now,updatedAt:now})),userRoles:[{userId:admin,role:"admin"},{userId:rider,role:"rider"}],serviceRequests:[{id:request,riderId:rider,motorcycleId:bike,requestCode:"COR-MOB-20261002-1",serviceType:"mobile_repair",problemDescription:"Engine stopped",status:"submitted",priority:"normal",serviceLocation:{latitude:10,longitude:106},createdAt:now,updatedAt:now}]});}
describe("optional dispatch configuration",()=>{
  afterEach(()=>vi.unstubAllEnvs());
  it("versions only changed keys, replays atomically and exposes no provider secret or fabricated quota",async()=>{
    const uow=fixture(),service=new AdminConfigurationService(uow,{enabled:true,now:()=>now,environment:{PAYOS_API_KEY:"private-key"}});
    const values={"dispatch.radius_steps_km":[1,100],"dispatch.offer_expiry_seconds":300,"dispatch.max_rounds":8,"dispatch.total_wait_seconds":1800};
    const result=await service.update(identity(admin),{reason,values},"configuration-update-key");
    expect(await service.update(identity(admin),{reason,values},"configuration-update-key")).toEqual(result);
    expect(uow.snapshot().adminConfigurationVersions).toHaveLength(4);
    expect(uow.snapshot().auditLogs).toHaveLength(1);expect(uow.snapshot().outboxEvents).toHaveLength(1);
    await service.update(identity(admin),{reason,values:{"dispatch.max_rounds":1}},"configuration-second-key");
    expect(uow.snapshot().adminConfigurationRows.find(row=>row.key==="dispatch.max_rounds")!.version).toBe(2);
    expect(JSON.stringify(await service.read(identity(admin),true))).not.toContain("private-key");
    expect(await service.read(identity(admin),true)).toMatchObject({read_only:true,providers:[expect.objectContaining({usage:null,remaining:null}),expect.anything(),expect.anything()]});
  });
  it.each([{"dispatch.unknown":3},{feature_flags:{payments:true}},{"dispatch.radius_steps_km":[5,2]},{"dispatch.radius_steps_km":[]},{"dispatch.offer_expiry_seconds":29},{"dispatch.max_rounds":9},{"dispatch.total_wait_seconds":1801},{PAYOS_API_KEY:"secret"},{}])("rejects invalid or unapproved values %j",async values=>{
    const uow=fixture(),before=uow.snapshot();await expect(new AdminConfigurationService(uow,{enabled:true}).update(identity(admin),{reason,values},"invalid-configuration-key")).rejects.toMatchObject({status:400});expect(uow.snapshot()).toEqual(before);
  });
  it("checks partial updates against stored expiry and disabled mode uses the original defaults",async()=>{
    const uow=fixture(),service=new AdminConfigurationService(uow,{enabled:true});
    await service.update(identity(admin),{reason,values:{"dispatch.offer_expiry_seconds":300}},"set-expiry-configuration");
    const before=uow.snapshot();await expect(service.update(identity(admin),{reason,values:{"dispatch.total_wait_seconds":60}},"invalid-budget-configuration")).rejects.toMatchObject({status:400});expect(uow.snapshot()).toEqual(before);
    const disabled=new AdminConfigurationService(uow,{enabled:false});expect(await disabled.read(identity(admin))).toMatchObject({enabled:false,values:{"dispatch.offer_expiry_seconds":60}});
    await expect(disabled.update(identity(admin),{reason,values:{"dispatch.max_rounds":1}},"disabled-update-key")).rejects.toMatchObject({status:409});
  });
  it("dispatch and worker use a pinned episode policy; later changes affect only a new episode",async()=>{
    vi.stubEnv("ADMIN_DISPATCH_CONFIGURATION_ENABLED","true");
    const uow=fixture(),service=new AdminConfigurationService(uow,{enabled:true,now:()=>now});
    await service.update(identity(admin),{reason,values:{"dispatch.radius_steps_km":[1,3],"dispatch.offer_expiry_seconds":30,"dispatch.max_rounds":2,"dispatch.total_wait_seconds":60}},"initial-policy-key");
    const first=await new DispatchService(uow,{now:()=>now}).startDispatch(identity(rider),request);
    expect(first).toMatchObject({radius_m:1000,expires_at:new Date(now.getTime()+30_000).toISOString()});
    await service.update(identity(admin),{reason,values:{"dispatch.radius_steps_km":[10],"dispatch.offer_expiry_seconds":120,"dispatch.max_rounds":8,"dispatch.total_wait_seconds":1800}},"later-policy-key");
    const later=new Date(now.getTime()+30_000),dispatch=new DispatchService(uow,{now:()=>later});
    await uow.execute(({dispatch})=>dispatch.claimExpiredRounds({now:later,leaseOwner:"worker",leaseUntil:new Date(later.getTime()+60_000),limit:1}));
    expect(await dispatch.processClaimedRound(first.id,"worker")).toBe("advanced");
    expect(uow.snapshot().dispatchRounds[1]).toMatchObject({radiusMeters:3000,expiresAt:new Date(now.getTime()+60_000),policySnapshot:{"dispatch.max_rounds":2}});
    await expect(new DispatchService(uow,{now:()=>new Date(now.getTime()+60_000)}).startDispatch(identity(rider),request)).rejects.toMatchObject({status:409});
    expect(uow.snapshot().serviceRequests[0]!.status).toBe("manual_escalation");
    await new DispatchService(uow,{now:()=>new Date(now.getTime()+60_000)}).commandAdminDispatch(identity(admin),request,"retry",{reason},"new-episode-policy-key");
    expect(uow.snapshot().dispatchRounds[2]).toMatchObject({radiusMeters:10000,policySnapshot:{"dispatch.max_rounds":8}});
  });
  it("authorizes configuration reads/writes and rejects extra query/unsupported fields",async()=>{
    const service=new AdminConfigurationService(fixture(),{enabled:true}),routes=createAdminConfigurationRouteHandlers({authenticate:async()=>identity(rider),service});
    expect((await routes.read(new Request("http://localhost/"))).status).toBe(403);
    const adminRoutes=createAdminConfigurationRouteHandlers({authenticate:async()=>identity(admin),service});
    expect((await adminRoutes.read(new Request("http://localhost/?secret=true"))).status).toBe(400);
    expect((await adminRoutes.update(new Request("http://localhost/",{method:"PUT",body:JSON.stringify({reason,values:{"dispatch.max_rounds":2}})}))).status).toBe(400);
  });
});
