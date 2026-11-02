import Link from "next/link";

import { fetchOperationalQueue } from "@/lib/api/admin";
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

import { PaymentReviewResolver } from "./payment-review-resolver";

/**
 * /admin/payments — the "Thanh toán" tab.
 *
 * The backend exposes exactly ONE administrative payment route:
 * `POST /api/v1/admin/payments/orders/[paymentOrderId]/resolve`. There is no
 * admin list endpoint for payment orders, so the tab reads the orders that
 * need review from the operational monitoring queue
 * (`GET /api/v1/admin/operations/payments-needs-review`) and lets the admin
 * resolve one of them, or paste any order id to resolve it directly.
 *
 * The resolution is the only admin command that touches real money, so the
 * form requires an explicit two-step confirmation (see
 * `PaymentReviewResolver`).
 */
export default async function AdminPaymentsPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;

  const cursor = readParam(params, "cursor");
  const selectedOrderId = readParam(params, "order");
  const flatParams = flattenSearchParams(params);

  const needsReview = await settle(
    fetchOperationalQueue(session, "payments-needs-review", { cursor, limit: 20 })
  );

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Thanh toán"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Thanh toán"
          description="Đối soát các đơn thanh toán đang ở trạng thái cần soát xét."
          endpoint="GET /api/v1/admin/operations/payments-needs-review"
        />

        <Panel
          title="Đơn cần soát xét"
          description="Chỉ các đơn ở trạng thái needs_review mới được xử lý."
        >
          {!needsReview.ok ? (
            <ErrorState
              title="Không tải được danh sách đơn cần soát xét"
              message={needsReview.error.message}
            />
          ) : (
            <>
              <DataTable<Record<string, unknown>>
                caption="Đơn thanh toán cần soát xét"
                rows={needsReview.data.items}
                emptyLabel="Không có đơn nào cần soát xét."
                columns={columns}
                rowKey={(row, index) => String(row.id ?? `row-${index}`)}
              />
              <CursorPagination
                page={needsReview.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
              />
            </>
          )}
        </Panel>

        <Panel
          title="Xử lý một đơn thanh toán"
          description="POST /api/v1/admin/payments/orders/[paymentOrderId]/resolve"
        >
          <PaymentLookup initialOrderId={selectedOrderId} />
        </Panel>
      </div>
    </AdminLayout>
  );
}

const columns: AdminTableColumn<Record<string, unknown>>[] = [
  {
    key: "request_code",
    header: "Mã yêu cầu",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#162130" }}>
        {typeof row.request_code === "string" ? row.request_code : "—"}
      </span>
    )
  },
  {
    key: "id",
    header: "Mã đơn",
    render: (row) => (
      <span className="font-mono text-[11px]" style={{ color: "#3d4d63" }}>
        {typeof row.id === "string" ? row.id : "—"}
      </span>
    )
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => (
      <StatusBadge
        status="needs_review"
        tone="warning"
        label={typeof row.status === "string" ? row.status : "needs_review"}
      />
    )
  },
  {
    key: "updated_at",
    header: "Cập nhật",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(
          typeof row.updated_at === "string" ? row.updated_at : undefined
        )}
      </span>
    )
  },
  {
    key: "actions",
    header: "",
    render: (row) => {
      const id = typeof row.id === "string" ? row.id : "";
      if (!id) {
        return <span style={{ color: "#6b7a8d" }}>—</span>;
      }
      return (
        <Link
          href={`/admin/payments?order=${encodeURIComponent(id)}`}
          className="text-xs font-semibold underline-offset-2 hover:underline"
          style={{ color: "#3d6dcc" }}
        >
          Xử lý →
        </Link>
      );
    }
  }
];

/**
 * The order lookup + resolver.
 *
 * Kept as a client component so the confirmation phrase can be validated
 * before the Server Action is invoked.
 */
function PaymentLookup({ initialOrderId }: { initialOrderId?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <LookupForm initialOrderId={initialOrderId} />
      {initialOrderId ? (
        <PaymentReviewResolver paymentOrderId={initialOrderId} />
      ) : (
        <p className="text-sm" style={{ color: "#3d4d63" }}>
          Chọn một đơn trong bảng trên, hoặc nhập mã đơn để xử lý.
        </p>
      )}
    </div>
  );
}

function LookupForm({ initialOrderId }: { initialOrderId?: string }) {
  return (
    <form className="flex flex-wrap items-end gap-3" method="get">
      <label className="flex flex-col gap-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "#3d4d63" }}
        >
          Mã đơn thanh toán
        </span>
        <input
          type="text"
          name="order"
          defaultValue={initialOrderId ?? ""}
          placeholder="UUID của payment order"
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
        Mở đơn
      </button>
    </form>
  );
}
