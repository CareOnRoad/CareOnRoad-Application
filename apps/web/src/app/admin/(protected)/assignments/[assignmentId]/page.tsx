import { fetchAdminAssignment } from "@/lib/api/admin";
import { getAdminSession, settle, settleOrNotFound } from "@/lib/admin/session";

import { AdminLayout } from "@/components/admin/admin-layout";
import {
  DataTable,
  formatDateTime,
  type AdminTableColumn
} from "@/components/admin/data-table";
import { ErrorState, PageHeader, Panel } from "@/components/admin/page-header";
import { DetailField, StatusBadge } from "@/components/admin/status-badge";

import { AssignmentCommandForms } from "./assignment-command-forms";
import { AssignmentDiagnosisPanel } from "./assignment-diagnosis-panel";

import type { AdminAssignmentTimelineItem } from "@careonroad/api-contract/admin/assignments";

/**
 * /admin/assignments/[assignmentId] — the detail screen of the "Điều phối"
 * tab.
 *
 * The backend exposes assignments only through the per-assignment routes —
 * there is NO global assignment list endpoint. The tab therefore asks the
 * admin for an assignment id (or links here from a request), and the page
 * shows the assignment, its legal next actions and its timeline.
 *
 * `next_action_codes` is the BACKEND's decision about what is legal right now
 * (the frontend never re-derives it).
 */
export default async function AdminAssignmentDetailPage({
  params
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const { actor, session } = await getAdminSession();

  const [detailResult, timelineResult] = await Promise.all([
    settleOrNotFound(fetchAdminAssignment(session, assignmentId)),
    settle(
      fetchAdminAssignmentTimelineSafe(session, assignmentId)
    )
  ]);

  if (!detailResult.ok) {
    return (
      <AdminLayout
        crumb={["CareOnRoad", "Điều hành", "Điều phối"]}
        userName={actor.display_name?.trim() || "Quản trị viên"}
      >
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Phân công"
            endpoint={`GET /api/v1/admin/assignments/${assignmentId}`}
            backHref="/admin/assignments"
          />
          <ErrorState
            title="Không tải được thông tin phân công"
            message={detailResult.error.message}
          />
        </div>
      </AdminLayout>
    );
  }

  const assignment = detailResult.data;

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Điều phối", assignment.id]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Phân công"
          description={`Yêu cầu: ${assignment.request_id}`}
          endpoint={`GET /api/v1/admin/assignments/${assignmentId}`}
          backHref="/admin/assignments"
        />

        <Panel title="Thông tin phân công">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <DetailField label="Trạng thái">
              <StatusBadge status={assignment.status} />
            </DetailField>
            <DetailField label="Trạng thái yêu cầu">
              <StatusBadge status={assignment.request_status} />
            </DetailField>
            <DetailField label="Kỹ thuật viên">
              <span className="font-mono text-xs">{assignment.mechanic_id}</span>
            </DetailField>
            <DetailField label="Nguồn phân công">
              {assignment.source}
            </DetailField>
            <DetailField label="Loại việc">
              {assignment.work_slot}
            </DetailField>
            <DetailField label="Nhận việc lúc">
              {formatDateTime(assignment.accepted_at)}
            </DetailField>
            <DetailField label="Bắt đầu lúc">
              {assignment.started_at ? formatDateTime(assignment.started_at) : "—"}
            </DetailField>
            <DetailField label="Hoàn thành lúc">
              {assignment.completed_at
                ? formatDateTime(assignment.completed_at)
                : "—"}
            </DetailField>
          </div>

          <div className="flex flex-col gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "#3d4d63" }}
            >
              Hành động được phép
            </span>
            <span className="flex flex-wrap gap-1">
              {assignment.next_action_codes.length === 0 ? (
                <span className="text-xs" style={{ color: "#6b7a8d" }}>
                  Không có hành động nào khả dụng.
                </span>
              ) : (
                assignment.next_action_codes.map((code) => (
                  <StatusBadge key={code} status={code} tone="info" label={code} />
                ))
              )}
            </span>
          </div>

          {assignment.commitment_reason_codes.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "#3d4d63" }}
              >
                Lý do chặn thao tác
              </span>
              <span className="flex flex-wrap gap-1">
                {assignment.commitment_reason_codes.map((code) => (
                  <StatusBadge key={code} status={code} tone="warning" label={code} />
                ))}
              </span>
            </div>
          ) : null}
        </Panel>

        <Panel title="Thao tác quản trị">
          <AssignmentCommandForms
            assignmentId={assignment.id}
            requestId={assignment.request_id}
            nextActionCodes={assignment.next_action_codes}
          />
        </Panel>

        <AssignmentDiagnosisPanel assignmentId={assignment.id} />

        <Panel title="Dòng thời gian phân công">
          {!timelineResult.ok ? (
            <ErrorState
              title="Không tải được dòng thời gian"
              message={timelineResult.error.message}
            />
          ) : (
            <DataTable<AdminAssignmentTimelineItem>
              caption="Dòng thời gian phân công"
              rows={timelineResult.data.items}
              emptyLabel="Chưa có sự kiện nào trên phân công này."
              columns={timelineColumns}
              rowKey={(row) => row.id}
            />
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}

/**
 * Fetches the assignment timeline.
 *
 * The timeline route accepts the shared pagination query, so the wrapper is
 * imported lazily here to keep the page's import list focused.
 */
async function fetchAdminAssignmentTimelineSafe(
  session: { accessToken: string },
  assignmentId: string
) {
  const { fetchAdminAssignmentTimeline } = await import("@/lib/api/admin");
  return fetchAdminAssignmentTimeline(session, assignmentId, { limit: 50 });
}

const timelineColumns: AdminTableColumn<AdminAssignmentTimelineItem>[] = [
  {
    key: "type",
    header: "Loại",
    render: (row) => (
      <StatusBadge
        status={row.type}
        tone={row.type === "status" ? "info" : "neutral"}
        label={row.type === "status" ? "Chuyển trạng thái" : "Hành động quản trị"}
      />
    )
  },
  {
    key: "transition",
    header: "Nội dung",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.type === "status"
          ? `${row.from_status ?? "—"} → ${row.to_status}`
          : (row.action ?? "—")}
      </span>
    )
  },
  {
    key: "actor_id",
    header: "Người thực hiện",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#6b7a8d" }}>
        {row.actor_id ?? "—"}
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
