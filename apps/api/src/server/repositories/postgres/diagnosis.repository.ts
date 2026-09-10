import type { TransactionSql } from "postgres";

import type {
  CreateMechanicDiagnosis,
  DiagnosisRepository,
  MechanicDiagnosis,
  UpdateMechanicDiagnosis
} from "../contracts/diagnosis.repository";

type DiagnosisRow = {
  id: string;
  assignment_id: string;
  request_id: string;
  mechanic_id: string;
  diagnosis_text: string;
  recommended_work_text: string | null;
  safety_notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export class PostgresDiagnosisRepository implements DiagnosisRepository {
  constructor(private readonly sql: TransactionSql) {}

  async create(input: CreateMechanicDiagnosis): Promise<MechanicDiagnosis> {
    const rows = await this.sql<DiagnosisRow[]>`
      insert into mechanic_diagnoses (
        id, assignment_id, request_id, mechanic_id, diagnosis_text,
        recommended_work_text, safety_notes, created_at, updated_at
      )
      values (
        ${input.id}, ${input.assignmentId}, ${input.requestId}, ${input.mechanicId},
        ${input.diagnosisText}, ${input.recommendedWorkText ?? null},
        ${input.safetyNotes ?? null}, ${input.createdAt}, ${input.updatedAt}
      )
      returning *
    `;
    return mapDiagnosis(rows[0]!);
  }

  async findById(id: string): Promise<MechanicDiagnosis | undefined> {
    const rows = await this.sql<DiagnosisRow[]>`
      select * from mechanic_diagnoses where id = ${id} limit 1
    `;
    return rows[0] ? mapDiagnosis(rows[0]) : undefined;
  }

  async findByAssignmentId(
    assignmentId: string
  ): Promise<MechanicDiagnosis | undefined> {
    const rows = await this.sql<DiagnosisRow[]>`
      select * from mechanic_diagnoses where assignment_id = ${assignmentId} limit 1
    `;
    return rows[0] ? mapDiagnosis(rows[0]) : undefined;
  }

  async findByAssignmentIdForUpdate(
    assignmentId: string
  ): Promise<MechanicDiagnosis | undefined> {
    const rows = await this.sql<DiagnosisRow[]>`
      select *
      from mechanic_diagnoses
      where assignment_id = ${assignmentId}
      for update
      limit 1
    `;
    return rows[0] ? mapDiagnosis(rows[0]) : undefined;
  }

  async update(input: UpdateMechanicDiagnosis): Promise<MechanicDiagnosis | undefined> {
    const rows = await this.sql<DiagnosisRow[]>`
      update mechanic_diagnoses
      set diagnosis_text = ${input.diagnosisText},
          recommended_work_text = ${input.recommendedWorkText ?? null},
          safety_notes = ${input.safetyNotes ?? null},
          updated_at = ${input.updatedAt}
      where id = ${input.id}
      returning *
    `;
    return rows[0] ? mapDiagnosis(rows[0]) : undefined;
  }
}

function mapDiagnosis(row: DiagnosisRow): MechanicDiagnosis {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    requestId: row.request_id,
    mechanicId: row.mechanic_id,
    diagnosisText: row.diagnosis_text,
    recommendedWorkText: row.recommended_work_text ?? undefined,
    safetyNotes: row.safety_notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
