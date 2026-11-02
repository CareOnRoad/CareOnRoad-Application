import {
  fetchAdminDashboard,
  fetchAdminStuckWorkflows,
  fetchOperationalQueue
} from "@/lib/api/admin";
import {
  flattenSearchParams,
  getAdminSession,
  readParam,
  settle,
  type AdminSearchParams
} from "@/lib/admin/session";

import { AdminLayout } from "@/components/admin/admin-layout";
import { BackgroundJobsTable } from "@/components/admin/background-jobs-table";
import {
  CursorPagination,
  DataTable,
  buildCursorHref,
  formatDateTime,
  type AdminTableColumn
} from "@/components/admin/data-table";
import { MetricsBento } from "@/components/admin/metrics-bento";
import { NeedsAttentionTable } from "@/components/admin/needs-attention-table";
import { ErrorState, PageHeader, Panel } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { WelcomeHeader } from "@/components/admin/welcome-header";

import type { AdminStuckWorkflow } from "@careonroad/api-contract/admin/dashboard";
import type { OperationalQueueListResponse } from "@careonroad/api-contract/admin/operations";

/** The shape `MetricsBento` expects for one queue. */
type QueueStat = { count: number; hasMore: boolean; unavailable: boolean };

/**
 * /admin/dashboard — the "Tổng quan" tab.
 *
 * Every number comes from `GET /api/v1/admin/dashboard/*`. The six views are
 * bucket HISTOGRAMS (`groups`), not scalars: the backend aggregates the
 * database by status/availability/worker, so the keys are open and the
 * frontend must read them defensively.
 *
 * Two rules for this page:
 *  - a failed view renders an explicit unavailable chip, never a fake `0`;
 *  - the previous mock map/SLA widget was removed because the backend exposes
 *    no online-mechanic aggregate, no SLA metric and no live fleet map.
 */
