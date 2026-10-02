import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const contractPath = resolve(
  process.cwd(),
  "..",
  "..",
  "specs",
  "003-careonroad-admin-operations",
  "contracts",
  "admin-api.yaml"
);
const contract = readFileSync(contractPath, "utf8");

describe("admin API contract", () => {
  it("freezes unique operation IDs for the accepted feature boundary", () => {
    const operationIds = [...contract.matchAll(/^\s+operationId:\s+(\S+)$/gm)].map(
      (match) => match[1]
    );

    expect(operationIds).toHaveLength(88);
    expect(new Set(operationIds)).toHaveLength(88);
    expect(operationIds[0]).toBe("adminListUsers");
    expect(operationIds.at(-1)).toBe("adminGetProviderBudgetMetadata");
    expect(operationIds).not.toContain("adminUpdateFeatureFlags");
    expect(operationIds).not.toContain("adminUpdateProviderBudgets");
    expect(operationIds).not.toContain("adminEnableMaintenanceMode");
    expect(operationIds).not.toContain("adminDisableMaintenanceMode");
  });

  it("requires reason and X-Idempotency-Key for every mutation", () => {
    const mutations = collectMutationBlocks(contract);

    expect(mutations.length).toBeGreaterThan(0);
    for (const mutation of mutations) {
      expect(mutation.block, mutation.operationId).toContain(
        '$ref: "#/components/parameters/IdempotencyKey"'
      );
      expect(mutation.block, mutation.operationId).toContain("requestBody:");
      expect(mutation.block, mutation.operationId).toMatch(
        /requestBodies\/(?:AdminReason|RoleMutation|InternalNote|ConfigMutation)|schemas\/(?:MechanicSkillsMutation|MechanicRadiusMutation|MechanicCommand|StuckAssignmentCommand|QuoteDisputeCommand|EnableReminderCommand)/
      );
    }

    expect(contract).toContain("required: [reason]");
    expect(contract).toContain("required: [reason, role]");
    expect(contract).toContain("required: [reason, note]");
  });
});

function collectMutationBlocks(input: string) {
  const lines = input.split(/\r?\n/);
  const mutations: Array<{ operationId: string; block: string }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^ {4}(post|patch|put|delete):\s*$/.test(lines[index] ?? "")) {
      continue;
    }
    let end = index + 1;
    while (
      end < lines.length &&
      !/^ {2}\S/.test(lines[end] ?? "") &&
      !/^ {4}(get|post|patch|put|delete):\s*$/.test(lines[end] ?? "")
    ) {
      end += 1;
    }
    const block = lines.slice(index, end).join("\n");
    const operationId = block.match(/operationId:\s+(\S+)/)?.[1] ?? "unknown";
    mutations.push({ operationId, block });
  }

  return mutations;
}
