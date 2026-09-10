export type AdminInternalNoteTarget =
  | { serviceRequestId: string; assignmentId?: never }
  | { serviceRequestId?: never; assignmentId: string };

export type AdminInternalNote = AdminInternalNoteTarget & {
  id: string;
  adminId: string;
  noteText: string;
  createdAt: Date;
};

export type CreateAdminInternalNote = AdminInternalNoteTarget & {
  id: string;
  adminId: string;
  noteText: string;
  createdAt?: Date;
};

export interface AdminInternalNoteRepository {
  create(input: CreateAdminInternalNote): Promise<AdminInternalNote>;
  findById(id: string): Promise<AdminInternalNote | undefined>;
}
