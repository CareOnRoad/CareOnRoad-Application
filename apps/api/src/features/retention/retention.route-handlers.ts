import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateWorkerSecret, type WorkerAuthority } from "@/server/auth/worker-secret";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresRetentionRepository } from "@/server/repositories/postgres/retention.repository";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { RetentionWorker, type RetentionWorkerResult } from "@/server/workers/retention.worker";
import { recordWorkerRun } from "@/server/workers/worker-run-recorder";
import { readRetentionPolicy } from "./retention-policy";

const inputSchema = z.object({ dry_run: z.boolean().default(true), limit: z.number().int().min(1).max(100).default(25) }).strict();
export type RetentionRouteDependencies = { authenticateWorker(request: Request): WorkerAuthority; createWorker(authority: WorkerAuthority): { run(input: { dryRun: boolean; limit: number }): Promise<RetentionWorkerResult> } };
export function createRetentionRouteHandlers(dependencies: RetentionRouteDependencies) { return { async run(request: Request) { try { const authority = dependencies.authenticateWorker(request); const parsed = inputSchema.safeParse(await readJson(request)); if (!parsed.success) throw Object.assign(new Error("Retention worker input is invalid."), { status: 400, errorCode: "INVALID_INPUT" }); const result = await dependencies.createWorker(authority).run({ dryRun: parsed.data.dry_run, limit: parsed.data.limit }); return NextResponse.json(result, { status: result.status === "busy" ? 202 : 200 }); } catch (error) { return routeError(error); } } }; }
export function createDefaultRetentionRouteHandlers() {
  const sql = getPostgresClient(); const unitOfWork = new PostgresUnitOfWork(sql);
  return createRetentionRouteHandlers({ authenticateWorker: authenticateWorkerSecret, createWorker: (authority) => { const worker = new RetentionWorker(new PostgresRetentionRepository(sql), readRetentionPolicy(), { workerId: authority.workerId }); return { run: (input) => recordWorkerRun({ unitOfWork, workerName: "data_retention", run: () => worker.run(input), summarize: (result) => ({ claimed: result.status === "busy" ? 0 : 1, succeeded: result.classes.reduce((sum, item) => sum + item.deleted, 0), failed: 0 }) }) }; } });
}
async function readJson(request: Request) { const text = await request.text(); if (!text.trim()) return {}; try { return JSON.parse(text) as unknown; } catch { throw Object.assign(new Error("Request body must be valid JSON."), { status: 400, errorCode: "INVALID_INPUT" }); } }
function routeError(error: unknown) { if (error instanceof DatabaseError) return databaseJsonError(error); if (error && typeof error === "object" && "status" in error && "errorCode" in error && "message" in error && typeof error.status === "number" && typeof error.errorCode === "string" && typeof error.message === "string") return jsonError(error.status, error.errorCode as ApiErrorCode, error.message); return jsonError(500, "INTERNAL_ERROR", "An internal retention worker error occurred."); }
