import { NextResponse } from "next/server";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AdminConfigurationService } from "./admin-configuration.service";
import { createDefaultAdminRouteDependencies,adminRouteError,readAdminJson,readAdminIdempotencyKey,AdminRouteError } from "./admin-route-helpers";
export function createAdminConfigurationRouteHandlers(dependencies:{authenticate(request:Request):Promise<VerifiedSupabaseIdentity>;service:AdminConfigurationService}){
  return {async read(request:Request,providers=false){try{const identity=await dependencies.authenticate(request);if(new URL(request.url).search)throw new AdminRouteError("INVALID_INPUT","Configuration query is invalid.",400);return NextResponse.json(await dependencies.service.read(identity,providers),{headers:{"cache-control":"private, no-store"}});}catch(error){return adminRouteError(error);}},
    async update(request:Request){try{return NextResponse.json(await dependencies.service.update(await dependencies.authenticate(request),await readAdminJson(request),readAdminIdempotencyKey(request)));}catch(error){return adminRouteError(error);}}};
}
export function createDefaultAdminConfigurationRouteHandlers(){const dependencies=createDefaultAdminRouteDependencies();return createAdminConfigurationRouteHandlers({authenticate:dependencies.authenticate,service:new AdminConfigurationService(dependencies.unitOfWork)});}
