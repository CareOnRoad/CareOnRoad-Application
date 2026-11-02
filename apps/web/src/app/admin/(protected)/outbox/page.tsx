import {
  fetchAdminOutbox,
  fetchAdminOutboxDeadLetters,
  fetchAdminOutboxWorkerHealth
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
import { BooleanBadge, StatusBadge } from "@/components/admin/status-badge";

import type { AdminOutboxEvent } from "@careonroad/api-contract/admin/delivery";

/**
 * /admin/outbox — the "Outbox" tab.
 *
 * Reads the outbox event list, the dead-letter queue and the worker health.
 *
 * The `retry` / `abandon` buttons are driven by the BACKEND's
 * `next_action_codes`: the service refuses both while a worker lease is
 * active and refuses `retry` for topics that are not safe to replay.
 */
export default async function AdminOutboxPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;

  const status = readParam(params, "status");
  const topic = readParam(params, "topic");
  const cursor = readParam(params, "cursor");
  const flatParams = flattenSearchParams(params);

  const [listResult, deadLetterResult, healthResult] = await Promise.all([
    settle(
      fetchAdminOutbox(session, {
        status,
        topic,
        cursor,
        limit: 20
      })
    ),
    settle(fetchAdminOutboxDeadLetters(session, { cursor, limit: 20 })),
    settle(fetchAdminOutboxWorkerHealth(session, { limit: 20 }))
  ]);

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Outbox"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Outbox"
          description="Sự kiện giao hàng nền, các sự kiện chết và sức khoẻ worker."
          endpoint="GET /api/v1/admin/outbox"
        />

        <Panel title="Bộ lọc">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <SelectField label="Trạng thái" name="status" defaultValue={status}>
              <option value="">Tất cả</option>
              <option value="pending">Chờ xử lý</option>
              <option value="processing">Đang xử lý</option>
              <option value="processed">Đã xử lý</option>
              <option value="dead_letter">Chết</option>
              <option value="abandoned">Đã bỏ</option>
            </SelectField>
            <label className="flex flex-col gap-1">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "#3d4d63" }}
              >
                Chủ đề
              </span>
              <input
                type="text"
                name="topic"
                defaultValue={topic ?? ""}
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
              Áp dụng
            </button>
          </form>
        </Panel>

        <Panel title="Sự kiện outbox">
          {!listResult.ok ? (
            <ErrorState
              title="Không tải được danh sách sự kiện outbox"
              message={listResult.error.message}
            />
          ) : (
            <>
              <DataTable<AdminOutboxEvent>
                caption="Sự kiện outbox"
                rows={listResult.data.items}
                emptyLabel="Không có sự kiện nào khớp bộ lọc."
                columns={columns}
                rowKey={(row) => row.id}
              />
              <CursorPagination
                page={listResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
              />
            </>
          )}
        </Panel>

        <Panel
          title="Sự kiện chết"
          description="GET /api/v1/admin/outbox/dead-letter"
        >
          {!deadLetterResult.ok ? (
            <ErrorState
              title="Không tải được hàng đợi sự kiện chết"
              message={deadLetterResult.error.message}
            />
          ) : deadLetterResult.data.items.length === 0 ? (
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              Không có sự kiện nào bị chết.
            </p>
          ) : (
            <DataTable<AdminOutboxEvent>
              caption="Sự kiện chết"
              rows={deadLetterResult.data.items}
              emptyLabel="Không có sự kiện nào bị chết."
              columns={columns}
              rowKey={(row) => row.id}
            />
          )}
        </Panel>

        <Panel
          title="Sức khoẻ worker"
          description="GET /api/v1/admin/outbox/worker-health"
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
                  <span style={{ color: "#162130" }}>{run.worker_name}</span>
                  <span style={{ color: "#3d4d63" }}>
                    Đã lấy {run.items_claimed} · thành công {run.items_succeeded} · lỗi{" "}
                    {run.items_failed}
                  </span>
                  <span style={{ color: "#6b7a8d" }}>
                    {formatDateTime(run.started_at)}
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

const columns: AdminTableColumn<AdminOutboxEvent>[] = [
  {
    key: "id",
    header: "Mã sự kiện",
    render: (row) => (
      <a
        href={`/admin/outbox/${row.id}`}
        className="font-mono text-xs underline-offset-2 hover:underline"
        style={{ color: "#3d6dcc" }}
      >
        {row.id}
      </a>
    )
  },
  {
    key: "topic",
    header: "Chủ đề",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#162130" }}>
        {row.topic}
      </span>
    )
  },
  {
    key: "aggregate",
    header: "Đối tượng",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.aggregate_type} · {row.aggregate_id}
      </span>
    )
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => <StatusBadge status={row.status} />
  },
  {
    key: "attempt_count",
    header: "Số lần thử",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.attempt_count} (quản trị: {row.admin_retry_count})
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
    key: "next_action_codes",
    header: "Hành động được phép",
    render: (row) => (
      <span className="flex flex-wrap gap-1">
        {row.next_action_codes.length === 0 ? (
          <span style={{ color: "#6b7a8d" }}>—</span>
        ) : (
          row.next_action_codes.map((code) => (
            <StatusBadge key={code} status={code} tone="info" label={code} />
          ))
        )}
      </span>
    )
  },
  {
    key: "next_attempt_at",
    header: "Lần thử kế",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.next_attempt_at)}
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
