export type MechanicDiagnosis = {
  id: string;
  assignmentId: string;
  requestId: string;
  mechanicId: string;
  diagnosisText: string;
  recommendedWorkText?: string;
  safetyNotes?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateMechanicDiagnosis = MechanicDiagnosis;

export type UpdateMechanicDiagnosis = Pick<
  MechanicDiagnosis,
  "id" | "diagnosisText" | "updatedAt"
> &
  Partial<Pick<MechanicDiagnosis, "recommendedWorkText" | "safetyNotes">>;

export interface DiagnosisRepository {
  create(input: CreateMechanicDiagnosis): Promise<MechanicDiagnosis>;
  findById(id: string): Promise<MechanicDiagnosis | undefined>;
  findByAssignmentId(assignmentId: string): Promise<MechanicDiagnosis | undefined>;
  findByAssignmentIdForUpdate(
    assignmentId: string
  ): Promise<MechanicDiagnosis | undefined>;
  /**
   * List all diagnosis records for an assignment. The mechanic_diagnoses
   * table enforces 1 row per assignment (UNIQUE on assignment_id) today,
   * but the repository returns an array so the service layer can evolve
   * to multi-version without changing call sites.
   */
  listByAssignmentId(assignmentId: string): Promise<MechanicDiagnosis[]>;
  update(input: UpdateMechanicDiagnosis): Promise<MechanicDiagnosis | undefined>;
}
