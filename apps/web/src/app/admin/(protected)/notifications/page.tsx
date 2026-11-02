import {
  fetchAdminNotificationDeliverySummary,
  fetchAdminNotifications
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
import { BooleanBadge, StatusBadge } from "@/components/admin/status-badge";

import type { AdminNotification } from "@careonroad/api-contract/admin/delivery";

/**
 * /admin/notifications — the "Thông báo" tab.
 *
 * Reads `GET /api/v1/admin/notifications` and the delivery summary.
 *
 * The summary counts are a HISTOGRAM keyed by status, so the key set is open
 * and every key is rendered as-is.
 */
export default async function AdminNotificationsPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;

  const status = readParam(params, "status");
  const userId = readParam(params, "user_id");
  const cursor = readParam(params, "cursor");
  const flatParams = flattenSearchParams(params);

  const [listResult, summaryResult] = await Promise.all([
    settle(
      fetchAdminNotifications(session, {
        status,
        user_id: userId,
        cursor,
        limit: 20
      })
    ),
    settle(fetchAdminNotificationDeliverySummary(session))
  ]);

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Thông báo"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Thông báo"
          description="Hộp thư thông báo của ứng dụng và trạng thái gửi theo từng thiết bị."
          endpoint="GET /api/v1/admin/notifications"
        />

        <Panel
          title="Tổng hợp giao hàng"
          description="GET /api/v1/admin/notifications/delivery-summary"
        >
          {!summaryResult.ok ? (
            <ErrorState
              title="Không tải được tổng hợp giao hàng"
              message={summaryResult.error.message}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {Object.entries(summaryResult.data.counts).map(([key, count]) => (
                  <span
                    key={key}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
                    style={{ backgroundColor: "#f3f5f8" }}
                  >
                    <StatusBadge status={key} label={key} />
                    <span className="font-semibold" style={{ color: "#162130" }}>
                      {count}
                    </span>
                  </span>
                ))}
              </div>
              <p className="text-[11px]" style={{ color: "#6b7a8d" }}>
                Khoảng thời gian: {summaryResult.data.from} → {summaryResult.data.to}
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Bộ lọc">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <SelectField label="Trạng thái" name="status" defaultValue={status}>
              <option value="">Tất cả</option>
              <option value="pending">Chờ gửi</option>
              <option value="sent">Đã gửi</option>
              <option value="failed">Lỗi</option>
              <option value="canceled">Đã huỷ</option>
              <option value="processing">Đang xử lý</option>
            </SelectField>
            <TextField label="Người dùng (UUID)" name="user_id" defaultValue={userId} />
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: "#162130" }}
            >
              Áp dụng
            </button>
          </form>
        </Panel>

        <Panel title="Danh sách thông báo">
          {!listResult.ok ? (
            <ErrorState
              title="Không tải được danh sách thông báo"
              message={listResult.error.message}
            />
          ) : (
            <>
              <DataTable<AdminNotification>
                caption="Danh sách thông báo"
                rows={listResult.data.items}
                emptyLabel="Không có thông báo nào khớp bộ lọc."
                columns={columns}
                rowKey={(row) => row.id}
              />
              <CursorPagination
                page={listResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
              />
            </>
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}

const columns: AdminTableColumn<AdminNotification>[] = [
  {
    key: "id",
    header: "Mã thông báo",
    render: (row) => (
      <a
        href={`/admin/notifications/${row.id}`}
        className="font-mono text-xs underline-offset-2 hover:underline"
        style={{ color: "#3d6dcc" }}
      >
        {row.id}
      </a>
    )
  },
  {
    key: "type",
    header: "Loại",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#162130" }}>
        {row.type}
      </span>
    )
  },
  {
    key: "user_id",
    header: "Người nhận",
    render: (row) => (
      <a
        href={`/admin/users/${row.user_id}`}
        className="font-mono text-xs underline-offset-2 hover:underline"
        style={{ color: "#3d6dcc" }}
      >
        {row.user_id}
      </a>
    )
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => <StatusBadge status={row.status} />
  },
  {
    key: "is_read",
    header: "Đã đọc",
    render: (row) => <BooleanBadge value={row.is_read} />
  },
  {
    key: "admin_retry_count",
    header: "Số lần thử lại",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.admin_retry_count}
      </span>
    )
  },
  {
    key: "error_code",
    header: "Mã lỗi",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#b3131d" }}>
        {row.error_code ?? "—"}
      </span>
    )
  },
  {
    key: "created_at",
    header: "Tạo lúc",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.created_at)}
      </span>
    )
  }
];

function SelectField({
  label,
  name,
  defaultValue,
  children
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "#3d4d63" }}
      >
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="rounded-lg px-3 py-2 text-sm"
        style={{
          border: "1px solid #e5e9ef",
          backgroundColor: "#fff",
          color: "#162130"
        }}
      >
        {children}
      </select>
    </label>
  );
}

function TextField({
  label,
  name,
  defaultValue
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "#3d4d63" }}
      >
        {label}
      </span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue ?? ""}
        className="rounded-lg px-3 py-2 text-sm"
        style={{
          border: "1px solid #e5e9ef",
          backgroundColor: "#fff",
          color: "#162130"
        }}
      />
    </label>
  );
}
