import type { DispatchPolicy } from "@/features/admin/admin-configuration.schemas";
export type DispatchConfigurationRow = { key:keyof DispatchPolicy; value:number|number[];version:number;updatedBy:string;updatedAt:Date };
export type DispatchConfigurationVersion = DispatchConfigurationRow & {id:string;previousValue?:number|number[];reason:string};
export interface AdminConfigurationRepository {
  read():Promise<DispatchConfigurationRow[]>;
  history(limit:number):Promise<DispatchConfigurationVersion[]>;
  lock():Promise<void>;
  update(input:{key:keyof DispatchPolicy;value:number|number[];actorId:string;reason:string;now:Date;id:string}):Promise<DispatchConfigurationRow>;
}
