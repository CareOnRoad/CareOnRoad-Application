import {
  fetchLiveness,
  fetchOperationalQueue,
  fetchReadiness
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
import { StatusBadge } from "@/components/admin/status-badge";

/**
 * /admin/operations — the "Vận hành hệ thống" tab.
 *
 * Reads the four read-only operational monitoring queues:
 *  - `/api/v1/admin/operations/outbox-dead-letters`
 *  - `/api/v1/admin/operations/payments-needs-review`
 *  - `/api/v1/admin/operations/dispatch-stuck`
 *  - `/api/v1/admin/operations/worker-runs`
 *
 * It also renders the two deployment probes
 * (`/api/v1/internal/health/live` and `/api/v1/internal/health/ready`),
 * which are UNAUTHENTICATED and return a FIXED, redacted payload. They are
 * the only place the admin console shows the health of the backend itself.
 *
 * The queue items are intentionally permissive on the backend side (there is
 * no per-queue item schema), so each row is rendered as an opaque,
 * already-redacted record. Nothing here exposes an event payload or a raw
 * worker error.
 */
export default async function AdminOperationsPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;

  const cursor = readParam(params, "cursor");
  const flatParams = flattenSearchParams(params);

  const [deadLetters, needsReview, stuckDispatch, workerRuns] = await Promise.all([
    settle(fetchOperationalQueue(session, "outbox-dead-letters", { cursor, limit: 20 })),
    settle(fetchOperationalQueue(session, "payments-needs-review", { cursor, limit: 20 })),
    settle(fetchOperationalQueue(session, "dispatch-stuck", { cursor, limit: 20 })),
    settle(fetchOperationalQueue(session, "worker-runs", { cursor, limit: 20 }))
  ]);

  // The deployment probes are unauthenticated and return a FIXED, redacted
  // payload — no connection strings, no provider keys, no raw errors.
  const [liveness, readiness] = await Promise.all([
    settle(fetchLiveness()),
    settle(fetchReadiness())
  ]);

  const queues = [
    {
      key: "dead-letters",
      label: "Sự kiện outbox chết",
      endpoint: "/api/v1/admin/operations/outbox-dead-letters",
      result: deadLetters
    },
    {
      key: "needs-review",
      label: "Thanh toán cần soát xét",
      endpoint: "/api/v1/admin/operations/payments-needs-review",
      result: needsReview
    },
    {
      key: "dispatch-stuck",
      label: "Điều phối bị kẹt",
      endpoint: "/api/v1/admin/operations/dispatch-stuck",
      result: stuckDispatch
    },
    {
      key: "worker-runs",
      label: "Lần chạy worker",
      endpoint: "/api/v1/admin/operations/worker-runs",
      result: workerRuns
    }
  ] as const;

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Vận hành hệ thống"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Vận hành hệ thống"
          description="Các hàng đợi giám sát chỉ đọc. Dữ liệu đã được backend làm sạch trước khi trả về."
          endpoint="GET /api/v1/admin/operations/*"
        />

        <Panel
          title="Sức khoẻ dịch vụ"
          description="GET /api/v1/internal/health/live và GET /api/v1/internal/health/ready — đầu ra cố định, đã che thông tin nhạy cảm."
        >
          {!liveness.ok ? (
            <ErrorState
              title="Không tải được trạng thái sống"
              message={liveness.error.message}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "#3d4d63" }}
                >
                  Sống (live)
                </span>
                <StatusBadge
                  status={liveness.data.status}
                  tone={liveness.data.status === "ok" ? "success" : "danger"}
                  label={liveness.data.status}
                />
              </div>

              {!readiness.ok ? (
                <ErrorState
                  title="Không tải được trạng thái sẵn sàng"
                  message={readiness.error.message}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: "#3d4d63" }}
                    >
                      Sẵn sàng (ready)
                    </span>
                    <StatusBadge
                      status={readiness.data.status}
                      tone={
                        readiness.data.status === "ready" ? "success" : "danger"
                      }
                      label={
                        readiness.data.status === "ready"
                          ? "Sẵn sàng"
                          : "Chưa sẵn sàng"
                      }
                    />
                  </div>
                  <ul className="flex flex-col gap-2">
                    {readiness.data.checks.map((check) => (
                      <li
                        key={check.name}
                        className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs"
                        style={{ backgroundColor: "#f8fafc" }}
                      >
                        <span className="font-semibold" style={{ color: "#162130" }}>
                          {check.name}
                        </span>
                        <StatusBadge
                          status={check.status}
                          tone={
                            check.status === "up" || check.status === "configured"
                              ? "success"
                              : check.status === "disabled"
                                ? "neutral"
                                : "danger"
                          }
                          label={check.status}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </Panel>

        {queues.map((queue) => (
          <Panel key={queue.key} title={queue.label} description={queue.endpoint}>
            {!queue.result.ok ? (
              <ErrorState
                title="Không tải được hàng đợi"
                message={queue.result.error.message}
              />
            ) : (
              <>
                <DataTable<Record<string, unknown>>
                  caption={queue.label}
                  rows={queue.result.data.items}
                  emptyLabel="Hàng đợi đang trống."
                  columns={columns}
                  rowKey={(row, index) => rowId(row, index)}
                />
                <CursorPagination
                  page={queue.result.data.page}
                  buildHref={(next) => buildCursorHref(flatParams, next)}
                />
              </>
            )}
          </Panel>
        ))}
      </div>
    </AdminLayout>
  );
}

/**
 * Resolves a stable row key.
 *
 * The queue items have no guaranteed `id` column, so the key falls back to
 * the index when the record has neither an `id` nor a timestamp.
 */
function rowId(row: Record<string, unknown>, index: number): string {
  const id = row.id;
  if (typeof id === "string" && id) {
    return id;
  }
  const createdAt = row.created_at ?? row.started_at ?? row.detected_basis_at;
  if (typeof createdAt === "string" && createdAt) {
    return `${createdAt}-${index}`;
  }
  return `row-${index}`;
}

const columns: AdminTableColumn<Record<string, unknown>>[] = [
  {
    key: "summary",
    header: "Tóm tắt",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#162130" }}>
        {summarize(row)}
      </span>
    )
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => {
      const status = row.status ?? row.category ?? row.worker_name;
      return typeof status === "string" ? (
        <StatusBadge status={status} label={status} />
      ) : (
        <span style={{ color: "#6b7a8d" }}>—</span>
      );
    }
  },
  {
    key: "timestamp",
    header: "Thời điểm",
    render: (row) => {
      const value =
        row.created_at ?? row.started_at ?? row.detected_basis_at ?? row.completed_at;
      return (
        <span className="text-xs" style={{ color: "#3d4d63" }}>
          {typeof value === "string" ? formatDateTime(value) : "—"}
        </span>
      );
    }
  }
];

/**
 * Renders the meaningful scalar fields of a queue item.
 *
 * The values are already redacted by the backend, so they can be shown
 * directly — but only scalars, so an unexpected object cannot dump a whole
 * payload into the table.
 */
function summarize(row: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number") {
      parts.push(`${key}=${value}`);
    }
    if (parts.length >= 6) {
      break;
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}
