import {
  fetchAdminMechanic,
  fetchAdminMechanicPerformance,
  fetchAdminMechanicWorkHistory
} from "@/lib/api/admin";
import {
  flattenSearchParams,
  getAdminSession,
  readParam,
  settle,
  settleOrNotFound,
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
import {
  BooleanBadge,
  DetailField,
  StatusBadge
} from "@/components/admin/status-badge";

import {
  MechanicForceUnavailableForm,
  MechanicRadiusForm,
  MechanicSkillsForm
} from "./mechanic-config-forms";
import { MechanicStatusForm } from "./mechanic-status-form";

import type { AdminMechanicWorkHistory } from "@careonroad/api-contract/admin/mechanics";

/**
 * /admin/mechanics/[mechanicId] — the detail screen of the "Kỹ thuật viên"
 * tab.
 *
 * Four backend reads feed this page:
 *  - `GET /api/v1/admin/mechanics/{id}`            → the profile
 *  - `GET /api/v1/admin/mechanics/{id}/work-history`
 *  - `GET /api/v1/admin/mechanics/{id}/performance`
 *
 * The state machine of `mechanic_profile_status` is enforced here so an
 * admin cannot submit a transition the backend would reject:
 *   pending   → active | rejected
 *   active    → suspended | banned
 *   suspended → active
 */
export default async function AdminMechanicDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ mechanicId: string }>;
  searchParams: Promise<AdminSearchParams>;
}) {
  const { mechanicId } = await params;
  const query = await searchParams;
  const { actor, session } = await getAdminSession();

  const profileResult = await settleOrNotFound(
    fetchAdminMechanic(session, mechanicId)
  );

  if (!profileResult.ok) {
    return (
      <AdminLayout
        crumb={["CareOnRoad", "Điều hành", "Kỹ thuật viên"]}
        userName={actor.display_name?.trim() || "Quản trị viên"}
      >
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Kỹ thuật viên"
            endpoint={`GET /api/v1/admin/mechanics/${mechanicId}`}
            backHref="/admin/mechanics"
          />
          <ErrorState
            title="Không tải được thông tin kỹ thuật viên"
            message={profileResult.error.message}
          />
        </div>
      </AdminLayout>
    );
  }

  const profile = profileResult.data;
  const flatParams = flattenSearchParams(query);

  const [historyResult, performanceResult] = await Promise.all([
    settle(
      fetchAdminMechanicWorkHistory(session, mechanicId, {
        cursor: readParam(query, "cursor"),
        limit: 20
      })
    ),
    settle(fetchAdminMechanicPerformance(session, mechanicId))
  ]);

  const status = profile.profile_status;
  const canApprove = status === "pending";
  const canReject = status === "pending";
  const canSuspend = status === "active";
  const canBan = status === "active" || status === "suspended";
  const canReactivate = status === "suspended";

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Kỹ thuật viên", mechanicId]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Hồ sơ kỹ thuật viên"
          description={`Mã người dùng: ${profile.user_id}`}
          endpoint={`GET /api/v1/admin/mechanics/${mechanicId}`}
          backHref="/admin/mechanics"
        />

        <Panel title="Thông tin hồ sơ">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <DetailField label="Trạng thái hồ sơ">
              <StatusBadge status={status} />
            </DetailField>
            <DetailField label="Sẵn sàng nhận việc">
              <BooleanBadge value={profile.is_available} />
            </DetailField>
            <DetailField label="Tình trạng việc">
              <StatusBadge
                status={profile.work_state}
                tone={profile.work_state === "active_assignment" ? "info" : "neutral"}
              />
            </DetailField>
            <DetailField label="Độ mới vị trí">
              <StatusBadge status={profile.location_freshness} />
            </DetailField>
            <DetailField label="Bán kính phục vụ">
              {profile.service_radius_km} km
            </DetailField>
            <DetailField label="Đánh giá">
              {profile.rating_avg.toFixed(2)} ({profile.rating_count} đánh giá)
            </DetailField>
            <DetailField label="Cập nhật lúc">
              {formatDateTime(profile.availability_updated_at)}
            </DetailField>
            <DetailField label="Ngày tạo">
              {formatDateTime(profile.created_at)}
            </DetailField>
          </div>
        </Panel>

        <Panel title="Loại dịch vụ phục vụ">
          <span className="flex flex-wrap gap-1">
            {profile.service_types.map((type) => (
              <StatusBadge key={type} status={type} tone="info" label={type} />
            ))}
          </span>
        </Panel>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel title="Quản lý hồ sơ">
            <div className="flex flex-col gap-6">
              <MechanicStatusForm
                mechanicId={mechanicId}
                action="approve"
                label="Duyệt hồ sơ"
                description="Chuyển hồ sơ sang trạng thái hoạt động, cho phép nhận việc."
                disabled={!canApprove}
                disabledHint={
                  canApprove ? undefined : "Chỉ duyệt được hồ sơ đang chờ."
                }
              />
              <MechanicStatusForm
                mechanicId={mechanicId}
                action="reject"
                label="Từ chối hồ sơ"
                description="Từ chối hồ sơ đăng ký của kỹ thuật viên."
                variant="danger"
                disabled={!canReject}
                disabledHint={
                  canReject ? undefined : "Chỉ từ chối được hồ sơ đang chờ."
                }
              />
              <MechanicStatusForm
                mechanicId={mechanicId}
                action="suspend"
                label="Đình chỉ"
                description="Tạm thời loại kỹ thuật viên khỏi danh sách nhận việc."
                variant="danger"
                disabled={!canSuspend}
                disabledHint={
                  canSuspend ? undefined : "Chỉ đình chỉ được hồ sơ đang hoạt động."
                }
              />
              <MechanicStatusForm
                mechanicId={mechanicId}
                action="ban"
                label="Cấm"
                description="Cấm vĩnh viễn kỹ thuật viên. Không thể hoàn tác từ giao diện này."
                variant="danger"
                disabled={!canBan}
                disabledHint={
                  canBan
                    ? undefined
                    : "Chỉ cấm được hồ sơ đang hoạt động hoặc bị đình chỉ."
                }
              />
              <MechanicStatusForm
                mechanicId={mechanicId}
                action="reactivate"
                label="Kích hoạt lại"
                description="Trả kỹ thuật viên về trạng thái hoạt động."
                disabled={!canReactivate}
                disabledHint={
                  canReactivate
                    ? undefined
                    : "Chỉ kích hoạt lại được hồ sơ đang bị đình chỉ."
                }
              />
            </div>
          </Panel>

          <div className="flex flex-col gap-6">
            <Panel title="Kỹ năng">
              <MechanicSkillsForm
                mechanicId={mechanicId}
                currentServiceTypes={profile.service_types}
              />
            </Panel>

            <Panel title="Bán kính phục vụ">
              <MechanicRadiusForm
                mechanicId={mechanicId}
                currentRadiusKm={profile.service_radius_km}
              />
            </Panel>

            <Panel title="Tạm ngừng nhận việc">
              <MechanicForceUnavailableForm
                mechanicId={mechanicId}
                isAvailable={profile.is_available}
              />
            </Panel>
          </div>
        </div>

        <Panel title="Hiệu suất">
          {!performanceResult.ok ? (
            <ErrorState
              title="Không tải được số liệu hiệu suất"
              message={performanceResult.error.message}
            />
          ) : (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              <DetailField label="Tổng phân công">
                {performanceResult.data.assignments.total}
              </DetailField>
              <DetailField label="Đang thực hiện">
                {performanceResult.data.assignments.active}
              </DetailField>
              <DetailField label="Hoàn thành">
                {performanceResult.data.assignments.completed}
              </DetailField>
              <DetailField label="Đã huỷ">
                {performanceResult.data.assignments.canceled}
              </DetailField>
              <DetailField label="Điểm đánh giá">
                {performanceResult.data.trusted_rating.average.toFixed(2)}
              </DetailField>
              <DetailField label="Số đánh giá">
                {performanceResult.data.trusted_rating.count}
              </DetailField>
            </div>
          )}
        </Panel>

        <Panel title="Lịch sử công việc">
          {!historyResult.ok ? (
            <ErrorState
              title="Không tải được lịch sử công việc"
              message={historyResult.error.message}
            />
          ) : (
            <>
              <DataTable<AdminMechanicWorkHistory>
                caption="Lịch sử công việc của kỹ thuật viên"
                rows={historyResult.data.items}
                emptyLabel="Kỹ thuật viên chưa có phân công nào."
                columns={historyColumns}
                rowKey={(row) => row.assignment_id}
              />
              <CursorPagination
                page={historyResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
                backHref="/admin/mechanics"
              />
            </>
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}

const historyColumns: AdminTableColumn<AdminMechanicWorkHistory>[] = [
  {
    key: "assignment_id",
    header: "Phân công",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#162130" }}>
        {row.assignment_id}
      </span>
    )
  },
  {
    key: "request_id",
    header: "Yêu cầu",
    render: (row) => (
      <a
        href={`/admin/service-requests/${row.request_id}`}
        className="font-mono text-xs underline-offset-2 hover:underline"
        style={{ color: "#3d6dcc" }}
      >
        {row.request_id}
      </a>
    )
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => <StatusBadge status={row.status} />
  },
  {
    key: "accepted_at",
    header: "Nhận việc",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.accepted_at)}
      </span>
    )
  },
  {
    key: "completed_at",
    header: "Hoàn thành",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.completed_at ? formatDateTime(row.completed_at) : "—"}
      </span>
    )
  }
];
