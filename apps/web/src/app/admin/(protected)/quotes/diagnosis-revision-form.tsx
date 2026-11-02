"use client";

import { CommandForm } from "@/components/admin/command-form";

import { requestDiagnosisRevisionAction } from "./actions";

/**
 * The diagnosis revision request.
 *
 * A diagnosis that has NOT produced a quote yet can be sent back to the
 * mechanic for a revision. The backend refuses it once a quote exists
 * (`diagnosis_issued`) or while an unresolved payment is open
 * (`payment_unresolved`), so the form is only offered when the backend
 * reports the diagnosis as still editable.
 *
 * The diagnosis itself is IMMUTABLE once it exists — this command does not
 * edit it, it asks the mechanic to revise it.
 */
export function DiagnosisRevisionForm({
  diagnosisId,
  assignmentId,
  canRequestRevision
}: {
  diagnosisId: string;
  assignmentId: string;
  canRequestRevision: boolean;
}) {
  return (
    <CommandForm
      action={requestDiagnosisRevisionAction}
      label="Yêu cầu sửa chẩn đoán"
      confirmText="Gửi yêu cầu sửa"
      disabled={!canRequestRevision}
      disabledHint={
        canRequestRevision
          ? undefined
          : "Chẩn đoán đã phát sinh báo giá hoặc đang có khoản thanh toán chưa xử lý nên không thể yêu cầu sửa."
      }
      description="Gửi chẩn đoán trở lại kỹ thuật viên để lập phiên bản sửa đổi. Bản ghi chẩn đoán cũ được giữ nguyên."
    >
      <input type="hidden" name="diagnosisId" value={diagnosisId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
    </CommandForm>
  );
}
