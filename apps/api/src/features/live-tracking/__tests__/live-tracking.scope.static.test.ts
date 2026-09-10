import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const files = [
  "live-tracking.schemas.ts",
  "live-tracking.service.ts",
  "live-tracking.route-handlers.ts",
  "live-tracking-cleanup.worker.ts",
  "live-tracking-cleanup.route-handlers.ts"
];
const source = files
  .map((file) => readFileSync(resolve(process.cwd(), "src/features/live-tracking", file), "utf8"))
  .join("\n");

describe("live tracking privacy and scope", () => {
  it("does not copy raw points into logs, audit, outbox, or workflow mutations", () => {
    expect(source).not.toMatch(/console\.(?:log|info|warn|error)/);
    expect(source).not.toMatch(/audit\.append|outbox\.append|serverLogger/);
    expect(readFileSync(
      resolve(process.cwd(), "src/features/live-tracking/live-tracking.service.ts"),
      "utf8"
    )).not.toMatch(/updateStatus|appendStatusHistory|dispatch\./);
  });

  it("contains no history, public sharing, realtime, or frontend transport", () => {
    expect(source).not.toMatch(/WebSocket|EventSource|text\/event-stream|locationHistory|location_history/);
    expect(source).not.toMatch(/NEXT_PUBLIC_/);
    const migration = readFileSync(
      resolve(process.cwd(), "../../supabase/migrations/202606250032_live_location_tracking.sql"),
      "utf8"
    );
    expect(migration.match(/create table assignment_live_locations/g)).toHaveLength(1);
    expect(migration).not.toMatch(/create table .*history/i);
  });

  it("keeps route files thin and cleanup output count-only", () => {
    const apiRoute = readFileSync(
      resolve(process.cwd(), "app/api/v1/assignments/[assignmentId]/live-location/route.ts"),
      "utf8"
    );
    const cleanupRoute = readFileSync(
      resolve(process.cwd(), "app/api/v1/internal/workers/live-locations/cleanup/route.ts"),
      "utf8"
    );
    expect(apiRoute).not.toMatch(/latitude|longitude|ST_MakePoint/);
    expect(cleanupRoute).not.toMatch(/latitude|longitude|ST_MakePoint/);
    expect(source).toContain('return { status: "completed", deleted }');
  });
});
