import { fetchAdminQuote } from "@/lib/api/admin";
import { getAdminSession, settleOrNotFound } from "@/lib/admin/session";
import { isPastDeadline } from "@/lib/admin/deadline";

import { AdminLayout } from "@/components/admin/admin-layout";
import {
  DataTable,
  formatDateTime,
  formatVnd,
  type AdminTableColumn
} from "@/components/admin/data-table";
import { ErrorState, PageHeader, Panel } from "@/components/admin/page-header";
import { DetailField, StatusBadge } from "@/components/admin/status-badge";

import { QuoteCommandForms } from "./quote-command-forms";

import type { AdminQuoteSupervisionAction } from "@careonroad/api-contract/admin/quotes";

/**
 * /admin/quotes/[quoteId] — the detail screen of the "Báo giá" tab.
 *
 * Reads `GET /api/v1/admin/quotes/{quoteId}`, which returns the quote plus
 * the admin supervision action log.
 */
export default async function AdminQuoteDetailPage({
  params
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const { actor, session } = await getAdminSession();

  const result = await settleOrNotFound(fetchAdminQuote(session, quoteId));

  if (!result.ok) {
    return (
      <AdminLayout
        crumb={["CareOnRoad", "Điều hành", "Báo giá"]}
        userName={actor.display_name?.trim() || "Quản trị viên"}
      >
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Báo giá"
            endpoint={`GET /api/v1/admin/quotes/${quoteId}`}
            backHref="/admin/quotes"
          />
          <ErrorState
            title="Không tải được báo giá"
            message={result.error.message}
          />
        </div>
      </AdminLayout>
    );
  }

  const quote = result.data;
  const isExpired = isPastDeadline(quote.expires_at);

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Báo giá", quote.id]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title={`Báo giá v${quote.version}`}
          description={`Mục đích: ${quote.purpose}`}
          endpoint={`GET /api/v1/admin/quotes/${quoteId}`}
          backHref="/admin/quotes"
        />

        <Panel title="Thông tin báo giá">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <DetailField label="Trạng thái">
              <StatusBadge status={quote.status} />
            </DetailField>
            <DetailField label="Tổng tiền">
              {formatVnd(quote.total_amount)}
            </DetailField>
            <DetailField label="Số dòng">{quote.line_count}</DetailField>
            <DetailField label="Tiền tệ">{quote.currency}</DetailField>
            <DetailField label="Yêu cầu">
              <a
                href={`/admin/service-requests/${quote.request_id}`}
                className="font-mono text-xs underline-offset-2 hover:underline"
                style={{ color: "#3d6dcc" }}
              >
                {quote.request_id}
              </a>
            </DetailField>
            <DetailField label="Phân công">
              <span className="font-mono text-xs">{quote.assignment_id}</span>
            </DetailField>
            <DetailField label="Hết hạn">
              {quote.expires_at ? formatDateTime(quote.expires_at) : "—"}
            </DetailField>
            <DetailField label="Đã trả lời">
              {quote.responded_at ? formatDateTime(quote.responded_at) : "—"}
            </DetailField>
          </div>
        </Panel>

        <Panel title="Xử lý báo giá">
          <QuoteCommandForms
            quoteId={quote.id}
            status={quote.status}
            isExpired={isExpired}
          />
        </Panel>

        <Panel
          title="Nhật ký giám sát"
          description="GET /api/v1/admin/quotes/{id} → supervision"
        >
          {quote.supervision.items.length === 0 ? (
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              Chưa có hành động giám sát nào trên báo giá này.
            </p>
          ) : (
            <DataTable<AdminQuoteSupervisionAction>
              caption="Nhật ký giám sát báo giá"
              rows={quote.supervision.items}
              emptyLabel="Chưa có hành động giám sát nào."
              columns={supervisionColumns}
              rowKey={(row) => row.id}
            />
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}

const supervisionColumns: AdminTableColumn<AdminQuoteSupervisionAction>[] = [
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
    key: "admin_id",
    header: "Quản trị viên",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#6b7a8d" }}>
        {row.admin_id}
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
