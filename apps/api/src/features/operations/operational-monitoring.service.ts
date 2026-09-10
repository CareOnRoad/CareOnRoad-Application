import { z } from "zod";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { loadActiveAdminActor } from "@/features/admin/admin.authorization";
import type { OperationalCursor } from "@/server/repositories/contracts/operational-monitoring.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

export type OperationalQueue = "outbox-dead-letters" | "payments-needs-review" | "dispatch-stuck" | "worker-runs";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional()
});
const cursorSchema = z.object({ t: z.string().datetime(), id: z.string().uuid() });

export class OperationalMonitoringService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: { now?: () => Date; stuckMinutes?: () => number } = {}
  ) {}

  async list(identity: VerifiedSupabaseIdentity, queue: OperationalQueue, url: string) {
    const params = new URL(url).searchParams;
    const parsed = querySchema.safeParse({ limit: params.get("limit") ?? undefined, cursor: params.get("cursor") ?? undefined });
    if (!parsed.success) throw inputError("Pagination query is invalid.");
    const cursor = parsed.data.cursor ? decodeCursor(parsed.data.cursor) : undefined;
    const fetchLimit = parsed.data.limit + 1;
    const now = this.options.now?.() ?? new Date();
    const rows = await this.unitOfWork.execute(async (repositories) => {
      await loadActiveAdminActor(identity, repositories.users);
      const input = { limit: fetchLimit, ...(cursor ? { cursor } : {}) };
      switch (queue) {
        case "outbox-dead-letters": return repositories.operationalMonitoring.listDeadLetters(input);
        case "payments-needs-review": return repositories.operationalMonitoring.listNeedsReviewPayments(input);
        case "dispatch-stuck": {
          const minutes = clamp(this.options.stuckMinutes?.() ?? readStuckMinutes(), 1, 1440);
          return repositories.operationalMonitoring.listStuckDispatch({ ...input, now, staleBefore: new Date(now.getTime() - minutes * 60_000) });
        }
        case "worker-runs": return repositories.operationalMonitoring.listWorkerRuns(input);
      }
    });
    const hasMore = rows.length > parsed.data.limit;
    const items = rows.slice(0, parsed.data.limit).map(toResponseItem);
    const last = rows[parsed.data.limit - 1];
    return {
      items,
      page: {
        limit: parsed.data.limit,
        has_more: hasMore,
        ...(hasMore && last ? { next_cursor: encodeCursor({ createdAt: itemTime(last), id: last.id }) } : {})
      }
    };
  }
}

function toResponseItem(item: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(item).map(([key, value]) => [toSnake(key), value instanceof Date ? value.toISOString() : value]));
}
function toSnake(value: string) { return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`); }
function itemTime(item: Record<string, unknown>): Date {
  const value = item.completedAt ?? item.updatedAt ?? item.createdAt;
  if (!(value instanceof Date)) throw new Error("Operational item timestamp is missing.");
  return value;
}
function encodeCursor(cursor: OperationalCursor) {
  return Buffer.from(JSON.stringify({ t: cursor.createdAt.toISOString(), id: cursor.id }), "utf8").toString("base64url");
}
function decodeCursor(value: string): OperationalCursor {
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return { createdAt: new Date(parsed.t), id: parsed.id };
  } catch { throw inputError("Pagination cursor is invalid."); }
}
function readStuckMinutes() { return Number(process.env.OPERATIONS_STUCK_DISPATCH_MINUTES ?? "15"); }
function clamp(value: number, min: number, max: number) { return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), min), max) : 15; }
function inputError(message: string) {
  return Object.assign(new Error(message), { status: 400, errorCode: "INVALID_INPUT" as const });
}
