import type {
  CreateMechanicDiagnosis,
  DiagnosisRepository,
  MechanicDiagnosis,
  UpdateMechanicDiagnosis
} from "../contracts/diagnosis.repository";

export class InMemoryDiagnosisRepository implements DiagnosisRepository {
  constructor(private readonly diagnoses: MechanicDiagnosis[]) {}

  async create(input: CreateMechanicDiagnosis): Promise<MechanicDiagnosis> {
    if (this.diagnoses.some((diagnosis) => diagnosis.assignmentId === input.assignmentId)) {
      throw new Error("DIAGNOSIS_ASSIGNMENT_EXISTS");
    }
    const diagnosis = cloneDiagnosis(input);
    this.diagnoses.push(diagnosis);
    return cloneDiagnosis(diagnosis);
  }

  async findById(id: string): Promise<MechanicDiagnosis | undefined> {
    const diagnosis = this.diagnoses.find((item) => item.id === id);
    return diagnosis ? cloneDiagnosis(diagnosis) : undefined;
  }

  async findByAssignmentId(assignmentId: string): Promise<MechanicDiagnosis | undefined> {
    const diagnosis = this.diagnoses.find((item) => item.assignmentId === assignmentId);
    return diagnosis ? cloneDiagnosis(diagnosis) : undefined;
  }

  async findByAssignmentIdForUpdate(
    assignmentId: string
  ): Promise<MechanicDiagnosis | undefined> {
    return this.findByAssignmentId(assignmentId);
  }

  async update(input: UpdateMechanicDiagnosis): Promise<MechanicDiagnosis | undefined> {
    const diagnosis = this.diagnoses.find((item) => item.id === input.id);
    if (!diagnosis) {
      return undefined;
    }
    diagnosis.diagnosisText = input.diagnosisText;
    diagnosis.recommendedWorkText = input.recommendedWorkText;
    diagnosis.safetyNotes = input.safetyNotes;
    diagnosis.updatedAt = input.updatedAt;
    return cloneDiagnosis(diagnosis);
  }
}

function cloneDiagnosis(diagnosis: MechanicDiagnosis): MechanicDiagnosis {
  return {
    ...diagnosis,
    createdAt: new Date(diagnosis.createdAt),
    updatedAt: new Date(diagnosis.updatedAt)
  };
}
