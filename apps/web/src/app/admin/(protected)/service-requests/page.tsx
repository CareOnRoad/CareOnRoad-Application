import { fetchAdminServiceRequests } from "@/lib/api/admin";
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
import { StatusBadge } from "@/components/admin/status-badge";

import type { AdminRequestSummary } from "@careonroad/api-contract/admin/service-requests";

/**
 * /admin/service-requests — the "Yêu cầu cứu hộ" tab.
 *
 * Reads `GET /api/v1/admin/service-requests`. The backend filter for the
 * human-readable code is `request_code` (NOT `query`).
 */
export default async function AdminServiceRequestsPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;

  const status = readParam(params, "status");
  const serviceType = readParam(params, "service_type");
  const priority = readParam(params, "priority");
  const requestCode = readParam(params, "request_code");
  const mechanicId = readParam(params, "mechanic_id");
  const cursor = readParam(params, "cursor");
  const limit = Number(readParam(params, "limit") ?? "") || undefined;

  const result = await settle(
    fetchAdminServiceRequests(session, {
      status,
      service_type: serviceType,
      priority,
      request_code: requestCode,
      mechanic_id: mechanicId,
      cursor,
      limit
    })
  );

  const flatParams = flattenSearchParams(params);

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Yêu cầu cứu hộ"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Yêu cầu cứu hộ"
          description="Giám sát toàn bộ yêu cầu từ lúc gửi đến khi hoàn thành hoặc huỷ."
          endpoint="GET /api/v1/admin/service-requests"
        />

        <Panel title="Bộ lọc">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <SelectField label="Trạng thái" name="status" defaultValue={status}>
              <option value="">Tất cả</option>
              <option value="submitted">Đã gửi</option>
              <option value="dispatching">Đang điều phối</option>
              <option value="offered">Đã gửi đề nghị</option>
              <option value="assigned">Đã phân công</option>
              <option value="mechanic_en_route">Kỹ thuật viên đang đến</option>
              <option value="in_service">Đang sửa</option>
              <option value="awaiting_quote_approval">Chờ duyệt báo giá</option>
              <option value="awaiting_payment">Chờ thanh toán</option>
              <option value="completed">Hoàn thành</option>
              <option value="manual_escalation">Cần can thiệp</option>
              <option value="canceled">Đã huỷ</option>
            </SelectField>
            <SelectField label="Loại dịch vụ" name="service_type" defaultValue={serviceType}>
              <option value="">Tất cả</option>
              <option value="emergency_rescue">Cứu hộ khẩn cấp</option>
              <option value="periodic_maintenance">Bảo dưỡng định kỳ</option>
              <option value="standard">Tiêu chuẩn</option>
            </SelectField>
            <SelectField label="Mức ưu tiên" name="priority" defaultValue={priority}>
              <option value="">Tất cả</option>
              <option value="normal">Thường</option>
              <option value="high">Cao</option>
              <option value="emergency">Khẩn cấp</option>
            </SelectField>
            <TextField label="Mã yêu cầu" name="request_code" defaultValue={requestCode} placeholder="COR-..." />
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
            title="Không tải được danh sách yêu cầu"
            message={result.error.message}
          />
        ) : (
          <Panel>
            <DataTable<AdminRequestSummary>
              caption="Danh sách yêu cầu cứu hộ"
              rows={result.data.items}
              emptyLabel="Không có yêu cầu nào khớp bộ lọc."
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

const columns: AdminTableColumn<AdminRequestSummary>[] = [
  {
    key: "request_code",
    header: "Mã yêu cầu",
    render: (row) => (
      <a
        href={`/admin/service-requests/${row.id}`}
        className="font-semibold underline-offset-2 hover:underline"
        style={{ color: "#3d6dcc" }}
      >
        {row.request_code}
      </a>
    )
  },
  {
    key: "service_type",
    header: "Dịch vụ",
    render: (row) => (
      <StatusBadge status={row.service_type} tone="info" label={row.service_type} />
    )
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => <StatusBadge status={row.status} />
  },
  {
    key: "priority",
    header: "Ưu tiên",
    render: (row) => (
      <StatusBadge
        status={row.priority}
        tone={row.priority === "emergency" ? "danger" : row.priority === "high" ? "warning" : "neutral"}
        label={row.priority}
      />
    )
  },
  {
    key: "fulfillment_mode",
    header: "Cách thực hiện",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.fulfillment_mode ?? "—"}
      </span>
    )
  },
  {
    key: "mechanic_id",
    header: "Kỹ thuật viên",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#3d4d63" }}>
        {row.mechanic_id ?? "—"}
      </span>
    )
  },
  {
    key: "created_at",
    header: "Thời điểm tạo",
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
  defaultValue,
  placeholder
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
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
        placeholder={placeholder}
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
