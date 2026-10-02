export type Motorcycle = {
  id: string;
  riderId: string;
  brandText: string;
  modelText: string;
  licensePlate?: string;
  year?: number;
  notes?: string;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type MotorcycleInput = {
  brandText: string;
  modelText: string;
  licensePlate?: string;
  year?: number;
  notes?: string;
};

export type CreateMotorcycle = MotorcycleInput & {
  id: string;
  riderId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateMotorcycle = MotorcycleInput & {
  id: string;
  updatedAt: Date;
};

export interface MotorcycleRepository {
  create(input: CreateMotorcycle): Promise<Motorcycle>;
  listActiveByRider(riderId: string): Promise<Motorcycle[]>;
  findById(id: string): Promise<Motorcycle | undefined>;
  findByIdForUpdate(id: string): Promise<Motorcycle | undefined>;
  update(input: UpdateMotorcycle): Promise<Motorcycle | undefined>;
  archive(id: string, archivedAt: Date): Promise<Motorcycle | undefined>;
}