export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;
  const flatParams = flattenSearchParams(params);

  const from = readParam(params, "from");
  const to = readParam(params, "to");

  const views = [
    { key: "summary", label: "Tổng quan", endpoint: "/api/v1/admin/dashboard/summary" },
    { key: "dispatch", label: "Điều phối", endpoint: "/api/v1/admin/dashboard/dispatch" },
    { key: "assignments", label: "Phân công", endpoint: "/api/v1/admin/dashboard/assignments" },
    { key: "mechanics", label: "Kỹ thuật viên", endpoint: "/api/v1/admin/dashboard/mechanics" },
    { key: "service-requests", label: "Yêu cầu cứu hộ", endpoint: "/api/v1/admin/dashboard/service-requests" },
    { key: "workers", label: "Worker", endpoint: "/api/v1/admin/dashboard/workers" }
  ] as const;

  const [viewResults, stuckResult] = await Promise.all([
    Promise.all(
      views.map((view) =>
        settle(fetchAdminDashboard(session, view.key, { from, to }))
      )
    ),
    settle(
      fetchAdminStuckWorkflows(session, {
        cursor: readParam(params, "cursor"),
        limit: 20,
        from,
        to,
        category: readParam(params, "category")
      })
    )
  ]);

  // The operational queues are a SEPARATE read family from the dashboard
  // histograms: they are the live "what needs a human right now" queues.
  // `allSettled` is used on purpose — one broken queue must not blank the
  // whole dashboard, and each queue renders its own unavailable chip.
  const [stuckDispatchResult, needsReviewResult, deadLettersResult, workerRunsResult] =
    await Promise.allSettled([
      fetchOperationalQueue(session, "dispatch-stuck", { limit: 20 }),
      fetchOperationalQueue(session, "payments-needs-review", { limit: 20 }),
      fetchOperationalQueue(session, "outbox-dead-letters", { limit: 20 }),
      fetchOperationalQueue(session, "worker-runs", { limit: 20 })
    ]);

  const queueStat = (
    result: PromiseSettledResult<OperationalQueueListResponse>
  ): QueueStat => {
    if (result.status === "rejected") {
      return { count: 0, hasMore: false, unavailable: true };
    }
    return {
      count: result.value.items.length,
      hasMore: result.value.page.has_more,
      unavailable: false
    };
  };

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Tổng quan"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <WelcomeHeader userName={actor.display_name?.trim() || "Quản trị viên"} />

        <PageHeader
          title="Tổng quan vận hành"
          description={`Số liệu từ ${from ?? "30 ngày gần nhất"} đến ${to ?? "hiện tại"}, nhóm theo trạng thái trong cơ sở dữ liệu.`}
          endpoint="GET /api/v1/admin/dashboard/*"
        />

        <MetricsBento
          deadLetters={queueStat(deadLettersResult)}
          needsReview={queueStat(needsReviewResult)}
          stuckDispatch={queueStat(stuckDispatchResult)}
          failedRuns={queueStat(workerRunsResult)}
        />

        <NeedsAttentionTable
          stuckDispatch={stuckDispatchResult}
          needsReview={needsReviewResult}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {views.map((view, index) => {
            const result = viewResults[index];
            return (
              <Panel
                key={view.key}
                title={view.label}
                description={view.endpoint}
              >
                {!result.ok ? (
                  <p
                    className="rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{ background: "rgba(252,85,95,0.1)", color: "#b3131d" }}
                  >
                    Không tải được — {result.error.message}
                  </p>
                ) : (
                  <GroupTable groups={result.data.groups} />
                )}
              </Panel>
            );
          })}
        </div>

        <BackgroundJobsTable result={workerRunsResult} />

        <Panel
          title="Quy trình bị kẹt"
          description="GET /api/v1/admin/dashboard/stuck-workflows"
        >
          {!stuckResult.ok ? (
            <ErrorState
              title="Không tải được danh sách quy trình bị kẹt"
              message={stuckResult.error.message}
            />
          ) : (
            <>
              <DataTable<AdminStuckWorkflow>
                caption="Quy trình bị kẹt"
                rows={stuckResult.data.items}
                emptyLabel="Không có quy trình nào bị kẹt trong khoảng thời gian này."
                columns={stuckColumns}
                rowKey={(row) => row.id}
              />
              <CursorPagination
                page={stuckResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
              />
            </>
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}

/**
 * Renders one bucket histogram.
 *
 * The backend produces `Record<bucket, count>` where the buckets come from
 * database columns at runtime — the key set is NOT closed. Unknown keys are
 * therefore rendered as-is instead of being filtered out.
 */
function GroupTable({
  groups
}: {
  groups: Record<string, Record<string, number>>;
}) {
  const entries = Object.entries(groups);

  if (entries.length === 0) {
    return (
      <p className="text-xs" style={{ color: "#3d4d63" }}>
        Không có nhóm dữ liệu trong khoảng thời gian này.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.map(([group, buckets]) => (
        <div key={group} className="flex flex-col gap-1.5">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#3d4d63" }}
          >
            {group}
          </span>
          {Object.keys(buckets).length === 0 ? (
            <span className="text-xs" style={{ color: "#6b7a8d" }}>
              —
            </span>
          ) : (
            <ul className="flex flex-col gap-1">
              {Object.entries(buckets).map(([bucket, count]) => (
                <li
                  key={bucket}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <StatusBadge status={bucket} label={bucket} />
                  <span className="font-semibold" style={{ color: "#162130" }}>
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

const stuckColumns: AdminTableColumn<AdminStuckWorkflow>[] = [
  {
    key: "category",
    header: "Nhóm",
    render: (row) => (
      <StatusBadge status={row.category} tone="warning" label={row.category} />
    )
  },
  {
    key: "target",
    header: "Đối tượng",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.request_id ? `Yêu cầu ${row.request_id}` : null}
        {row.assignment_id ? ` · Phân công ${row.assignment_id}` : null}
        {!row.request_id && !row.assignment_id ? row.target_id : null}
      </span>
    )
  },
  {
    key: "age",
    header: "Thời gian kẹt",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatAge(row.age_seconds)}
      </span>
    )
  },
  {
    key: "failure_count",
    header: "Số lần lỗi",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.failure_count ?? 0}
      </span>
    )
  },
  {
    key: "active_lease",
    header: "Đang khoá",
    render: (row) => (
      <StatusBadge
        status={row.active_lease ? "active" : "archived"}
        tone={row.active_lease ? "info" : "neutral"}
        label={row.active_lease ? "Có" : "Không"}
      />
    )
  },
  {
    key: "next_action_codes",
    header: "Hành động đề xuất",
    render: (row) => (
      <span className="flex flex-wrap gap-1">
        {row.next_action_codes.map((code) => (
          <StatusBadge key={code} status={code} tone="info" label={code} />
        ))}
      </span>
    )
  },
  {
    key: "detected_basis_at",
    header: "Mốc phát hiện",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.detected_basis_at)}
      </span>
    )
  }
];

/** Renders a duration in seconds as a compact Vietnamese string. */
function formatAge(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  if (seconds < 60) {
    return `${seconds} giây`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} phút`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} giờ`;
  }
  return `${Math.floor(hours / 24)} ngày`;
}
