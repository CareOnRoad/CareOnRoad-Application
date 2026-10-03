import { z } from "zod";

export type PageCursor = { timestamp: Date; id: string };
export type ListFilter = { limit: number; cursor?: PageCursor; status?: string; date_from?: string; date_to?: string };
export type Page = { next_cursor: string | null; has_more: boolean };

export function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify({ timestamp: cursor.timestamp.toISOString(), id: cursor.id })).toString("base64url");
}

export function decodeCursor(value: string): PageCursor {
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) throw new Error("INVALID_CURSOR");
  const parsed = z.object({ timestamp: z.string().datetime(), id: z.string().uuid() }).strict().parse(JSON.parse(decoded.toString("utf8")));
  return { timestamp: new Date(parsed.timestamp), id: parsed.id };
}

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(500).transform((value, context) => {
    try { return decodeCursor(value); }
    catch { context.addIssue({ code: "custom", message: "Invalid cursor." }); return z.NEVER; }
  }).optional(),
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional()
}).strict();

export function validDateRange(input: { date_from?: string; date_to?: string }) {
  return !input.date_from || !input.date_to || new Date(input.date_from) <= new Date(input.date_to);
}

export function listQuery(request: Request): Record<string, unknown> {
  const params = new URL(request.url).searchParams;
  return Object.fromEntries([...new Set(params.keys())].map((key) => [key, params.getAll(key).length === 1 ? params.get(key) : params.getAll(key)]));
}

export function toPage<T extends { id: string; createdAt: Date }, R>(rows: T[], limit: number, map: (row: T) => R): { items: R[]; page: Page } {
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = items.at(-1);
  return { items: items.map(map), page: { has_more: hasMore, next_cursor: hasMore && last ? encodeCursor({ timestamp: last.createdAt, id: last.id }) : null } };
}

export function filterPage<T extends { id: string; createdAt: Date; status?: string }>(rows: T[], input: ListFilter): T[] {
  return rows.filter((row) => !input.status || row.status === input.status)
    .filter((row) => !input.date_from || row.createdAt >= new Date(input.date_from))
    .filter((row) => !input.date_to || row.createdAt <= new Date(input.date_to))
    .filter((row) => !input.cursor || row.createdAt < input.cursor.timestamp || (row.createdAt.getTime() === input.cursor.timestamp.getTime() && row.id < input.cursor.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
    .slice(0, input.limit + 1);
}
