import {
  fetchAdminUser,
  fetchAdminUserActivity,
  fetchAdminUserDevices
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
import { CursorPagination, DataTable, buildCursorHref, formatDateTime, type AdminTableColumn } from "@/components/admin/data-table";
import { ErrorState, PageHeader, Panel } from "@/components/admin/page-header";
import {
  BooleanBadge,
  DetailField,
  StatusBadge
} from "@/components/admin/status-badge";

import {
  archiveUserAction,
  changeUserPlanAction,
  grantUserRoleAction,
  reactivateUserAction,
  revokeDeviceAction,
  revokeUserRoleAction,
  suspendUserAction
} from "./actions";
import { UserDeviceForm } from "./user-device-form";
import { UserPlanForm } from "./user-plan-form";
import { UserRoleForm } from "./user-role-form";
import { UserStatusForm } from "./user-status-form";

import type { AdminUserActivity } from "@careonroad/api-contract/admin/users";

/**
 * /admin/users/[userId] — the detail screen of the "Người dùng" tab.
 *
 * Four backend reads feed this page:
 *  - `GET /api/v1/admin/users/{userId}`            → the profile
 *  - `GET /api/v1/admin/users/{userId}/devices`    → the registered devices
 *  - `GET /api/v1/admin/users/{userId}/activity`   → the audit trail
 *  - `GET /api/v1/admin/users/{userId}`            → the effective plan
 *
 * The write actions live in `actions.ts` and are rendered through the shared
 * `CommandForm`, which mints one idempotency key per form.
 */
export default async function AdminUserDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<AdminSearchParams>;
}) {
  const { userId } = await params;
  const query = await searchParams;
  const { actor, session } = await getAdminSession();

  const profileResult = await settleOrNotFound(fetchAdminUser(session, userId));

  if (!profileResult.ok) {
    return (
      <AdminLayout
        crumb={["CareOnRoad", "Điều hành", "Người dùng"]}
        userName={actor.display_name?.trim() || "Quản trị viên"}
      >
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Người dùng"
            endpoint={`GET /api/v1/admin/users/${userId}`}
            backHref="/admin/users"
          />
          <ErrorState
            title="Không tải được thông tin người dùng"
            message={profileResult.error.message}
          />
        </div>
      </AdminLayout>
    );
  }

  const profile = profileResult.data;
  const flatParams = flattenSearchParams(query);

  const [devicesResult, activityResult] = await Promise.all([
    settle(
      fetchAdminUserDevices(session, userId, {
        cursor: readParam(query, "device_cursor"),
        limit: 20
      })
    ),
    settle(
      fetchAdminUserActivity(session, userId, {
        cursor: readParam(query, "activity_cursor"),
        limit: 20
      })
    )
  ]);

  const canSuspend = profile.status === "active";
  const canReactivate = profile.status === "suspended";
  const canArchive = profile.status !== "archived";

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Người dùng", profile.display_name?.trim() || userId]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title={profile.display_name?.trim() || userId}
          description={`Mã người dùng: ${profile.id}`}
          endpoint={`GET /api/v1/admin/users/${userId}`}
          backHref="/admin/users"
        />

        <Panel title="Thông tin tài khoản">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <DetailField label="Trạng thái">
              <StatusBadge status={profile.status} />
            </DetailField>
            <DetailField label="Vai trò">
              {profile.roles.length ? (
                <span className="flex flex-wrap gap-1">
                  {profile.roles.map((role) => (
                    <StatusBadge key={role} status={role} tone="info" label={role} />
                  ))}
                </span>
              ) : (
                "—"
              )}
            </DetailField>
            <DetailField label="Số điện thoại">
              {profile.phone_masked || "—"}
            </DetailField>
            <DetailField label="Gói">
              {profile.plan_code}
              {profile.plan_expires_at
                ? ` · hết hạn ${formatDateTime(profile.plan_expires_at)}`
                : ""}
            </DetailField>
            <DetailField label="Ngày tạo">
              {formatDateTime(profile.created_at)}
            </DetailField>
            <DetailField label="Cập nhật lần cuối">
              {formatDateTime(profile.updated_at)}
            </DetailField>
            <DetailField label="Thiết bị">
              {profile.device_summary.enabled}/{profile.device_summary.total} đang bật
            </DetailField>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel title="Thay đổi trạng thái">
            <div className="flex flex-col gap-6">
              <UserStatusForm
                userId={userId}
                action={suspendUserAction}
                label="Đình chỉ tài khoản"
                description="Tài khoản bị đình chỉ không thể đăng nhập và không nhận thông báo."
                variant="danger"
                disabled={!canSuspend}
                disabledHint={
                  canSuspend
                    ? undefined
                    : "Chỉ đình chỉ được tài khoản đang hoạt động."
                }
              />
              <UserStatusForm
                userId={userId}
                action={reactivateUserAction}
                label="Kích hoạt lại"
                description="Trả tài khoản về trạng thái hoạt động."
                disabled={!canReactivate}
                disabledHint={
                  canReactivate
                    ? undefined
                    : "Chỉ kích hoạt lại được tài khoản đang bị đình chỉ."
                }
              />
              <UserStatusForm
                userId={userId}
                action={archiveUserAction}
                label="Lưu trữ tài khoản"
                description="Lưu trữ là thao tác không hoàn tác được trên giao diện này."
                variant="danger"
                disabled={!canArchive}
                disabledHint={
                  canArchive
                    ? undefined
                    : "Tài khoản đã ở trạng thái lưu trữ."
                }
              />
            </div>
          </Panel>

          <Panel title="Gói dịch vụ">
            <UserPlanForm
              userId={userId}
              currentPlan={profile.plan_code}
              action={changeUserPlanAction}
            />
          </Panel>
        </div>

        <Panel title="Vai trò">
          <UserRoleForm
            userId={userId}
            grantedRoles={profile.roles}
            grantAction={grantUserRoleAction}
            revokeAction={revokeUserRoleAction}
          />
        </Panel>

        <Panel title="Thiết bị đã đăng ký">
          {!devicesResult.ok ? (
            <ErrorState
              title="Không tải được danh sách thiết bị"
              message={devicesResult.error.message}
            />
          ) : devicesResult.data.items.length === 0 ? (
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              Người dùng chưa đăng ký thiết bị nào.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {devicesResult.data.items.map((device) => (
                <div
                  key={device.id}
                  className="flex flex-wrap items-start justify-between gap-4 rounded-xl p-4"
                  style={{ backgroundColor: "#f8fafc", border: "1px solid #e5e9ef" }}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: "#162130" }}>
                        {device.platform || "Không rõ nền tảng"}
                      </span>
                      <BooleanBadge value={device.enabled} />
                    </div>
                    <span className="text-xs" style={{ color: "#3d4d63" }}>
                      Vân tay: {device.device_key_fingerprint}
                    </span>
                    <span className="text-xs" style={{ color: "#6b7a8d" }}>
                      Đăng ký lần cuối: {formatDateTime(device.last_registered_at)}
                    </span>
                  </div>
                  <UserDeviceForm
                    deviceId={device.id}
                    deviceLabel={device.platform || "thiết bị này"}
                    enabled={device.enabled}
                    action={revokeDeviceAction}
                  />
                </div>
              ))}
              <CursorPagination
                page={devicesResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
                backHref="/admin/users"
              />
            </div>
          )}
        </Panel>

        <Panel title="Hoạt động gần đây">
          {!activityResult.ok ? (
            <ErrorState
              title="Không tải được nhật ký hoạt động"
              message={activityResult.error.message}
            />
          ) : (
            <>
              <DataTable<AdminUserActivity>
                caption="Nhật ký hoạt động của người dùng"
                rows={activityResult.data.items}
                emptyLabel="Chưa có hoạt động nào được ghi nhận."
                columns={activityColumns}
                rowKey={(row) => row.id}
              />
              <CursorPagination
                page={activityResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
                backHref="/admin/users"
              />
            </>
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}

const activityColumns: AdminTableColumn<AdminUserActivity>[] = [
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
    key: "entity",
    header: "Đối tượng",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.entity_type}
        {row.entity_id ? ` · ${row.entity_id}` : ""}
      </span>
    )
  },
  {
    key: "occurred_at",
    header: "Thời điểm",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.occurred_at)}
      </span>
    )
  }
];
