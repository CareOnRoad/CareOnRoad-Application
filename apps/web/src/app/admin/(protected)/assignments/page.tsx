import {
  fetchAdminAssignment,
  fetchAdminAssignmentTimeline
} from "@/lib/api/admin";
import {
  flattenSearchParams,
  getAdminSession,
  readParam,
  settle,
  type AdminSearchParams
} from "@/lib/admin/session";

import { AdminLayout } from "@/components/admin/admin-layout";
import {
  CursorPagination,
  DataTable,
  buildCursorHref,
  formatDateTime,
  type AdminTableColumn
} from "@/components/admin/data-table";
import { ErrorState, PageHeader, Panel } from "@/components/admin/page-header";
import { DetailField, StatusBadge } from "@/components/admin/status-badge";

import type {
  AdminAssignmentDetail,
  AdminAssignmentTimelineItem
} from "@careonroad/api-contract/admin/assignments";

/**
 * /admin/assignments — the "Điều phối" tab.
 *
 * The backend has NO global assignment list endpoint: assignments are only
 * reachable per id, through their request, or through the dispatch views of
 * a request.
 *
 * This tab therefore lists the assignments OF ONE REQUEST. The admin enters
 * the request id, and the page reads:
 *  - `GET /api/v1/admin/service-requests/{id}`           → the assignment
 *  - `GET /api/v1/admin/assignments/{id}`               → the assignment detail
 *  - `GET /api/v1/admin/assignments/{id}/timeline`      → the history
 *
 * A dispatch round view is offered alongside, since the round list is what
 * an admin actually browses when investigating a stuck dispatch.
 */
export default async function AdminAssignmentsPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;

  const requestId = readParam(params, "request_id");
  const flatParams = flattenSearchParams(params);

  const assignmentId = readParam(params, "assignment_id");

  const [detailResult, timelineResult] = assignmentId
    ? await Promise.all([
        settle(fetchAdminAssignment(session, assignmentId)),
        settle(
          fetchAdminAssignmentTimeline(session, assignmentId, {
            cursor: readParam(params, "cursor"),
            limit: 50
          })
        )
      ])
    : [null, null];

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Điều phối"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Điều phối"
          description="Backend không có danh sách phân công toàn cục. Tra cứu theo mã phân công hoặc mở từ trang chi tiết yêu cầu."
          endpoint="GET /api/v1/admin/assignments/{id}"
        />

        <Panel title="Tra cứu">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <label className="flex flex-col gap-1">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "#3d4d63" }}
              >
                Mã phân công
              </span>
              <input
                type="text"
                name="assignment_id"
                defaultValue={assignmentId ?? ""}
                placeholder="UUID của phân công"
                className="rounded-lg px-3 py-2 text-sm"
                style={{
                  border: "1px solid #e5e9ef",
                  backgroundColor: "#fff",
                  color: "#162130"
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "#3d4d63" }}
              >
                Mã yêu cầu
              </span>
              <input
                type="text"
                name="request_id"
                defaultValue={requestId ?? ""}
                placeholder="UUID của yêu cầu"
                className="rounded-lg px-3 py-2 text-sm"
                style={{
                  border: "1px solid #e5e9ef",
                  backgroundColor: "#fff",
                  color: "#162130"
                }}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: "#162130" }}
            >
              Tra cứu
            </button>
          </form>
        </Panel>

        {!assignmentId ? (
          <Panel title="Phân công">
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              Nhập mã phân công ở trên để xem chi tiết.
            </p>
          </Panel>
        ) : !detailResult ? null : !detailResult.ok ? (
          <ErrorState
            title="Không tải được thông tin phân công"
            message={detailResult.error.message}
          />
        ) : (
          <>
            <Panel
              title="Phân công"
              description={`GET /api/v1/admin/assignments/${assignmentId}`}
            >
              <AssignmentSummary assignment={detailResult.data} />
            </Panel>

            <Panel title="Dòng thời gian">
              {!timelineResult || !timelineResult.ok ? (
                <ErrorState
                  title="Không tải được dòng thời gian"
                  message={
                    timelineResult && !timelineResult.ok
                      ? timelineResult.error.message
                      : "Không tải được dữ liệu."
                  }
                />
              ) : (
                <>
                  <DataTable<AdminAssignmentTimelineItem>
                    caption="Dòng thời gian phân công"
                    rows={timelineResult.data.items}
                    emptyLabel="Chưa có sự kiện nào trên phân công này."
                    columns={timelineColumns}
                    rowKey={(row) => row.id}
                  />
                  <CursorPagination
                    page={timelineResult.data.page}
                    buildHref={(next) => buildCursorHref(flatParams, next)}
                  />
                </>
              )}
            </Panel>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function AssignmentSummary({
  assignment
}: {
  assignment: AdminAssignmentDetail;
}) {
  return (
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
      <DetailField label="Nguồn">
        {assignment.source}
      </DetailField>
      <DetailField label="Nhận việc lúc">
        {formatDateTime(assignment.accepted_at)}
      </DetailField>
      <DetailField label="Bắt đầu lúc">
        {assignment.started_at ? formatDateTime(assignment.started_at) : "—"}
      </DetailField>
      <DetailField label="Hoàn thành lúc">
        {assignment.completed_at ? formatDateTime(assignment.completed_at) : "—"}
      </DetailField>
      <DetailField label="Loại việc">
        {assignment.work_slot}
      </DetailField>
      <DetailField label="Hành động được phép">
        <span className="flex flex-wrap gap-1">
          {assignment.next_action_codes.map((code) => (
            <StatusBadge key={code} status={code} tone="info" label={code} />
          ))}
        </span>
      </DetailField>
      <DetailField label="Lý do chặn thao tác">
        <span className="flex flex-wrap gap-1">
          {assignment.commitment_reason_codes.length === 0
            ? "—"
            : assignment.commitment_reason_codes.map((code) => (
                <StatusBadge key={code} status={code} tone="warning" label={code} />
              ))}
        </span>
      </DetailField>
    </div>
  );
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
