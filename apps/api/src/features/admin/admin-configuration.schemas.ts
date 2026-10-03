import { z } from "zod";
import { adminReasonSchema } from "./admin.schemas";
export const dispatchPolicySchema = z.object({
  "dispatch.radius_steps_km": z.array(z.number().min(1).max(100)).min(1).max(8).refine(values=>values.every((value,index)=>index===0||value>values[index-1]!),"Radius steps must be strictly ascending."),
  "dispatch.offer_expiry_seconds": z.number().int().min(30).max(300),
  "dispatch.max_rounds": z.number().int().min(1).max(8),
  "dispatch.total_wait_seconds": z.number().int().min(60).max(1800)
}).strict();
export type DispatchPolicy = z.infer<typeof dispatchPolicySchema>;
export const DEFAULT_DISPATCH_POLICY: DispatchPolicy = { "dispatch.radius_steps_km":[2,5,8,12],"dispatch.offer_expiry_seconds":60,"dispatch.max_rounds":4,"dispatch.total_wait_seconds":360 };
export const validDispatchPolicy = dispatchPolicySchema.refine(values=>values["dispatch.total_wait_seconds"]>=values["dispatch.offer_expiry_seconds"],"Total wait must cover one offer window.");
export const dispatchConfigurationUpdate = adminReasonSchema.extend({values:dispatchPolicySchema.partial().refine(values=>Object.keys(values).length>0,"At least one value is required.")}).strict();
export function dispatchConfigurationEnabled(environment: Record<string,string|undefined> = process.env) { return /^(true|1|yes)$/i.test(environment.ADMIN_DISPATCH_CONFIGURATION_ENABLED?.trim()??""); }
