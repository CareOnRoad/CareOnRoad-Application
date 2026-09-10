import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/202606250026_service_reviews.sql"),
  "utf8"
).toLowerCase();

describe("service review migration", () => {
  it("enforces immutable assignment/request/rider/mechanic identity and rebuilds aggregates", () => {
    expect(sql).toContain("create table service_reviews");
    expect(sql).toContain("assignment_id uuid not null unique");
    expect(sql).toContain("rating between 1 and 5");
    expect(sql).toContain("char_length(comment) between 1 and 1000");
    expect(sql).toContain("foreign key (assignment_id, request_id, mechanic_id)");
    expect(sql).toContain("foreign key (request_id, rider_id)");
    expect(sql).toContain("service_reviews_reject_update_delete");
    expect(sql).toContain("round(avg(review.rating)::numeric, 2)");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on service_reviews from authenticated");
  });
});
