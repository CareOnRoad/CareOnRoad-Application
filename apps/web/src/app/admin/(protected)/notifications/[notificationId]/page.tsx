import { fetchAdminNotification } from "@/lib/api/admin";
import { getAdminSession, settleOrNotFound } from "@/lib/admin/session";

import { z } from "zod";

import { AdminLayout } from "@/components/admin/admin-layout";
import {
  DataTable,
  formatDateTime,
  type AdminTableColumn
} from "@/components/admin/data-table";
import { ErrorState, PageHeader, Panel } from "@/components/admin/page-header";
import {
  BooleanBadge,
  DetailField,
  StatusBadge
} from "@/components/admin/status-badge";

import { NotificationCommandForms } from "@/app/admin/(protected)/delivery/delivery-command-forms";

import type { adminNotificationDeliveryReceiptSchema } from "@careonroad/api-contract/admin/delivery";

type AdminNotificationDeliveryReceipt = z.infer<
  typeof adminNotificationDeliveryReceiptSchema
>;

/**
 * /admin/notifications/[notificationId] — the detail screen of a notification.
 *
 * Reads `GET /api/v1/admin/notifications/{id}`, which returns the
 * notification plus its per-device delivery receipts.
 *
 * The retry / cancel buttons follow the backend's own rules: `retry` is only
 * legal for a FAILED notification, `cancel` only while a delivery is still
 * pending.
 */
export default async function AdminNotificationDetailPage({
  params
}: {
  params: Promise<{ notificationId: string }>;
}) {
  const { notificationId } = await params;
  const { actor, session } = await getAdminSession();

  const result = await settleOrNotFound(
    fetchAdminNotification(session, notificationId)
  );

  if (!result.ok) {
    return (
      <AdminLayout
        crumb={["CareOnRoad", "Điều hành", "Thông báo"]}
        userName={actor.display_name?.trim() || "Quản trị viên"}
      >
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Thông báo"
            endpoint={`GET /api/v1/admin/notifications/${notificationId}`}
            backHref="/admin/notifications"
          />
          <ErrorState
            title="Không tải được thông báo"
            message={result.error.message}
          />
        </div>
      </AdminLayout>
    );
  }

  const notification = result.data;

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Thông báo", notification.id]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Chi tiết thông báo"
          description={`Loại: ${notification.type}`}
          endpoint={`GET /api/v1/admin/notifications/${notificationId}`}
          backHref="/admin/notifications"
        />

        <Panel title="Thông tin thông báo">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <DetailField label="Trạng thái">
              <StatusBadge status={notification.status} />
            </DetailField>
            <DetailField label="Đã đọc">
              <BooleanBadge value={notification.is_read} />
            </DetailField>
            <DetailField label="Người nhận">
              <span className="font-mono text-xs">{notification.user_id}</span>
            </DetailField>
            <DetailField label="Số lần thử lại">
              {notification.admin_retry_count}
            </DetailField>
            <DetailField label="Tạo lúc">
              {formatDateTime(notification.created_at)}
            </DetailField>
            <DetailField label="Đã gửi lúc">
              {notification.sent_at
                ? formatDateTime(notification.sent_at)
                : "—"}
            </DetailField>
            <DetailField label="Đã huỷ lúc">
              {notification.canceled_at
                ? formatDateTime(notification.canceled_at)
                : "—"}
            </DetailField>
            <DetailField label="Mã lỗi">
              <span className="font-mono text-xs" style={{ color: "#b3131d" }}>
                {notification.error_code ?? "—"}
              </span>
            </DetailField>
          </div>
        </Panel>

        <Panel title="Thao tác giao hàng">
          <NotificationCommandForms
            notificationId={notification.id}
            status={notification.status}
          />
        </Panel>

        <Panel
          title="Lượt giao theo thiết bị"
          description="GET /api/v1/admin/notifications/{id} → delivery_receipts"
        >
          {notification.delivery_receipts.items.length === 0 ? (
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              Thông báo chưa có lượt giao nào.
            </p>
          ) : (
            <DataTable<AdminNotificationDeliveryReceipt>
              caption="Lượt giao theo thiết bị"
              rows={notification.delivery_receipts.items}
              emptyLabel="Thông báo chưa có lượt giao nào."
              columns={receiptColumns}
              rowKey={(row) => row.id}
            />
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}

const receiptColumns: AdminTableColumn<AdminNotificationDeliveryReceipt>[] = [
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => <StatusBadge status={row.status} />
  },
  {
    key: "provider",
    header: "Nhà cung cấp",
    render: (row) => (
      <span className="text-xs" style={{ color: "#162130" }}>
        {row.provider}
      </span>
    )
  },
  {
    key: "attempt_count",
    header: "Số lần thử",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.attempt_count}
      </span>
    )
  },
  {
    key: "active_lease",
    header: "Đang khoá",
    render: (row) => <BooleanBadge value={row.active_lease} />
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
  },
  {
    key: "next_attempt_at",
    header: "Lần thử kế",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.next_attempt_at ? formatDateTime(row.next_attempt_at) : "—"}
      </span>
    )
  }
];
