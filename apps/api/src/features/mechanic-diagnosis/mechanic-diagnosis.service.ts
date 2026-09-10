import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { loadActiveActor, primaryAuditRole } from "@/features/assignments/assignment.service";
import type { MechanicDiagnosis } from "@/server/repositories/contracts/diagnosis.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { mechanicDiagnosisInputSchema } from "./mechanic-diagnosis.schemas";

export type MechanicDiagnosisResponse = {
  id: string;
  assignment_id: string;
  request_id: string;
  mechanic_id: string;
  diagnosis_text: string;
  recommended_work_text?: string;
  safety_notes?: string;
  created_at: string;
  updated_at: string;
};

export type MechanicDiagnosisServiceOptions = {
  now?: () => Date;
  createId?: () => string;
};

export class MechanicDiagnosisService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: MechanicDiagnosisServiceOptions = {}
  ) {}

  async upsertDiagnosis(
    identity: VerifiedSupabaseIdentity,
    assignmentId: string,
    input: unknown
  ): Promise<MechanicDiagnosisResponse> {
    const parsed = mechanicDiagnosisInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new MechanicDiagnosisError(
        "INVALID_INPUT",
        "Mechanic diagnosis input is invalid.",
        400,
        { issues: parsed.error.issues }
      );
    }

    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const assignment = await repositories.assignments.findByIdForUpdate(assignmentId);
      if (!assignment) {
        throw new MechanicDiagnosisError("NOT_FOUND", "Assignment not found.", 404);
      }
      if (
        !actor.roles.includes("admin") &&
        (!actor.roles.includes("mechanic") || assignment.mechanicId !== actor.id)
      ) {
        throw new MechanicDiagnosisError(
          "FORBIDDEN",
          "Assigned mechanic or admin access is required.",
          403
        );
      }
      if (assignment.status !== "on_site" && assignment.status !== "diagnosis") {
        throw new MechanicDiagnosisError(
          "CONFLICT",
          "Diagnosis is allowed only while the assignment is on site or in diagnosis.",
          409
        );
      }

      const existing = await repositories.diagnoses.findByAssignmentIdForUpdate(
        assignment.id
      );
      if (existing && (await repositories.quotes.hasAnyByDiagnosis(existing.id))) {
        throw new MechanicDiagnosisError(
          "CONFLICT",
          "Diagnosis is immutable after a quote references it.",
          409
        );
      }

      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const diagnosis = existing
        ? await repositories.diagnoses.update({
            id: existing.id,
            diagnosisText: parsed.data.diagnosis_text,
            recommendedWorkText: parsed.data.recommended_work_text,
            safetyNotes: parsed.data.safety_notes,
            updatedAt: now
          })
        : await repositories.diagnoses.create({
            id: createId(),
            assignmentId: assignment.id,
            requestId: assignment.requestId,
            mechanicId: assignment.mechanicId,
            diagnosisText: parsed.data.diagnosis_text,
            recommendedWorkText: parsed.data.recommended_work_text,
            safetyNotes: parsed.data.safety_notes,
            createdAt: now,
            updatedAt: now
          });
      if (!diagnosis) {
        throw new MechanicDiagnosisError("NOT_FOUND", "Diagnosis not found.", 404);
      }

      const action = existing ? "mechanic_diagnosis.revised" : "mechanic_diagnosis.created";
      const occurrenceId = createId();
      const payload = {
        diagnosis_id: diagnosis.id,
        assignment_id: diagnosis.assignmentId,
        request_id: diagnosis.requestId,
        mechanic_id: diagnosis.mechanicId,
        status: existing ? "revised" : "created"
      };
      await repositories.outbox.append({
        id: occurrenceId,
        topic: action,
        aggregateType: "mechanic_diagnosis",
        aggregateId: diagnosis.id,
        dedupeKey: `${action}:${diagnosis.id}:${occurrenceId}`,
        payload,
        createdAt: now,
        nextAttemptAt: now
      });
      await repositories.audit.append({
        id: createId(),
        actorId: actor.id,
        actorRole: primaryAuditRole(actor.roles),
        action,
        entityType: "mechanic_diagnosis",
        entityId: diagnosis.id,
        requestId: diagnosis.requestId,
        metadata: payload,
        createdAt: now
      });
      return toMechanicDiagnosisResponse(diagnosis);
    });
  }
}

export class MechanicDiagnosisError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT"
    >,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "MechanicDiagnosisError";
  }
}

export function toMechanicDiagnosisResponse(
  diagnosis: MechanicDiagnosis
): MechanicDiagnosisResponse {
  return {
    id: diagnosis.id,
    assignment_id: diagnosis.assignmentId,
    request_id: diagnosis.requestId,
    mechanic_id: diagnosis.mechanicId,
    diagnosis_text: diagnosis.diagnosisText,
    recommended_work_text: diagnosis.recommendedWorkText,
    safety_notes: diagnosis.safetyNotes,
    created_at: diagnosis.createdAt.toISOString(),
    updated_at: diagnosis.updatedAt.toISOString()
  };
}
