import type { TransactionSql } from "postgres";

import type {
  AdminInternalNote,
  AdminInternalNoteRepository,
  CreateAdminInternalNote
} from "../contracts/admin-internal-note.repository";

type AdminInternalNoteRow = {
  id: string;
  admin_id: string;
  service_request_id: string | null;
  assignment_id: string | null;
  note_text: string;
  created_at: Date;
};

export class PostgresAdminInternalNoteRepository
  implements AdminInternalNoteRepository
{
  constructor(private readonly sql: TransactionSql) {}

  async create(input: CreateAdminInternalNote): Promise<AdminInternalNote> {
    const rows = await this.sql<AdminInternalNoteRow[]>`
      insert into admin_internal_notes (
        id, admin_id, service_request_id, assignment_id, note_text, created_at
      ) values (
        ${input.id}, ${input.adminId}, ${input.serviceRequestId ?? null},
        ${input.assignmentId ?? null}, ${input.noteText}, ${input.createdAt ?? new Date()}
      )
      returning *
    `;
    return mapAdminInternalNote(rows[0]!);
  }

  async findById(id: string): Promise<AdminInternalNote | undefined> {
    const rows = await this.sql<AdminInternalNoteRow[]>`
      select *
      from admin_internal_notes
      where id = ${id}
      limit 1
    `;
    return rows[0] ? mapAdminInternalNote(rows[0]) : undefined;
  }
}

export function mapAdminInternalNote(row: AdminInternalNoteRow): AdminInternalNote {
  const target =
    row.service_request_id !== null
      ? { serviceRequestId: row.service_request_id }
      : { assignmentId: row.assignment_id! };

  return {
    id: row.id,
    adminId: row.admin_id,
    ...target,
    noteText: row.note_text,
    createdAt: row.created_at
  };
}
