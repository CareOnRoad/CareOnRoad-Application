import { fetchAdminOutboxEvent } from "@/lib/api/admin";
import { getAdminSession, settleOrNotFound } from "@/lib/admin/session";

import { AdminLayout } from "@/components/admin/admin-layout";
import { formatDateTime } from "@/components/admin/data-table";
import { ErrorState, PageHeader, Panel } from "@/components/admin/page-header";
import {
  BooleanBadge,
  DetailField,
  StatusBadge
} from "@/components/admin/status-badge";

import { OutboxEventCommandForms } from "@/app/admin/(protected)/delivery/delivery-command-forms";

/**
 * /admin/outbox/[eventId] — the detail screen of an outbox event.
 *
 * Reads `GET /api/v1/admin/outbox/{id}`.
 *
 * The retry / abandon buttons are driven by the BACKEND's
 * `next_action_codes`: the service refuses `retry` while a worker lease is
 * active and for topics that are not safe to replay, and refuses `abandon`
 * for critical handoff topics.
 */
export default async function AdminOutboxEventDetailPage({
  params
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { actor, session } = await getAdminSession();

  const result = await settleOrNotFound(fetchAdminOutboxEvent(session, eventId));

  if (!result.ok) {
    return (
      <AdminLayout
        crumb={["CareOnRoad", "Điều hành", "Outbox"]}
        userName={actor.display_name?.trim() || "Quản trị viên"}
      >
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Sự kiện outbox"
            endpoint={`GET /api/v1/admin/outbox/${eventId}`}
            backHref="/admin/outbox"
          />
          <ErrorState
            title="Không tải được sự kiện outbox"
            message={result.error.message}
          />
        </div>
      </AdminLayout>
    );
  }

  const event = result.data;

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Outbox", event.id]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Chi tiết sự kiện outbox"
          description={`Chủ đề: ${event.topic}`}
          endpoint={`GET /api/v1/admin/outbox/${eventId}`}
          backHref="/admin/outbox"
        />

        <Panel title="Thông tin sự kiện">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <DetailField label="Trạng thái">
              <StatusBadge status={event.status} />
            </DetailField>
            <DetailField label="Chủ đề">
              <span className="font-mono text-xs">{event.topic}</span>
            </DetailField>
            <DetailField label="Loại đối tượng">
              <span className="text-xs">{event.aggregate_type}</span>
            </DetailField>
            <DetailField label="Mã đối tượng">
              <span className="font-mono text-xs">{event.aggregate_id}</span>
            </DetailField>
            <DetailField label="Số lần thử">
              {event.attempt_count}
            </DetailField>
            <DetailField label="Số lần thử của quản trị">
              {event.admin_retry_count}
            </DetailField>
            <DetailField label="Đang khoá">
              <BooleanBadge value={event.active_lease} />
            </DetailField>
            <DetailField label="Mã lỗi">
              <span className="font-mono text-xs" style={{ color: "#b3131d" }}>
                {event.error_code ?? "—"}
              </span>
            </DetailField>
            <DetailField label="Tạo lúc">
              {formatDateTime(event.created_at)}
            </DetailField>
            <DetailField label="Lần thử kế">
              {formatDateTime(event.next_attempt_at)}
            </DetailField>
            <DetailField label="Đã xử lý lúc">
              {event.processed_at ? formatDateTime(event.processed_at) : "—"}
            </DetailField>
            <DetailField label="Đã bỏ lúc">
              {event.abandoned_at ? formatDateTime(event.abandoned_at) : "—"}
            </DetailField>
          </div>

          <div className="flex flex-col gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "#3d4d63" }}
            >
              Hành động được phép
            </span>
            <span className="flex flex-wrap gap-1">
              {event.next_action_codes.length === 0 ? (
                <span className="text-xs" style={{ color: "#6b7a8d" }}>
                  Không có hành động nào khả dụng.
                </span>
              ) : (
                event.next_action_codes.map((code) => (
                  <StatusBadge key={code} status={code} tone="info" label={code} />
                ))
              )}
            </span>
          </div>
        </Panel>

        <Panel title="Thao tác quản trị">
          <OutboxEventCommandForms
            eventId={event.id}
            nextActionCodes={event.next_action_codes}
          />
        </Panel>
      </div>
    </AdminLayout>
  );
}
