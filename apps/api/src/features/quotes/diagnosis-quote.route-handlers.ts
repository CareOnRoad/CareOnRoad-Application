import { NextResponse } from "next/server";

import { databaseJsonError, jsonError, type ApiErrorCode } from "@/lib/api-error";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import { DatabaseError } from "@/server/db/database-errors";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

import type { VerifiedSupabaseIdentity } from "../auth/auth.types";
import {
  MechanicDiagnosisService,
  type MechanicDiagnosisResponse
} from "../mechanic-diagnosis/mechanic-diagnosis.service";
import { QuoteService, type QuoteResponse } from "./quote.service";

export type DiagnosisQuoteRouteDependencies = {
  authenticate(request: Request): Promise<VerifiedSupabaseIdentity>;
  diagnosisService: {
    upsertDiagnosis(
      identity: VerifiedSupabaseIdentity,
      assignmentId: string,
      input: unknown
    ): Promise<MechanicDiagnosisResponse>;
  };
  quoteService: {
    createQuote(
      identity: VerifiedSupabaseIdentity,
      requestId: string,
      input: unknown
    ): Promise<QuoteResponse>;
    listQuotes(
      identity: VerifiedSupabaseIdentity,
      requestId: string
    ): Promise<{ items: QuoteResponse[] }>;
    approveQuote(
      identity: VerifiedSupabaseIdentity,
      quoteId: string,
      input?: unknown
    ): Promise<QuoteResponse>;
    rejectQuote(
      identity: VerifiedSupabaseIdentity,
      quoteId: string
    ): Promise<QuoteResponse>;
  };
};

export function createDiagnosisQuoteRouteHandlers(
  dependencies: DiagnosisQuoteRouteDependencies
) {
  return {
    async upsertDiagnosis(request: Request, assignmentId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.diagnosisService.upsertDiagnosis(
            identity,
            assignmentId,
            await readJson(request)
          ),
          { status: 201 }
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async createQuote(request: Request, requestId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.quoteService.createQuote(
            identity,
            requestId,
            await readJson(request)
          ),
          { status: 201 }
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async listQuotes(request: Request, requestId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.quoteService.listQuotes(identity, requestId)
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async approveQuote(request: Request, quoteId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.quoteService.approveQuote(identity, quoteId, await readJson(request))
        );
      } catch (error) {
        return routeError(error);
      }
    },

    async rejectQuote(request: Request, quoteId: string) {
      try {
        const identity = await dependencies.authenticate(request);
        return NextResponse.json(
          await dependencies.quoteService.rejectQuote(identity, quoteId)
        );
      } catch (error) {
        return routeError(error);
      }
    }
  };
}

export function createDefaultDiagnosisQuoteRouteHandlers() {
  const unitOfWork = new PostgresUnitOfWork(getPostgresClient());
  return createDiagnosisQuoteRouteHandlers({
    authenticate: authenticateSupabaseRequest,
    diagnosisService: new MechanicDiagnosisService(unitOfWork),
    quoteService: new QuoteService(unitOfWork)
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
    const error = new Error("Request body must be valid JSON.") as Error & {
      status: number;
      errorCode: "INVALID_INPUT";
    };
    error.status = 400;
    error.errorCode = "INVALID_INPUT";
    throw error;
  }
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
