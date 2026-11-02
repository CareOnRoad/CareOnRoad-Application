import { fetchAdminAssignmentDiagnosis } from "@/lib/api/admin";
import { getAdminSession, settle } from "@/lib/admin/session";

import {
  DataTable,
  formatDateTime,
  type AdminTableColumn
} from "@/components/admin/data-table";
import { ErrorState, Panel } from "@/components/admin/page-header";
import {
  BooleanBadge,
  DetailField,
  StatusBadge
} from "@/components/admin/status-badge";

import { DiagnosisRevisionForm } from "@/app/admin/(protected)/quotes/diagnosis-revision-form";

import type {
  AdminAssignmentDiagnosis,
  AdminSupervisionAction
} from "@careonroad/api-contract/admin/assignments";

/**
 * The assignment diagnosis panel.
 *
 * Reads `GET /api/v1/admin/assignments/{id}/diagnosis`, which returns the
 * mechanic's diagnosis together with its audit history and the admin
 * supervision log.
 *
 * The diagnosis is IMMUTABLE once written. The only administrative action is
 * asking the mechanic to REVISE it, and the backend refuses that once a
 * quote exists (`diagnosis_issued`) or while a payment is unresolved
 * (`payment_unresolved`) — so the button is offered only when the backend
 * reports `immutable: false`.
 */
export async function AssignmentDiagnosisPanel({
  assignmentId
}: {
  assignmentId: string;
}) {
  const { session } = await getAdminSession();
  const result = await settle(fetchAdminAssignmentDiagnosis(session, assignmentId));

  if (!result.ok) {
    return (
      <Panel title="Chẩn đoán kỹ thuật viên">
        <ErrorState
          title="Không tải được chẩn đoán"
          message={result.error.message}
        />
      </Panel>
    );
  }

  const diagnosis = result.data;

  return (
    <Panel
      title="Chẩn đoán kỹ thuật viên"
      description={`GET /api/v1/admin/assignments/${assignmentId}/diagnosis`}
    >
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <DetailField label="Mã chẩn đoán">
          <span className="font-mono text-xs">{diagnosis.id}</span>
        </DetailField>
        <DetailField label="Có mô tả sự cố">
          <BooleanBadge value={diagnosis.has_diagnosis} />
        </DetailField>
        <DetailField label="Có hạng mục đề xuất">
          <BooleanBadge value={diagnosis.has_recommended_work} />
        </DetailField>
        <DetailField label="Có ghi chú an toàn">
          <BooleanBadge value={diagnosis.has_safety_notes} />
        </DetailField>
        <DetailField label="Đã bất biến">
          <BooleanBadge value={diagnosis.immutable} />
        </DetailField>
        <DetailField label="Tạo lúc">
          {formatDateTime(diagnosis.created_at)}
        </DetailField>
        <DetailField label="Cập nhật lúc">
          {formatDateTime(diagnosis.updated_at)}
        </DetailField>
        <DetailField label="Yêu cầu">
          <span className="font-mono text-xs">{diagnosis.request_id}</span>
        </DetailField>
      </div>

      <div className="flex flex-col gap-4">
        <DiagnosisRevisionForm
          diagnosisId={diagnosis.id}
          assignmentId={diagnosis.assignment_id}
          canRequestRevision={!diagnosis.immutable}
        />

        <div className="flex flex-col gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#3d4d63" }}
          >
            Lịch sử chẩn đoán
          </span>
          {diagnosis.history.items.length === 0 ? (
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              Chưa có lịch sử nào.
            </p>
          ) : (
            <DataTable<{ id: string; action: string; actor_id: string; created_at: string }>
              caption="Lịch sử chẩn đoán"
              rows={diagnosis.history.items}
              emptyLabel="Chưa có lịch sử nào."
              columns={historyColumns}
              rowKey={(row) => row.id}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#3d4d63" }}
          >
            Nhật ký giám sát
          </span>
          {diagnosis.supervision.items.length === 0 ? (
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              Chưa có hành động giám sát nào.
            </p>
          ) : (
            <DataTable<AdminSupervisionAction>
              caption="Nhật ký giám sát chẩn đoán"
              rows={diagnosis.supervision.items}
              emptyLabel="Chưa có hành động giám sát nào."
              columns={supervisionColumns}
              rowKey={(row) => row.id}
            />
          )}
        </div>
      </div>
    </Panel>
  );
}

const historyColumns: AdminTableColumn<{
  id: string;
  action: string;
  actor_id: string;
  created_at: string;
}>[] = [
  {
    key: "action",
    header: "Hành động",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#162130" }}>
        {row.action}
      </span>
    )
  },
  {
    key: "actor_id",
    header: "Người thực hiện",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#6b7a8d" }}>
        {row.actor_id}
      </span>
    )
  },
  {
    key: "created_at",
    header: "Thời điểm",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.created_at)}
      </span>
    )
  }
];

const supervisionColumns: AdminTableColumn<AdminSupervisionAction>[] = [
  {
    key: "action",
    header: "Hành động",
    render: (row) => (
      <StatusBadge status={row.action} tone="info" label={row.action} />
    )
  },
  {
    key: "admin_id",
    header: "Quản trị viên",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#6b7a8d" }}>
        {row.admin_id}
      </span>
    )
  },
  {
    key: "created_at",
    header: "Thời điểm",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.created_at)}
      </span>
    )
  }
];

/** Re-exported so the page can type the panel's props. */
export type { AdminAssignmentDiagnosis };
