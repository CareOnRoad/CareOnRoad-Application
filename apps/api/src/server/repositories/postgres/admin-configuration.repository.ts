import type { TransactionSql } from "postgres";
import type { AdminConfigurationRepository, DispatchConfigurationRow,DispatchConfigurationVersion } from "../contracts/admin-configuration.repository";
type Row={config_key:DispatchConfigurationRow["key"];value_json:number|number[];version:number;updated_by:string;updated_at:Date};
const map=(row:Row):DispatchConfigurationRow=>({key:row.config_key,value:row.value_json,version:row.version,updatedBy:row.updated_by,updatedAt:row.updated_at});
export class PostgresAdminConfigurationRepository implements AdminConfigurationRepository {
  constructor(private readonly sql:TransactionSql) {}
  async read(){ return (await this.sql<Row[]>`select * from admin_operation_configs order by config_key`).map(map); }
  async history(limit:number):Promise<DispatchConfigurationVersion[]>{
    type Version={id:string;config_key:DispatchConfigurationRow["key"];version:number;previous_value_json:number|number[]|null;new_value_json:number|number[];updated_by:string;reason:string;created_at:Date};
    const rows=await this.sql<Version[]>`select * from admin_operation_config_versions order by created_at desc,id desc limit ${limit}`;
    return rows.map(row=>({id:row.id,key:row.config_key,value:row.new_value_json,previousValue:row.previous_value_json??undefined,version:row.version,updatedBy:row.updated_by,reason:row.reason,updatedAt:row.created_at}));
  }
  async lock(){
    // ponytail: one transaction lock for four rarely changed keys; split only if admin writes contend.
    await this.sql`select pg_advisory_xact_lock(hashtext(current_schema() || ':dispatch_configuration'))`;
  }
  async update(input:Parameters<AdminConfigurationRepository["update"]>[0]){
    const [row]=await this.sql<Row[]>`insert into admin_operation_configs(config_key,value_json,version,updated_by,updated_at,reason)
      values(${input.key},${this.sql.json(input.value)},1,${input.actorId},${input.now},${input.reason})
      on conflict(config_key) do update set value_json=excluded.value_json,version=admin_operation_configs.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at,reason=excluded.reason returning *`;
    return map(row!);
  }
}
