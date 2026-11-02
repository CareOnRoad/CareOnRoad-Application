import { fetchAdminUsers } from "@/lib/api/admin";
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

import type { AdminUserSummary } from "@careonroad/api-contract/admin/users";

/**
 * /admin/users — the "Người dùng" tab.
 *
 * Every row comes from `GET /api/v1/admin/users`. The filters live in the
 * URL, so a filtered view can be bookmarked and the cursor pagination keeps
 * the filters intact.
 *
 * A failed request renders an error panel, never an empty table: "no users"
 * and "could not load users" must not look the same.
 */
export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;

  const query = readParam(params, "query");
  const role = readParam(params, "role");
  const status = readParam(params, "status");
  const cursor = readParam(params, "cursor");
  const limit = Number(readParam(params, "limit") ?? "") || undefined;

  const result = await settle(
    fetchAdminUsers(session, {
      query,
      role,
      status,
      cursor,
      limit
    })
  );

  const flatParams = flattenSearchParams(params);

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Người dùng"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Người dùng"
          description="Tài khoản, vai trò, gói dịch vụ và thiết bị đã đăng ký."
          endpoint="GET /api/v1/admin/users"
        />

        <Panel title="Bộ lọc">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <FilterField label="Tìm kiếm" name="query" defaultValue={query} placeholder="Tên, email, số điện thoại" />
            <FilterField label="Vai trò" name="role" defaultValue={role}>
              <select
                name="role"
                defaultValue={role ?? ""}
                className="rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid #e5e9ef", backgroundColor: "#fff", color: "#162130" }}
              >
                <option value="">Tất cả</option>
                <option value="rider">Rider</option>
                <option value="mechanic">Kỹ thuật viên</option>
                <option value="admin">Quản trị</option>
              </select>
            </FilterField>
            <FilterField label="Trạng thái" name="status" defaultValue={status}>
              <select
                name="status"
                defaultValue={status ?? ""}
                className="rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid #e5e9ef", backgroundColor: "#fff", color: "#162130" }}
              >
                <option value="">Tất cả</option>
                <option value="active">Hoạt động</option>
                <option value="suspended">Đình chỉ</option>
                <option value="archived">Lưu trữ</option>
              </select>
            </FilterField>
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: "#162130" }}
            >
              Áp dụng
            </button>
          </form>
        </Panel>

        {!result.ok ? (
          <ErrorState
            title="Không tải được danh sách người dùng"
            message={result.error.message}
          />
        ) : (
          <Panel>
            <DataTable<AdminUserSummary>
              caption="Danh sách người dùng"
              rows={result.data.items}
              emptyLabel="Không có người dùng nào khớp bộ lọc."
              columns={columns}
              rowKey={(row) => row.id}
            />
            <CursorPagination
              page={result.data.page}
              buildHref={(next) => buildCursorHref(flatParams, next)}
            />
          </Panel>
        )}
      </div>
    </AdminLayout>
  );
}

const columns: AdminTableColumn<AdminUserSummary>[] = [
  {
    key: "display_name",
    header: "Người dùng",
    render: (row) => (
      <a
        href={`/admin/users/${row.id}`}
        className="font-semibold underline-offset-2 hover:underline"
        style={{ color: "#3d6dcc" }}
      >
        {row.display_name?.trim() || row.id}
      </a>
    )
  },
  {
    key: "phone",
    header: "Số điện thoại",
    render: (row) => (
      <span style={{ color: "#3d4d63" }}>{row.phone_masked || "—"}</span>
    )
  },
  {
    key: "roles",
    header: "Vai trò",
    render: (row) => (
      <span className="flex flex-wrap gap-1">
        {row.roles.map((role) => (
          <StatusBadge key={role} status={role} tone="info" label={role} />
        ))}
      </span>
    )
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => <StatusBadge status={row.status} />
  },
  {
    key: "plan",
    header: "Gói",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.plan_code}
        {row.plan_expires_at
          ? ` · hết hạn ${formatDateTime(row.plan_expires_at)}`
          : ""}
      </span>
    )
  },
  {
    key: "devices",
    header: "Thiết bị",
    render: (row) => (
      <BooleanBadge
        value={row.device_summary.enabled > 0}
        trueLabel={`${row.device_summary.enabled}/${row.device_summary.total} bật`}
        falseLabel="0 bật"
        trueTone="info"
      />
    )
  },
  {
    key: "created_at",
    header: "Ngày tạo",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.created_at)}
      </span>
    )
  }
];

function FilterField({
  label,
  name,
  defaultValue,
  placeholder,
  children
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "#3d4d63" }}
      >
        {label}
      </span>
      {children ?? (
        <input
          type="text"
          name={name}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            border: "1px solid #e5e9ef",
            backgroundColor: "#fff",
            color: "#162130"
          }}
        />
      )}
    </label>
  );
}
