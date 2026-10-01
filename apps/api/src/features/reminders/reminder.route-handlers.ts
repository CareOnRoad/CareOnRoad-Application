import { NextResponse } from "next/server";

import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateWorkerSecret, type WorkerAuthority } from "@/server/auth/worker-secret";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { ReminderWorker, type ReminderWorkerResult } from "@/server/workers/reminder.worker";
import { recordWorkerRun } from "@/server/workers/worker-run-recorder";

import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import { ReminderService, type ReminderRuleResponse } from "./reminder.service";

export type ReminderRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  authenticateWorker(request: Request): WorkerAuthority;
  reminderService: {
    createReminderRule(
      identity: VerifiedSupabaseIdentity,
      input: unknown
    ): Promise<ReminderRuleResponse>;
    listReminderRules(identity: VerifiedSupabaseIdentity): Promise<{ items: ReminderRuleResponse[] }>;
    updateReminderRule(
      identity: VerifiedSupabaseIdentity,
      reminderId: string,
      input: unknown
    ): Promise<ReminderRuleResponse>;
    snoozeReminderRule(
      identity: VerifiedSupabaseIdentity,
      reminderId: string,
      input: unknown
    ): Promise<ReminderRuleResponse>;
    disableReminderRule(
      identity: VerifiedSupabaseIdentity,
      reminderId: string
    ): Promise<ReminderRuleResponse>;
  };
  createWorker(authority: WorkerAuthority): {
    processDueReminders(): Promise<ReminderWorkerResult>;
  };
};

export function createReminderRouteHandlers(dependencies: ReminderRouteDependencies) {
  return {
    async listReminderRules(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(await dependencies.reminderService.listReminderRules(identity));
      } catch (error) {
        return routeError(error);
      }
    },

    async createReminderRule(request: Request) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.reminderService.createReminderRule(identity, await readJson(request)),
          { status: 201 }
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async updateReminderRule(request: Request, reminderId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.reminderService.updateReminderRule(
            identity,
            reminderId,
            await readJson(request)
          )
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async snoozeReminderRule(request: Request, reminderId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.reminderService.snoozeReminderRule(
            identity,
            reminderId,
            await readJson(request)
          )
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async disableReminderRule(request: Request, reminderId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.reminderService.disableReminderRule(identity, reminderId)
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async runReminderWorker(request: Request) {
      try {
        const authority = dependencies.authenticateWorker(request);
        const result = await dependencies.createWorker(authority).processDueReminders();
        return NextResponse.json(result, { status: 202 });
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultReminderRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createReminderRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    authenticateWorker: authenticateWorkerSecret,
    reminderService: new ReminderService(unitOfWork),
    createWorker: (authority) => {
      const worker = new ReminderWorker(unitOfWork, { workerId: authority.workerId });
      return { processDueReminders: () => recordWorkerRun({
        unitOfWork, workerName: "reminders", run: () => worker.processDueReminders(),
        summarize: (result) => ({ claimed: result.claimed, succeeded: result.queued, failed: result.failed })
      }) };
    }
  });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw routeInputError("Request body must be valid JSON.");
  }
}

function routeInputError(message: string) {
  const error = new Error(message) as Error & {
    status: number;
    errorCode: "INVALID_INPUT";
  };
  error.status = 400;
  error.errorCode = "INVALID_INPUT";
  return error;
}

function routeError(error: unknown) {
  if (error instanceof DatabaseError) {
    return databaseJsonError(error);
  }
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    "errorCode" in error &&
    "message" in error &&
    typeof error.status === "number" &&
    typeof error.errorCode === "string" &&
    typeof error.message === "string"
  ) {
    return jsonError(error.status, error.errorCode as ApiErrorCode, error.message, {
      details:
        "details" in error && typeof error.details === "object" && error.details !== null
          ? (error.details as Record<string, unknown>)
          : undefined
    });
  }
  return jsonError(500, "INTERNAL_ERROR", "An internal API error occurred.");
}
