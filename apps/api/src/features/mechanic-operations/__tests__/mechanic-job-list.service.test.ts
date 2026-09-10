import { describe, expect, it } from "vitest";

import { MechanicJobListService } from "../mechanic-job-list.service";
import {
  COMPLETED_ASSIGNMENT_ID,
  createMechanicOperationsUnitOfWork,
  identity,
  MECHANIC_ID,
  OTHER_ASSIGNMENT_ID
} from "./mechanic-operations-test-fixtures";

describe("MechanicJobListService", () => {
  it("filters active/status/date jobs and never returns another mechanic's job", async () => {
    const service = new MechanicJobListService(createMechanicOperationsUnitOfWork());

    const active = await service.listJobs(identity(MECHANIC_ID), { active_only: "true" });
    expect(active.items.map((item) => item.assignment_id)).toEqual([
      "99999999-9999-4999-8999-999999999999"
    ]);

    const completed = await service.listJobs(identity(MECHANIC_ID), {
      status: "completed",
      date_from: "2026-07-01T00:00:00.000Z",
      date_to: "2026-07-06T23:59:59.000Z"
    });
    expect(completed.items.map((item) => item.assignment_id)).toEqual([
      COMPLETED_ASSIGNMENT_ID
    ]);
    expect(JSON.stringify(completed)).not.toContain(OTHER_ASSIGNMENT_ID);
    expect(JSON.stringify(completed)).not.toContain("Private rider problem text");
  });

  it("uses stable cursor pagination and rejects malformed filters", async () => {
    const service = new MechanicJobListService(createMechanicOperationsUnitOfWork());
    const first = await service.listJobs(identity(MECHANIC_ID), { limit: "1" });
    expect(first.items).toHaveLength(1);
    expect(first.page.has_more).toBe(true);
    const second = await service.listJobs(identity(MECHANIC_ID), {
      limit: "10",
      cursor: first.page.next_cursor
    });
    expect(second.items.map((item) => item.assignment_id)).not.toContain(
      first.items[0]!.assignment_id
    );

    await expect(
      service.listJobs(identity(MECHANIC_ID), { status: "unknown" })
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
  });
});
