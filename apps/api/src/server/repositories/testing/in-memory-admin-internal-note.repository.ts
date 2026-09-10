import type {
  AdminInternalNote,
  AdminInternalNoteRepository,
  CreateAdminInternalNote
} from "../contracts/admin-internal-note.repository";

export class InMemoryAdminInternalNoteRepository
  implements AdminInternalNoteRepository
{
  constructor(private readonly notes: AdminInternalNote[]) {}

  async create(input: CreateAdminInternalNote): Promise<AdminInternalNote> {
    if (this.notes.some((note) => note.id === input.id)) {
      throw new Error("ADMIN_INTERNAL_NOTE_ID_EXISTS");
    }
    const note: AdminInternalNote = {
      ...input,
      createdAt: input.createdAt ?? new Date()
    };
    this.notes.push(note);
    return cloneNote(note);
  }

  async findById(id: string): Promise<AdminInternalNote | undefined> {
    const note = this.notes.find((entry) => entry.id === id);
    return note ? cloneNote(note) : undefined;
  }
}

export function cloneAdminInternalNote(note: AdminInternalNote): AdminInternalNote {
  return cloneNote(note);
}

function cloneNote(note: AdminInternalNote): AdminInternalNote {
  return {
    ...note,
    createdAt: new Date(note.createdAt)
  };
}
