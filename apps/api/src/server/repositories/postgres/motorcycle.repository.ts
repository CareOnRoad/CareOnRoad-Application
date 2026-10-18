import type { TransactionSql } from "postgres";

import { dateOnly } from "@/lib/vietnam-date";

import {
  motorcycleDetailColumns,
  type CreateMotorcycle,
  type Motorcycle,
  type MotorcycleDetails,
  type MotorcycleDetailsPatch,
  type MotorcycleRepository,
  type UpdateMotorcycle
} from "../contracts/motorcycle.repository";

type MotorcycleRow = {
  id: string;
  rider_id: string;
  brand_text: string;
  model_text: string;
  license_plate: string | null;
  year: number | null;
  notes: string | null;
  color: string | null;
  frame_number: string | null;
  engine_number: string | null;
  purchase_date: Date | string | null;
  purchase_price_vnd: string | number | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_expires_on: Date | string | null;
  warranty_expires_on: Date | string | null;
  preferred_service_center: string | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class PostgresMotorcycleRepository implements MotorcycleRepository {
  constructor(private readonly sql: TransactionSql) {}

  async create(input: CreateMotorcycle): Promise<Motorcycle> {
    const rows = await this.sql<MotorcycleRow[]>`
      insert into motorcycles (
        id, rider_id, brand_text, model_text, license_plate, year, notes,
        created_at, updated_at
      )
      values (
        ${input.id}, ${input.riderId}, ${input.brandText}, ${input.modelText},
        ${input.licensePlate ?? null}, ${input.year ?? null}, ${input.notes ?? null},
        ${input.createdAt}, ${input.updatedAt}
      )
      returning *
    `;
    return mapMotorcycle(rows[0]!);
  }

  async listActiveByRider(riderId: string): Promise<Motorcycle[]> {
    const rows = await this.sql<MotorcycleRow[]>`
      select *
      from motorcycles
      where rider_id = ${riderId}
        and archived_at is null
      order by created_at desc, id
    `;
    return rows.map(mapMotorcycle);
  }

  async findById(id: string): Promise<Motorcycle | undefined> {
    const rows = await this.sql<MotorcycleRow[]>`
      select * from motorcycles where id = ${id} limit 1
    `;
    return rows[0] ? mapMotorcycle(rows[0]) : undefined;
  }

  async update(input: UpdateMotorcycle): Promise<Motorcycle | undefined> {
    const rows = await this.sql<MotorcycleRow[]>`
      update motorcycles
      set
        brand_text = ${input.brandText},
        model_text = ${input.modelText},
        license_plate = ${input.licensePlate ?? null},
        year = ${input.year ?? null},
        notes = ${input.notes ?? null},
        updated_at = ${input.updatedAt}
      where id = ${input.id}
        and archived_at is null
      returning *
    `;
    return rows[0] ? mapMotorcycle(rows[0]) : undefined;
  }

  async updateDetails(input: {
    id: string;
    patch: MotorcycleDetailsPatch;
    updatedAt: Date;
  }): Promise<Motorcycle | undefined> {
    // Only keys the caller sent: null clears the column, undefined leaves it alone.
    const row = Object.fromEntries(
      Object.entries(input.patch)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [motorcycleDetailColumns[key as keyof MotorcycleDetails], value])
    );
    const rows = await this.sql<MotorcycleRow[]>`
      update motorcycles
      set ${this.sql(row)}, updated_at = ${input.updatedAt}
      where id = ${input.id}
        and archived_at is null
      returning *
    `;
    return rows[0] ? mapMotorcycle(rows[0]) : undefined;
  }

  async archive(id: string, archivedAt: Date): Promise<Motorcycle | undefined> {
    const rows = await this.sql<MotorcycleRow[]>`
      update motorcycles
      set archived_at = ${archivedAt}, updated_at = ${archivedAt}
      where id = ${id}
        and archived_at is null
      returning *
    `;
    return rows[0] ? mapMotorcycle(rows[0]) : undefined;
  }

  async findByIdForUpdate(id: string): Promise<Motorcycle | undefined> {
    const [row] = await this.sql<MotorcycleRow[]>`select * from motorcycles where id = ${id} for update`;
    return row ? mapMotorcycle(row) : undefined;
  }
}

function mapMotorcycle(row: MotorcycleRow): Motorcycle {
  return {
    id: row.id,
    riderId: row.rider_id,
    brandText: row.brand_text,
    modelText: row.model_text,
    licensePlate: row.license_plate ?? undefined,
    year: row.year ?? undefined,
    notes: row.notes ?? undefined,
    ...mapDetails(row),
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDetails(row: MotorcycleRow): { details: MotorcycleDetails } | undefined {
  const all: MotorcycleDetails = {
    color: row.color ?? undefined,
    frameNumber: row.frame_number ?? undefined,
    engineNumber: row.engine_number ?? undefined,
    purchaseDate: row.purchase_date ? dateOnly(row.purchase_date) : undefined,
    purchasePriceVnd: row.purchase_price_vnd == null ? undefined : Number(row.purchase_price_vnd),
    insuranceProvider: row.insurance_provider ?? undefined,
    insurancePolicyNumber: row.insurance_policy_number ?? undefined,
    insuranceExpiresOn: row.insurance_expires_on ? dateOnly(row.insurance_expires_on) : undefined,
    warrantyExpiresOn: row.warranty_expires_on ? dateOnly(row.warranty_expires_on) : undefined,
    preferredServiceCenter: row.preferred_service_center ?? undefined
  };
  const details = Object.fromEntries(Object.entries(all).filter(([, value]) => value !== undefined));
  return Object.keys(details).length > 0 ? { details } : undefined;
}
