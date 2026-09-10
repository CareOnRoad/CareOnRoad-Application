import type { TransactionSql } from "postgres";

import type {
  CreateMotorcycle,
  Motorcycle,
  MotorcycleRepository,
  UpdateMotorcycle
} from "../contracts/motorcycle.repository";

type MotorcycleRow = {
  id: string;
  rider_id: string;
  brand_text: string;
  model_text: string;
  license_plate: string | null;
  year: number | null;
  notes: string | null;
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
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
