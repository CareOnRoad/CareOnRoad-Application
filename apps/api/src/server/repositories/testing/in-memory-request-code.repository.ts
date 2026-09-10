import type {
  RequestCodePrefix,
  RequestCodeRepository,
  RequestCodeSequence
} from "../contracts/request-code.repository";

export class InMemoryRequestCodeRepository implements RequestCodeRepository {
  constructor(private readonly sequences: RequestCodeSequence[]) {}

  async allocateNext(
    servicePrefix: RequestCodePrefix,
    localDate: string,
    updatedAt: Date
  ): Promise<RequestCodeSequence> {
    const existing = this.sequences.find(
      (sequence) => sequence.servicePrefix === servicePrefix && sequence.localDate === localDate
    );
    if (existing) {
      existing.lastSequence += 1;
      existing.updatedAt = updatedAt;
      return cloneSequence(existing);
    }

    const sequence: RequestCodeSequence = {
      localDate,
      servicePrefix,
      lastSequence: 1,
      updatedAt
    };
    this.sequences.push(sequence);
    return cloneSequence(sequence);
  }
}

function cloneSequence(sequence: RequestCodeSequence): RequestCodeSequence {
  return {
    ...sequence,
    updatedAt: new Date(sequence.updatedAt)
  };
}
