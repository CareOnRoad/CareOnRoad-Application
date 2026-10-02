import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { ReminderWorker } from "@/server/workers/reminder.worker";
import { AdminReminderService } from "../admin-reminder.service";
import { AdminDashboardService } from "../admin-dashboard.service";
import { createAdminReminderRouteHandlers } from "../admin-reminder.route-handlers";
import { createAdminDashboardRouteHandlers } from "../admin-dashboard.route-handlers";
const now = new Date("2026-10-02T03:00:00Z"), earlier = new Date(now.getTime()-3_600_000);
const admin = randomUUID(), rider = randomUUID(), bike = randomUUID(), rule = randomUUID(), occurrence = randomUUID();
const identity = (subject: string) => ({ subject, issuer: "test", audience: ["authenticated"] });
const reason = { reason: "Investigated the failed reminder before recovery" };
function fixture() { return new InMemoryUnitOfWork({
  users: [admin,rider].map(id=>({ id,status:"active",createdAt:earlier,updatedAt:now })),
  userRoles:[{userId:admin,role:"admin"},{userId:rider,role:"rider"}],
  motorcycles:[{id:bike,riderId:rider,brandText:"Honda",modelText:"Wave",createdAt:earlier,updatedAt:now}],
  reminderRules:[{id:rule,riderId:rider,motorcycleId:bike,title:"private reminder narrative",intervalDays:30,nextDueAt:earlier,enabled:true,failureCount:3,createdAt:earlier,updatedAt:earlier}],
  reminderOccurrences:[{id:occurrence,ruleId:rule,riderId:rider,motorcycleId:bike,dueAt:earlier,status:"failed",retryCount:0,createdAt:earlier}]
}); }
describe("admin reminders and derived dashboard",()=>{
  it("retries the same occurrence once, replays its result and never creates a request",async()=>{
    const uow=fixture(), service=new AdminReminderService(uow,{now:()=>now});
    const result=await service.command(identity(admin),occurrence,"retry",reason,"reminder-retry-key");
    expect(await service.command(identity(admin),occurrence,"retry",reason,"reminder-retry-key")).toEqual(result);
    await expect(service.command(identity(admin),occurrence,"retry",reason,"another-retry-key")).rejects.toMatchObject({status:409});
    expect(uow.snapshot().notifications).toHaveLength(1); expect(uow.snapshot().serviceRequests).toHaveLength(0);
    await new ReminderWorker(uow,{now:()=>now}).processDueReminders();
    expect(uow.snapshot().notifications).toHaveLength(1);
    expect(uow.snapshot().reminderOccurrences[0]).toMatchObject({status:"queued",retryCount:1});
    expect(uow.snapshot().reminderRules[0]).toMatchObject({failureCount:3,nextDueAt:new Date(earlier.getTime()+30*86400_000)});
    expect(await new AdminDashboardService(uow,{now:()=>now}).read(identity(admin),"stuck-workflows")).toMatchObject({items:[]});
  });
  it.each(["sent","dismissed","lease","archived","revoked","limit"])("rolls back blocked %s recovery",async(blocker)=>{
    const state=fixture().snapshot();
    if(blocker==="sent"||blocker==="dismissed") state.reminderOccurrences[0]!.status=blocker;
    if(blocker==="lease") state.reminderRules[0]!.leaseExpiresAt=new Date(now.getTime()+60_000);
    if(blocker==="archived") state.motorcycles[0]!.archivedAt=now;
    if(blocker==="revoked") state.userRoles=state.userRoles.filter(row=>row.userId!==rider);
    if(blocker==="limit") state.reminderOccurrences[0]!.retryCount=3;
    const uow=new InMemoryUnitOfWork(state),before=uow.snapshot();
    await expect(new AdminReminderService(uow,{now:()=>now}).command(identity(admin),occurrence,"retry",reason,"blocked-retry-key")).rejects.toMatchObject({status:409});
    expect(uow.snapshot()).toEqual(before);
  });
  it("requires a future due time to enable and never re-enables an archived motorcycle",async()=>{
    const uow=fixture(),service=new AdminReminderService(uow,{now:()=>now});
    await service.command(identity(admin),rule,"disable",reason,"disable-reminder-key");
    expect(await new AdminDashboardService(uow,{now:()=>now}).read(identity(admin),"stuck-workflows")).toMatchObject({items:[]});
    expect(uow.snapshot().reminderRules[0]!.failureCount).toBe(3);
    await expect(service.command(identity(admin),rule,"enable",{...reason,next_due_at:earlier.toISOString()},"enable-reminder-key")).rejects.toMatchObject({status:400});
    await service.command(identity(admin),rule,"enable",{...reason,next_due_at:new Date(now.getTime()+86400_000).toISOString()},"enable-reminder-key");
    expect(uow.snapshot().reminderRules[0]!.enabled).toBe(true);
    const state=uow.snapshot(); state.motorcycles[0]!.archivedAt=now; state.reminderRules[0]!.enabled=false;
    await expect(new AdminReminderService(new InMemoryUnitOfWork(state),{now:()=>now}).command(identity(admin),rule,"enable",{...reason,next_due_at:new Date(now.getTime()+86400_000).toISOString()},"enable-archived-key")).rejects.toMatchObject({status:409});
  });
  it.each(["context", "outbox_lease"])("rejects %s on an existing occurrence delivery without partial recovery",async(blocker)=>{
    const initial=fixture();await new AdminReminderService(initial,{now:()=>now}).command(identity(admin),occurrence,"retry",reason,"queue-existing-occurrence");
    const state=initial.snapshot();state.reminderOccurrences[0]!.status="failed";state.notifications[0]!.status="failed";
    const event=state.outboxEvents.find(row=>row.topic==="notification.created")!;event.status="processed";
    if(blocker==="context")state.notifications[0]!.data={reminder_id:randomUUID(),reminder_context_id:occurrence};
    else event.leaseExpiresAt=new Date(now.getTime()+60_000);
    const uow=new InMemoryUnitOfWork(state),before=uow.snapshot();
    await expect(new AdminReminderService(uow,{now:()=>now}).command(identity(admin),occurrence,"retry",reason,"retry-existing-occurrence")).rejects.toMatchObject({status:409});
    expect(uow.snapshot()).toEqual(before);
  });
  it.each(["sent","dismissed","queued"])("worker preserves existing %s occurrence",async(status)=>{
    const state=fixture().snapshot(); state.reminderOccurrences[0]!.status=status as "sent"|"dismissed"|"queued";
    const uow=new InMemoryUnitOfWork(state); await new ReminderWorker(uow,{now:()=>now}).processDueReminders();
    expect(uow.snapshot().reminderOccurrences[0]!.status).toBe(status); expect(uow.snapshot().notifications).toHaveLength(0);
  });
  it("returns bounded redacted metadata and exact read-only aggregates",async()=>{
    const uow=fixture(),before=uow.snapshot(),service=new AdminDashboardService(uow,{now:()=>now});
    expect(await service.read(identity(admin),"summary")).toMatchObject({groups:{users:{active:2},reminders:{true:1},occurrences:{failed:1}}});
    expect(await service.read(identity(admin),"stuck-workflows")).toMatchObject({items:[expect.objectContaining({category:"reminder_failures",failure_count:3,next_action_codes:["view_reminder","disable_reminder"]})]});
    expect(JSON.stringify(await new AdminReminderService(uow,{now:()=>now}).read(identity(admin),"list"))).not.toContain("private");
    expect(uow.snapshot()).toEqual(before);
    await expect(service.read(identity(admin),"summary",{from:"2026-01-01T00:00:00Z"})).rejects.toMatchObject({status:400});
    await expect(service.read(identity(rider),"summary")).rejects.toMatchObject({status:403});
  });
  it("enforces role, strict filters and reason/key at physical route handlers",async()=>{
    const uow=fixture(); const reminders=createAdminReminderRouteHandlers({authenticate:async()=>identity(admin),service:new AdminReminderService(uow,{now:()=>now})});
    expect((await reminders.read(new Request("http://localhost/?enabled=true&enabled=false"),"list")).status).toBe(400);
    expect((await reminders.command(new Request("http://localhost/",{method:"POST",body:JSON.stringify(reason)}),rule,"disable")).status).toBe(400);
    const dashboard=createAdminDashboardRouteHandlers({authenticate:async()=>identity(rider),service:new AdminDashboardService(uow,{now:()=>now})});
    expect((await dashboard.read(new Request("http://localhost/"),"summary")).status).toBe(403);
  });
});
