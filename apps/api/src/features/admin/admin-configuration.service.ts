import { randomUUID } from "node:crypto";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { FoundationRepositories,UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { sanitizeAdminReason } from "./admin-redaction";
import { loadActiveAdminActor } from "./admin.authorization";
import { AdminRouteError } from "./admin-route-helpers";
import { prepareAdminCommand,recordAdminAction } from "./admin-command";
import { DEFAULT_DISPATCH_POLICY,dispatchConfigurationEnabled,dispatchConfigurationUpdate,validDispatchPolicy,type DispatchPolicy } from "./admin-configuration.schemas";
export async function effectiveDispatchPolicy(repositories:FoundationRepositories,enabled=dispatchConfigurationEnabled()):Promise<DispatchPolicy>{
  if(!enabled)return structuredClone(DEFAULT_DISPATCH_POLICY);
  const rows=await repositories.adminConfiguration.read();
  return validDispatchPolicy.parse({...DEFAULT_DISPATCH_POLICY,...Object.fromEntries(rows.map(row=>[row.key,row.value]))});
}
export class AdminConfigurationService {
  constructor(private readonly unitOfWork:UnitOfWork,private readonly options:{now?:()=>Date;enabled?:boolean;environment?:Record<string,string|undefined>}={}){}
  async read(identity:VerifiedSupabaseIdentity,providers=false){
    return this.unitOfWork.execute(async repositories=>{
      await loadActiveAdminActor(identity,repositories.users);
      const environment=this.options.environment??process.env,enabled=this.options.enabled??dispatchConfigurationEnabled(environment);
      if(providers)return {source:"runtime_configuration",read_only:true,providers:[
        {provider:"payos",configured:Boolean(environment.PAYOS_CLIENT_ID&&environment.PAYOS_API_KEY&&environment.PAYOS_CHECKSUM_KEY)},
        {provider:"fcm",configured:Boolean(environment.FCM_PROJECT_ID&&environment.FCM_CLIENT_EMAIL&&environment.FCM_PRIVATE_KEY)},
        {provider:"google_routes",configured:Boolean(environment.GOOGLE_ROUTES_API_KEY)}
      ].map(provider=>({...provider,usage:null,limit:null,remaining:null,budget_source:"unavailable"}))};
      const rows=enabled?await repositories.adminConfiguration.read():[];
      const history=enabled?await repositories.adminConfiguration.history(20):[];
      return {enabled,values:validDispatchPolicy.parse({...DEFAULT_DISPATCH_POLICY,...Object.fromEntries(rows.map(row=>[row.key,row.value]))}),versions:Object.fromEntries(rows.map(row=>[row.key,row.version])),history:history.map(row=>({key:row.key,version:row.version,previous_value:row.previousValue,value:row.value,updated_by:row.updatedBy,updated_at:row.updatedAt.toISOString()})),history_limit:20,applies_to:"new_dispatch_episodes"};
    });
  }
  async update(identity:VerifiedSupabaseIdentity,input:unknown,key:string){
    const parsed=dispatchConfigurationUpdate.safeParse(input);if(!parsed.success)throw new AdminRouteError("INVALID_INPUT","Dispatch configuration is invalid.",400);
    const body=parsed.data,now=this.options.now?.()??new Date();
    return this.unitOfWork.execute(async repositories=>{
      let actor=await loadActiveAdminActor(identity,repositories.users);
      if(!(this.options.enabled??dispatchConfigurationEnabled(this.options.environment??process.env)))throw new AdminRouteError("CONFLICT","Admin dispatch configuration is disabled.",409);
      await repositories.adminConfiguration.lock();actor=await loadActiveAdminActor(identity,repositories.users);
      const scope="admin.configuration.dispatch",replay=await prepareAdminCommand(repositories,actor.id,scope,key,body,now,randomUUID);if(replay)return replay;
      const values=validDispatchPolicy.safeParse({...await effectiveDispatchPolicy(repositories,true),...body.values});
      if(!values.success)throw new AdminRouteError("INVALID_INPUT","Total wait must cover one offer window.",400);
      const rows=[];
      for(const configKey of Object.keys(body.values).sort() as (keyof DispatchPolicy)[]) rows.push(await repositories.adminConfiguration.update({key:configKey,value:values.data[configKey],actorId:actor.id,reason:sanitizeAdminReason(body.reason),now,id:randomUUID()}));
      const response={values:values.data,versions:Object.fromEntries((await repositories.adminConfiguration.read()).map(row=>[row.key,row.version])),applies_to:"new_dispatch_episodes"};
      await recordAdminAction(repositories,{actorId:actor.id,action:scope,entityType:"dispatch_configuration",entityId:actor.id,reason:body.reason,now,createId:randomUUID,metadata:{changed_keys:rows.map(row=>row.key)}});
      await repositories.idempotency.complete({actorId:actor.id,scope,idempotencyKey:key,responseStatus:200,responseBody:response,resourceType:"dispatch_configuration",resourceId:actor.id,completedAt:now});return response;
    });
  }
}
