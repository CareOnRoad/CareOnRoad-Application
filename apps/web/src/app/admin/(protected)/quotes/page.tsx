import {
  fetchAdminServiceRequestQuoteHistory
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
  formatVnd,
  type AdminTableColumn
} from "@/components/admin/data-table";
import { ErrorState, PageHeader, Panel } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import type { AdminQuote } from "@careonroad/api-contract/admin/quotes";

/**
 * /admin/quotes — the "Báo giá" tab.
 *
 * The backend exposes quotes only through two routes: the supervision list
 * per request (`/service-requests/{id}/quotes/history`) and the single quote
 * detail (`/quotes/{quoteId}`). There is NO global quote list endpoint, so
 * this tab is driven by the REQUEST CODE: the admin enters a request code
 * and the page resolves the request's quote history.
 *
 * The tab therefore never invents a global list the API cannot produce.
 */
export default async function AdminQuotesPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;

  const requestCode = readParam(params, "request_code");
  const cursor = readParam(params, "cursor");
  const flatParams = flattenSearchParams(params);

  // The quote history is served per request, so a request id is required.
  // The admin supplies it through the `request_id` parameter.
  const requestId = readParam(params, "request_id");

  const historyResult = requestId
    ? await settle(
        fetchAdminServiceRequestQuoteHistory(session, requestId, {
          cursor,
          limit: 20
        })
      )
    : null;

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Báo giá"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Báo giá"
          description="Backend chỉ phục vụ báo giá theo từng yêu cầu. Nhập mã yêu cầu để xem lịch sử báo giá của yêu cầu đó."
          endpoint="GET /api/v1/admin/service-requests/{id}/quotes/history"
        />

        <Panel title="Tra cứu">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <label className="flex flex-col gap-1">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "#3d4d63" }}
              >
                Mã yêu cầu
              </span>
              <input
                type="text"
                name="request_code"
                defaultValue={requestCode ?? ""}
                placeholder="COR-..."
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
                Mã yêu cầu (UUID)
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
              Xem lịch sử
            </button>
          </form>
          <p className="text-[11px]" style={{ color: "#6b7a8d" }}>
            Mã yêu cầu (UUID) lấy từ trang chi tiết yêu cầu cứu hộ. Mã dạng
            COR-… chỉ dùng để tra cứu nhanh trong danh sách yêu cầu.
          </p>
        </Panel>

        {!requestId ? (
          <Panel title="Lịch sử báo giá">
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              Nhập mã yêu cầu (UUID) ở trên để xem lịch sử báo giá.
            </p>
          </Panel>
        ) : !historyResult ? null : !historyResult.ok ? (
          <ErrorState
            title="Không tải được lịch sử báo giá"
            message={historyResult.error.message}
          />
        ) : (
          <Panel title="Lịch sử báo giá">
            <DataTable<AdminQuote>
              caption="Lịch sử báo giá"
              rows={historyResult.data.items}
              emptyLabel="Yêu cầu chưa có báo giá nào."
              columns={columns}
              rowKey={(row) => row.id}
            />
            <CursorPagination
              page={historyResult.data.page}
              buildHref={(next) => buildCursorHref(flatParams, next)}
            />
          </Panel>
        )}
      </div>
    </AdminLayout>
  );
}

const columns: AdminTableColumn<AdminQuote>[] = [
  {
    key: "id",
    header: "Mã báo giá",
    render: (row) => (
      <a
        href={`/admin/quotes/${row.id}`}
        className="font-mono text-xs underline-offset-2 hover:underline"
        style={{ color: "#3d6dcc" }}
      >
        {row.id}
      </a>
    )
  },
  {
    key: "purpose",
    header: "Mục đích",
    render: (row) => (
      <StatusBadge status={row.purpose} tone="info" label={row.purpose} />
    )
  },
  {
    key: "version",
    header: "Phiên bản",
    render: (row) => (
      <span className="text-xs" style={{ color: "#162130" }}>
        v{row.version}
      </span>
    )
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => <StatusBadge status={row.status} />
  },
  {
    key: "total_amount",
    header: "Tổng tiền",
    render: (row) => (
      <span className="text-xs font-semibold" style={{ color: "#162130" }}>
        {formatVnd(row.total_amount)}
      </span>
    )
  },
  {
    key: "line_count",
    header: "Số dòng",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.line_count}
      </span>
    )
  },
  {
    key: "expires_at",
    header: "Hết hạn",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.expires_at ? formatDateTime(row.expires_at) : "—"}
      </span>
    )
  },
  {
    key: "created_at",
    header: "Tạo lúc",
    render: (row) => (
      <span className="text-xs" style={{ color: "#6b7a8d" }}>
        {formatDateTime(row.created_at)}
      </span>
    )
  }
];
