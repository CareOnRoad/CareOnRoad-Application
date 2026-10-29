import type {
  CreateMotorcycle,
  Motorcycle,
  MotorcycleDetails,
  MotorcycleDetailsPatch,
  MotorcycleRepository,
  UpdateMotorcycle
} from "../contracts/motorcycle.repository";

export class InMemoryMotorcycleRepository implements MotorcycleRepository {
  constructor(private readonly motorcycles: Motorcycle[]) {}

  async create(input: CreateMotorcycle): Promise<Motorcycle> {
    const motorcycle: Motorcycle = { ...input };
    this.motorcycles.push(motorcycle);
    return cloneMotorcycle(motorcycle);
  }

  async listActiveByRider(riderId: string): Promise<Motorcycle[]> {
    return this.motorcycles
      .filter((motorcycle) => motorcycle.riderId === riderId && !motorcycle.archivedAt)
      .map(cloneMotorcycle);
  }

  async findById(id: string): Promise<Motorcycle | undefined> {
    const motorcycle = this.motorcycles.find((candidate) => candidate.id === id);
    return motorcycle ? cloneMotorcycle(motorcycle) : undefined;
  }

  async update(input: UpdateMotorcycle): Promise<Motorcycle | undefined> {
    const index = this.motorcycles.findIndex(
      (motorcycle) => motorcycle.id === input.id && !motorcycle.archivedAt
    );
    if (index < 0) {
      return undefined;
    }
    this.motorcycles[index] = {
      ...this.motorcycles[index]!,
      brandText: input.brandText,
      modelText: input.modelText,
      licensePlate: input.licensePlate,
      year: input.year,
      notes: input.notes,
      updatedAt: input.updatedAt
    };
    return cloneMotorcycle(this.motorcycles[index]!);
  }

  async updateDetails(input: {
    id: string;
    patch: MotorcycleDetailsPatch;
    updatedAt: Date;
  }): Promise<Motorcycle | undefined> {
    const index = this.motorcycles.findIndex(
      (motorcycle) => motorcycle.id === input.id && !motorcycle.archivedAt
    );
    if (index < 0) {
      return undefined;
    }
    const current = this.motorcycles[index]!;
    const merged: Record<string, string | number> = { ...current.details };
    for (const [key, value] of Object.entries(input.patch)) {
      if (value === null) delete merged[key];
      else if (value !== undefined) merged[key] = value;
    }
    this.motorcycles[index] = {
      ...current,
      details: Object.keys(merged).length > 0 ? (merged as MotorcycleDetails) : undefined,
      updatedAt: input.updatedAt
    };
    return cloneMotorcycle(this.motorcycles[index]!);
  }

  async archive(id: string, archivedAt: Date): Promise<Motorcycle | undefined> {
    const motorcycle = this.motorcycles.find((candidate) => candidate.id === id);
    if (!motorcycle || motorcycle.archivedAt) {
      return undefined;
    }
    motorcycle.archivedAt = archivedAt;
    motorcycle.updatedAt = archivedAt;
    return cloneMotorcycle(motorcycle);
  }

  findByIdForUpdate(id: string): Promise<Motorcycle | undefined> { return this.findById(id); }
}

function cloneMotorcycle(motorcycle: Motorcycle): Motorcycle {
  return {
    ...motorcycle,
    ...(motorcycle.details ? { details: { ...motorcycle.details } } : {}),
    archivedAt: motorcycle.archivedAt ? new Date(motorcycle.archivedAt) : undefined,
    createdAt: new Date(motorcycle.createdAt),
    updatedAt: new Date(motorcycle.updatedAt)
  };
}
