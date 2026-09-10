import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { MechanicAssignmentMetadataService } from "../mechanic-assignment-metadata.service";
import { MechanicDashboardService } from "../mechanic-dashboard.service";
import { MechanicJobListService } from "../mechanic-job-list.service";
import { MechanicPerformanceService } from "../mechanic-performance.service";
import {
  ASSIGNMENT_ID,
  MECHANIC_ID,
  NOW,
  createMechanicOperationsUnitOfWork,
  identity
} from "./mechanic-operations-test-fixtures";

const prohibitedSensitivePattern =
  /(?:api[_-]?key|service[_-]?role|database_url|password|secret|authorization|bearer|raw[_-]?media|raw[_-]?audio|base64|provider[_-]?payload|payment|checkout|settlement|refund|payout|card_number|cvv)/i;
const prohibitedSourceSamplePattern =
  /(?:GEMINI_API_KEY|OPENROUTER_API_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL\s*=|TEST_DATABASE_URL\s*=|sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{20,}|data:(?:image|audio|video|application)\/[^"'\s]+;base64,|provider_payload\s*:\s*\{)/i;

describe("mechanic operations privacy regression", () => {
  it("keeps read-model responses scoped and free of sensitive operational fields", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const dashboard = await new MechanicDashboardService(unitOfWork, {
      now: () => NOW
    }).getDashboard(identity(MECHANIC_ID));
    const jobs = await new MechanicJobListService(unitOfWork).listJobs(identity(MECHANIC_ID), {});
    const performance = await new MechanicPerformanceService(unitOfWork).getPerformance(
      identity(MECHANIC_ID),
      {}
    );

    const responseJson = JSON.stringify({ dashboard, jobs, performance });
    expect(responseJson).not.toMatch(prohibitedSensitivePattern);
    expect(responseJson).not.toContain("Private rider problem text");
    expect(responseJson).not.toContain("88888888-8888-4888-8888-888888888888");
    expect(responseJson).not.toContain("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  });

  it("keeps mutation audit and outbox metadata sanitized and metadata-first", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const service = new MechanicAssignmentMetadataService(unitOfWork, {
      now: () => NOW,
      createId: deterministicIds()
    });

    await service.updateEta(
      identity(MECHANIC_ID),
      ASSIGNMENT_ID,
      {
        eta_at: new Date(NOW.getTime() + 10 * 60_000).toISOString(),
        delay_reason: "Traffic delay near the rider location."
      },
      "privacy-eta-key"
    );
    await service.addMedia(
      identity(MECHANIC_ID),
      ASSIGNMENT_ID,
      {
        media_reference: "assignments/99999999/proof.jpg",
        purpose: "work_proof",
        content_type: "image/jpeg",
        size_bytes: 150_000
      },
      "privacy-media-key"
    );
    await service.submitCompletionChecklist(
      identity(MECHANIC_ID),
      ASSIGNMENT_ID,
      {
        work_summary:
          "Checked repair quality, verified restart behavior, and confirmed the vehicle is safe.",
        safety_checklist: {
          test_ride_completed: true,
          tools_removed: true,
          area_safe: true,
          rider_briefed: true,
          no_fluid_leak: true
        },
        notes: "Internal bounded note."
      },
      "privacy-checklist-key"
    );

    const snapshot = unitOfWork.snapshot();
    const auditAndOutboxJson = JSON.stringify({
      audit: snapshot.auditLogs,
      outbox: snapshot.outboxEvents
    });
    expect(auditAndOutboxJson).not.toMatch(prohibitedSensitivePattern);
    expect(auditAndOutboxJson).not.toContain("proof.jpg");
    expect(auditAndOutboxJson).not.toContain("Checked repair quality");
    expect(auditAndOutboxJson).not.toContain("test_ride_completed");
    expect(auditAndOutboxJson).toContain("assignment.eta_updated");
    expect(auditAndOutboxJson).toContain("assignment.media_added");
    expect(auditAndOutboxJson).toContain("assignment.completion_checklist_submitted");
  });

  it("keeps mechanic operation fixtures and source logs free of secrets and raw payload samples", () => {
    const source = [
      readFileSync(
        resolve(
          process.cwd(),
          "src",
          "features",
          "mechanic-operations",
          "__tests__",
          "mechanic-operations-test-fixtures.ts"
        ),
        "utf8"
      ),
      ...readdirSync(resolve(process.cwd(), "src", "features", "mechanic-operations"), {
        withFileTypes: true
      })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
        .map((entry) =>
          readFileSync(
            join(process.cwd(), "src", "features", "mechanic-operations", entry.name),
            "utf8"
          )
        )
    ].join("\n");

    expect(source).not.toMatch(prohibitedSourceSamplePattern);
    expect(source).not.toMatch(/\bconsole\.(?:log|info|warn|error)\b/);
  });
});

function deterministicIds() {
  let next = 1;
  return () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
}
