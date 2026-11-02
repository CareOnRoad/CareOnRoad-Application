import { fetchAdminMechanics } from "@/lib/api/admin";
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

import type { AdminMechanicSummary } from "@careonroad/api-contract/admin/mechanics";

/**
 * /admin/mechanics — the "Kỹ thuật viên" tab.
 *
 * Reads `GET /api/v1/admin/mechanics`. The backend filter is
 * `service_type` (NOT `skill`), and the freshness/work-state filters mirror
 * the dispatch policy exactly.
 */
export default async function AdminMechanicsPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;

  const profileStatus = readParam(params, "profile_status");
  const serviceType = readParam(params, "service_type");
  const locationFreshness = readParam(params, "location_freshness");
  const workState = readParam(params, "work_state");
  const isAvailable = readParam(params, "is_available");
  const cursor = readParam(params, "cursor");
  const limit = Number(readParam(params, "limit") ?? "") || undefined;

  const result = await settle(
    fetchAdminMechanics(session, {
      profile_status: profileStatus,
      service_type: serviceType,
      location_freshness: locationFreshness,
      work_state: workState,
      is_available: isAvailable === "true" ? true : isAvailable === "false" ? false : undefined,
      cursor,
      limit
    })
  );

  const flatParams = flattenSearchParams(params);

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Kỹ thuật viên"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Kỹ thuật viên"
          description="Duyệt hồ sơ, cấu hình kỹ năng, bán kính phục vụ và theo dõi hiệu suất."
          endpoint="GET /api/v1/admin/mechanics"
        />

        <Panel title="Bộ lọc">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <SelectField label="Trạng thái hồ sơ" name="profile_status" defaultValue={profileStatus}>
              <option value="">Tất cả</option>
              <option value="pending">Chờ duyệt</option>
              <option value="active">Hoạt động</option>
              <option value="rejected">Từ chối</option>
              <option value="suspended">Đình chỉ</option>
              <option value="banned">Cấm</option>
            </SelectField>
            <SelectField label="Loại dịch vụ" name="service_type" defaultValue={serviceType}>
              <option value="">Tất cả</option>
              <option value="emergency_rescue">Cứu hộ khẩn cấp</option>
              <option value="periodic_maintenance">Bảo dưỡng định kỳ</option>
              <option value="standard">Tiêu chuẩn</option>
            </SelectField>
            <SelectField label="Độ mới vị trí" name="location_freshness" defaultValue={locationFreshness}>
              <option value="">Tất cả</option>
              <option value="fresh">Mới</option>
              <option value="stale">Cũ</option>
              <option value="missing">Thiếu</option>
            </SelectField>
            <SelectField label="Tình trạng việc" name="work_state" defaultValue={workState}>
              <option value="">Tất cả</option>
              <option value="idle">Rảnh</option>
              <option value="active_assignment">Đang có việc</option>
            </SelectField>
            <SelectField label="Sẵn sàng" name="is_available" defaultValue={isAvailable}>
              <option value="">Tất cả</option>
              <option value="true">Đang sẵn sàng</option>
              <option value="false">Không sẵn sàng</option>
            </SelectField>
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
            title="Không tải được danh sách kỹ thuật viên"
            message={result.error.message}
          />
        ) : (
          <Panel>
            <DataTable<AdminMechanicSummary>
              caption="Danh sách kỹ thuật viên"
              rows={result.data.items}
              emptyLabel="Không có kỹ thuật viên nào khớp bộ lọc."
              columns={columns}
              rowKey={(row) => row.user_id}
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

const columns: AdminTableColumn<AdminMechanicSummary>[] = [
  {
    key: "user_id",
    header: "Kỹ thuật viên",
    render: (row) => (
      <a
        href={`/admin/mechanics/${row.user_id}`}
        className="font-semibold underline-offset-2 hover:underline"
        style={{ color: "#3d6dcc" }}
      >
        {row.user_id}
      </a>
    )
  },
  {
    key: "profile_status",
    header: "Hồ sơ",
    render: (row) => <StatusBadge status={row.profile_status} />
  },
  {
    key: "is_available",
    header: "Sẵn sàng",
    render: (row) => <BooleanBadge value={row.is_available} />
  },
  {
    key: "work_state",
    header: "Tình trạng việc",
    render: (row) => (
      <StatusBadge
        status={row.work_state}
        tone={row.work_state === "active_assignment" ? "info" : "neutral"}
      />
    )
  },
  {
    key: "location_freshness",
    header: "Vị trí",
    render: (row) => <StatusBadge status={row.location_freshness} />
  },
  {
    key: "service_radius_km",
    header: "Bán kính",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.service_radius_km} km
      </span>
    )
  },
  {
    key: "service_types",
    header: "Dịch vụ",
    render: (row) => (
      <span className="flex flex-wrap gap-1">
        {row.service_types.map((type) => (
          <StatusBadge key={type} status={type} tone="info" label={type} />
        ))}
      </span>
    )
  },
  {
    key: "rating",
    header: "Đánh giá",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.rating_avg.toFixed(2)} ({row.rating_count})
      </span>
    )
  },
  {
    key: "availability_updated_at",
    header: "Cập nhật",
    render: (row) => (
      <span className="text-xs" style={{ color: "#6b7a8d" }}>
        {formatDateTime(row.availability_updated_at)}
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
