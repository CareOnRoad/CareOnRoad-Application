import type { AdminConfigurationRepository, DispatchConfigurationRow, DispatchConfigurationVersion } from "../contracts/admin-configuration.repository";
export class InMemoryAdminConfigurationRepository implements AdminConfigurationRepository {
  constructor(private readonly rows:DispatchConfigurationRow[],private readonly versions:DispatchConfigurationVersion[]){}
  async read(){return structuredClone(this.rows);}
  async history(limit:number){return structuredClone([...this.versions].sort((a,b)=>b.updatedAt.getTime()-a.updatedAt.getTime()||b.id.localeCompare(a.id)).slice(0,limit));}
  async lock(){} // UnitOfWork serializes the complete transaction.
  async update(input:Parameters<AdminConfigurationRepository["update"]>[0]){
    const previous=this.rows.find(row=>row.key===input.key),row:DispatchConfigurationRow={key:input.key,value:structuredClone(input.value),version:(previous?.version??0)+1,updatedBy:input.actorId,updatedAt:input.now};
    this.versions.push({...row,id:input.id,previousValue:previous?.value,reason:input.reason});
    if(previous)this.rows.splice(this.rows.indexOf(previous),1,row);else this.rows.push(row);
    return structuredClone(row);
  }
}
