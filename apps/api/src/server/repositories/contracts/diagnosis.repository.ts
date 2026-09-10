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
  update(input: UpdateMechanicDiagnosis): Promise<MechanicDiagnosis | undefined>;
}
