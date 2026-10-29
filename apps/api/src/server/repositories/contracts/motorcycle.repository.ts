// VIP-only, rider-private details. Dates are YYYY-MM-DD.
export type MotorcycleDetails = {
  color?: string;
  frameNumber?: string;
  engineNumber?: string;
  purchaseDate?: string;
  purchasePriceVnd?: number;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceExpiresOn?: string;
  warrantyExpiresOn?: string;
  preferredServiceCenter?: string;
};

// Column name per detail key; the audit/outbox log these names, never the values.
export const motorcycleDetailColumns = {
  color: "color",
  frameNumber: "frame_number",
  engineNumber: "engine_number",
  purchaseDate: "purchase_date",
  purchasePriceVnd: "purchase_price_vnd",
  insuranceProvider: "insurance_provider",
  insurancePolicyNumber: "insurance_policy_number",
  insuranceExpiresOn: "insurance_expires_on",
  warrantyExpiresOn: "warranty_expires_on",
  preferredServiceCenter: "preferred_service_center"
} as const satisfies Record<keyof MotorcycleDetails, string>;

// undefined keeps the stored value, null clears it.
export type MotorcycleDetailsPatch = { [K in keyof MotorcycleDetails]?: MotorcycleDetails[K] | null };

export type Motorcycle = {
  id: string;
  riderId: string;
  brandText: string;
  modelText: string;
  licensePlate?: string;
  year?: number;
  notes?: string;
  details?: MotorcycleDetails;
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
  updateDetails(input: {
    id: string;
    patch: MotorcycleDetailsPatch;
    updatedAt: Date;
  }): Promise<Motorcycle | undefined>;
  archive(id: string, archivedAt: Date): Promise<Motorcycle | undefined>;
}
