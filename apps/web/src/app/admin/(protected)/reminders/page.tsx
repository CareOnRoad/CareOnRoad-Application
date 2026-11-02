import {
  fetchAdminReminder,
  fetchAdminReminderOccurrences,
  fetchAdminReminderWorkerHealth
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
import { BooleanBadge, DetailField, StatusBadge } from "@/components/admin/status-badge";

import {
  ReminderCommandForms,
  ReminderOccurrenceRetryForm
} from "./reminder-command-forms";

import type {
  AdminReminderOccurrence,
  AdminReminderRule
} from "@careonroad/api-contract/admin/reminders";

/**
 * /admin/reminders — the "Nhắc hẹn" tab.
 *
 * The backend exposes the reminder RULES as a list, and the OCCURRENCES of
 * one rule. There is no global occurrence list, so the tab lists the rules
 * and shows the occurrences of the rule the admin selects.
 */
export default async function AdminRemindersPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;

  const reminderId = readParam(params, "reminder_id");
  const cursor = readParam(params, "cursor");
  const flatParams = flattenSearchParams(params);

  const [rulesResult, healthResult] = await Promise.all([
    settle(
      fetchAdminRemindersProxy(session, {
        cursor,
        limit: 20
      })
    ),
    settle(fetchAdminReminderWorkerHealth(session, { limit: 20 }))
  ]);

  const [ruleResult, occurrencesResult] = reminderId
    ? await Promise.all([
        settle(fetchAdminReminder(session, reminderId)),
        settle(
          fetchAdminReminderOccurrences(session, reminderId, {
            cursor: readParam(params, "occurrence_cursor"),
            limit: 20
          })
        )
      ])
    : [null, null];

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Nhắc hẹn"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Nhắc hẹn bảo dưỡng"
          description="Quy tắc nhắc hẹn của người dùng và các lần nhắc đã phát sinh."
          endpoint="GET /api/v1/admin/reminders"
        />

        <Panel title="Quy tắc nhắc hẹn">
          {!rulesResult.ok ? (
            <ErrorState
              title="Không tải được danh sách quy tắc"
              message={rulesResult.error.message}
            />
          ) : (
            <>
              <DataTable<AdminReminderRule>
                caption="Quy tắc nhắc hẹn"
                rows={rulesResult.data.items}
                emptyLabel="Không có quy tắc nhắc hẹn nào."
                columns={ruleColumns}
                rowKey={(row) => row.id}
              />
              <CursorPagination
                page={rulesResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
              />
            </>
          )}
        </Panel>

        {reminderId ? (
          <>
            <Panel title="Chi tiết quy tắc">
              {!ruleResult || !ruleResult.ok ? (
                <ErrorState
                  title="Không tải được chi tiết quy tắc"
                  message={
                    ruleResult && !ruleResult.ok
                      ? ruleResult.error.message
                      : "Không tải được dữ liệu."
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                  <DetailField label="Người dùng">
                    <span className="font-mono text-xs">{ruleResult.data.rider_id}</span>
                  </DetailField>
                  <DetailField label="Xe máy">
                    <span className="font-mono text-xs">
                      {ruleResult.data.motorcycle_id}
                    </span>
                  </DetailField>
                  <DetailField label="Đang bật">
                    <BooleanBadge value={ruleResult.data.enabled} />
                  </DetailField>
                  <DetailField label="Chu kỳ">
                    {ruleResult.data.interval_days} ngày
                  </DetailField>
                  <DetailField label="Đến hạn kế tiếp">
                    {formatDateTime(ruleResult.data.next_due_at)}
                  </DetailField>
                  <DetailField label="Số lần lỗi">
                    {ruleResult.data.failure_count}
                  </DetailField>
                  <DetailField label="Đang khoá">
                    <BooleanBadge value={ruleResult.data.active_lease} />
                  </DetailField>
                </div>
              )}
            </Panel>

            <Panel title="Thao tác quản trị">
              {ruleResult && ruleResult.ok ? (
                <ReminderCommandForms
                  reminderId={reminderId}
                  enabled={ruleResult.data.enabled}
                  nextDueAt={ruleResult.data.next_due_at}
                />
              ) : (
                <p className="text-sm" style={{ color: "#3d4d63" }}>
                  Không tải được quy tắc nên không thể hiển thị thao tác.
                </p>
              )}
            </Panel>

            <Panel title="Các lần nhắc">
              {!occurrencesResult || !occurrencesResult.ok ? (
                <ErrorState
                  title="Không tải được danh sách lần nhắc"
                  message={
                    occurrencesResult && !occurrencesResult.ok
                      ? occurrencesResult.error.message
                      : "Không tải được dữ liệu."
                  }
                />
              ) : (
                <>
                  <DataTable<AdminReminderOccurrence>
                    caption="Các lần nhắc của quy tắc"
                    rows={occurrencesResult.data.items}
                    emptyLabel="Quy tắc chưa phát sinh lần nhắc nào."
                    columns={occurrenceColumns}
                    rowKey={(row) => row.id}
                  />
                  <CursorPagination
                    page={occurrencesResult.data.page}
                    buildHref={(next) => buildCursorHref(flatParams, next)}
                  />
                </>
              )}
            </Panel>

            {(
              occurrencesResult && occurrencesResult.ok
                ? occurrencesResult.data.items.filter(
                    (occurrence) => occurrence.status === "failed"
                  )
                : []
            ).map((occurrence) => (
              <Panel
                key={occurrence.id}
                title={`Thử lại lần nhắc ${occurrence.id}`}
                description="Lần nhắc ở trạng thái lỗi có thể đưa lại vào hàng đợi xử lý."
              >
                <ReminderOccurrenceRetryForm
                  occurrenceId={occurrence.id}
                  status={occurrence.status}
                />
              </Panel>
            ))}
          </>
        ) : null}        <Panel
          title="Sức khoẻ worker nhắc hẹn"
          description="GET /api/v1/admin/reminders/worker-health"
        >
          {!healthResult.ok ? (
            <ErrorState
              title="Không tải được sức khoẻ worker"
              message={healthResult.error.message}
            />
          ) : healthResult.data.items.length === 0 ? (
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              Chưa có lần chạy worker nào được ghi nhận.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {healthResult.data.items.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs"
                  style={{ backgroundColor: "#f8fafc" }}
                >
                  <StatusBadge status={run.status} />
                  <span style={{ color: "#162130" }}>
                    Đã lấy {run.items_claimed} · thành công {run.items_succeeded} · lỗi{" "}
                    {run.items_failed}
                  </span>
                  <span style={{ color: "#6b7a8d" }}>
                    {formatDateTime(run.completed_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}

/**
 * A thin wrapper so the page reads the list through one import.
 *
 * The reminder list wrapper lives in `@/lib/api/admin`; re-exporting it here
 * keeps the page's import block short without hiding the endpoint.
 */
async function fetchAdminRemindersProxy(
  session: { accessToken: string },
  query: { cursor?: string; limit?: number }
) {
  const { fetchAdminReminders } = await import("@/lib/api/admin");
  return fetchAdminReminders(session, query);
}

const ruleColumns: AdminTableColumn<AdminReminderRule>[] = [
  {
    key: "id",
    header: "Quy tắc",
    render: (row) => (
      <a
        href={`/admin/reminders?reminder_id=${row.id}`}
        className="font-mono text-xs underline-offset-2 hover:underline"
        style={{ color: "#3d6dcc" }}
      >
        {row.id}
      </a>
    )
  },
  {
    key: "rider_id",
    header: "Người dùng",
    render: (row) => (
      <a
        href={`/admin/users/${row.rider_id}`}
        className="font-mono text-xs underline-offset-2 hover:underline"
        style={{ color: "#3d6dcc" }}
      >
        {row.rider_id}
      </a>
    )
  },
  {
    key: "enabled",
    header: "Đang bật",
    render: (row) => <BooleanBadge value={row.enabled} />
  },
  {
    key: "interval_days",
    header: "Chu kỳ",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.interval_days} ngày
      </span>
    )
  },
  {
    key: "next_due_at",
    header: "Đến hạn",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.next_due_at)}
      </span>
    )
  },
  {
    key: "failure_count",
    header: "Số lần lỗi",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.failure_count}
      </span>
    )
  }
];

const occurrenceColumns: AdminTableColumn<AdminReminderOccurrence>[] = [
  {
    key: "id",
    header: "Lần nhắc",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#162130" }}>
        {row.id}
      </span>
    )
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => <StatusBadge status={row.status} />
  },
  {
    key: "due_at",
    header: "Đến hạn",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.due_at)}
      </span>
    )
  },
  {
    key: "retry_count",
    header: "Số lần thử",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.retry_count}
      </span>
    )
  },
  {
    key: "processed_at",
    header: "Xử lý lúc",
    render: (row) => (
      <span className="text-xs" style={{ color: "#6b7a8d" }}>
        {row.processed_at ? formatDateTime(row.processed_at) : "—"}
      </span>
    )
  }
];
