import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const contract = readFileSync(
  resolve(
    root,
    "..",
    "..",
    "specs",
    "003-careonroad-admin-operations",
    "contracts",
    "admin-api.yaml"
  ),
  "utf8"
);

const patchBRoutes = [
  {
    path: "/admin/users:",
    operationId: "adminListUsers",
    file: "app/api/v1/admin/users/route.ts",
    method: "GET",
    statuses: ["200", "401", "403"]
  },
  {
    path: "/admin/users/{userId}:",
    operationId: "adminGetUserDetail",
    file: "app/api/v1/admin/users/[userId]/route.ts",
    method: "GET",
    statuses: ["200", "404"]
  },
  {
    path: "/admin/users/{userId}/suspend:",
    operationId: "adminSuspendUser",
    file: "app/api/v1/admin/users/[userId]/suspend/route.ts",
    method: "POST",
    statuses: ["200", "409"]
  },
  {
    path: "/admin/users/{userId}/reactivate:",
    operationId: "adminReactivateUser",
    file: "app/api/v1/admin/users/[userId]/reactivate/route.ts",
    method: "POST",
    statuses: ["200", "409"]
  },
  {
    path: "/admin/users/{userId}/archive:",
    operationId: "adminArchiveUser",
    file: "app/api/v1/admin/users/[userId]/archive/route.ts",
    method: "POST",
    statuses: ["200", "409"]
  },
  {
    path: "/admin/users/{userId}/devices:",
    operationId: "adminListUserDevices",
    file: "app/api/v1/admin/users/[userId]/devices/route.ts",
    method: "GET",
    statuses: ["200"]
  },
  {
    path: "/admin/users/{userId}/roles/grant:",
    operationId: "adminGrantUserRole",
    file: "app/api/v1/admin/users/[userId]/roles/grant/route.ts",
    method: "POST",
    statuses: ["200", "409"]
  },
  {
    path: "/admin/users/{userId}/roles/revoke:",
    operationId: "adminRevokeUserRole",
    file: "app/api/v1/admin/users/[userId]/roles/revoke/route.ts",
    method: "POST",
    statuses: ["200", "409"]
  },
  {
    path: "/admin/users/{userId}/activity:",
    operationId: "adminGetUserActivity",
    file: "app/api/v1/admin/users/[userId]/activity/route.ts",
    method: "GET",
    statuses: ["200"]
  },
  {
    path: "/admin/devices/{deviceId}/revoke:",
    operationId: "adminRevokeDevice",
    file: "app/api/v1/admin/devices/[deviceId]/revoke/route.ts",
    method: "POST",
    statuses: ["200", "409"]
  }
] as const;

describe("Patch B route contract", () => {
  it("maps every Admin User Management operation to a route module", () => {
    for (const route of patchBRoutes) {
      expect(contract).toContain(route.path);
      const operationBlock = contract
        .slice(contract.indexOf(route.path))
        .split(/\n {2}\//, 1)[0]!;
      expect(operationBlock).toContain(`operationId: ${route.operationId}`);
      for (const status of route.statuses) {
        expect(operationBlock, `${route.operationId} ${status}`).toContain(
          `"${status}":`
        );
      }
      expect(existsSync(resolve(root, route.file)), route.file).toBe(true);
      expect(readFileSync(resolve(root, route.file), "utf8"), route.file).toMatch(
        new RegExp(`export (?:async )?function ${route.method}\\b`)
      );
    }
  });

  it("keeps every Patch B command idempotent and reason-required", () => {
    for (const route of patchBRoutes.filter((entry) => entry.method === "POST")) {
      const operationBlock = contract
        .slice(contract.indexOf(route.path))
        .split(/\n {2}\//, 1)[0]!;
      expect(operationBlock, route.operationId).toContain(
        '$ref: "#/components/parameters/IdempotencyKey"'
      );
      expect(operationBlock, route.operationId).toContain("requestBody:");
    }
  });
});
