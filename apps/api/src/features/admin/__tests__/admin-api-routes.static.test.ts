import { existsSync,readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";
describe("complete admin OpenAPI operation coverage",()=>{
  it("maps every contracted operation to a physical Next route and HTTP export",()=>{
    const contract=readFileSync(resolve(process.cwd(),"../../specs/003-careonroad-admin-operations/contracts/admin-api.yaml"),"utf8");
    const paths=[...contract.matchAll(/^ {2}(\/admin\/[^:\n]+):\r?\n([\s\S]*?)(?=^ {2}\/|^components:|$(?![\s\S]))/gm)];
    let operations=0;
    for(const [,path,body] of paths){const file=resolve(process.cwd(),"app/api/v1",path!.slice(1).replace(/\{([^}]+)\}/g,"[$1]"),"route.ts");expect(existsSync(file),path).toBe(true);
      const source=readFileSync(file,"utf8");for(const match of body!.matchAll(/^ {4}(get|post|patch|put|delete):/gm)){operations++;expect(source,path).toMatch(new RegExp(`export (?:async )?(?:function|const) ${match[1]!.toUpperCase()}\\b`));}
    }
    expect(operations).toBe(88);
  });
  it("keeps reminder administration date/time-based without odometer fields",()=>{
    for(const file of ["src/features/admin/admin-reminder.service.ts","src/features/admin/admin-reminder.route-handlers.ts","src/server/repositories/contracts/reminder.repository.ts"])
      expect(readFileSync(resolve(process.cwd(),file),"utf8"),file).not.toMatch(/\b(?:odometer|kilometer|mileage)\b/i);
  });
});
