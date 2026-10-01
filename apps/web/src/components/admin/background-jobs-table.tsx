import type { OperationalQueueListResponse } from "@careonroad/api-contract/admin/operations";

/**
 * Most Recent Background Jobs — Dashboard section #5.
 *
 * Reads the `worker-runs` queue (`worker_run_records`). Two columns from the
 * previous mock were removed rather than faked:
 *
 *  - `schedule` (`CRON-2M`, `HÀNG NGÀY 14H`): a worker run record has no
 *    schedule. Trigger cadence lives in worker configuration, not in the row.
 *  - `processed` ("42 bản ghi"): no such column. The record has three counters
 *    (`items_claimed/succeeded/failed`) which are shown together instead.
 *
 * Duration is computed from `started_at`/`completed_at` in the browser's locale.
 * A negative or missing span renders as a dash rather than a bogus "0.0s".
 */

type QueueResult = PromiseSettledResult<OperationalQueueListResponse>;

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(date);
}

function formatDuration(row: Record<string, unknown>) {
  const started = readString(row, "started_at");
  const completed = readString(row, "completed_at");
  if (!started || !completed) {
    return "—";
  }
  const ms = new Date(completed).getTime() - new Date(started).getTime();
  if (Number.isNaN(ms) || ms < 0) {
    return "—";
  }
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} giây`;
}

function formatCounters(row: Record<string, unknown>) {
  const claimed = readNumber(row, "items_claimed");
  const succeeded = readNumber(row, "items_succeeded");
  const failed = readNumber(row, "items_failed");
  if (claimed === null && succeeded === null && failed === null) {
    return "—";
  }
  const parts = [`${claimed ?? 0} nhận`, `${succeeded ?? 0} xong`];
  if (failed !== null && failed > 0) {
    parts.push(`${failed} lỗi`);
  }
  return parts.join(" · ");
}

export function BackgroundJobsTable({ result }: { result: QueueResult }) {
  const rows = result.status === "fulfilled" ? result.value.items : [];
  const failed = result.status === "rejected";

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-ink">Tiến trình chạy ngầm gần nhất</h2>
        <p className="text-xs text-ink-muted">
          Lần chạy đã ghi nhận của các worker nền, mới nhất trước
        </p>
      </header>

      {failed ? (
        <p
          className="rounded-lg px-3 py-2 text-xs font-semibold"
          style={{ backgroundColor: "rgba(147,0,10,0.10)", color: "#93000a" }}
        >
          Không tải được danh sách tiến trình.
        </p>
      ) : rows.length === 0 ? (
        <p
          className="rounded-lg px-3 py-2 text-xs font-semibold"
          style={{ backgroundColor: "rgba(0,162,58,0.12)", color: "#00a23a" }}
        >
          Chưa có tiến trình nào được ghi nhận.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left text-xs uppercase tracking-wide text-ink-muted"
                style={{ borderColor: "#e5e9ef" }}
              >
                <th className="py-2 pr-3 font-semibold">Tiến trình</th>
                <th className="py-2 pr-3 font-semibold">Kết quả</th>
                <th className="py-2 pr-3 font-semibold">Mã lỗi</th>
                <th className="py-2 pr-3 font-semibold">Số mục</th>
                <th className="py-2 pr-3 font-semibold">Thời gian chạy</th>
                <th className="py-2 pr-3 font-semibold">Lần chạy cuối</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isFailed = row.status === "failed";
                const errorCode = readString(row, "error_code");
                return (
                  <tr
                    key={readString(row, "id") ?? index}
                    className="border-b align-middle"
                    style={{ borderColor: "#e5e9ef" }}
                  >
                    <td className="py-3 pr-3">
                      <code
                        className="rounded px-1.5 py-0.5 text-xs font-bold"
                        style={{ backgroundColor: "#f3f5f8", color: "#162130" }}
                      >
                        {readString(row, "worker_name") ?? "—"}
                      </code>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold"
                        style={{
                          backgroundColor: isFailed ? "rgba(147,0,10,0.10)" : "rgba(0,162,58,0.12)",
                          color: isFailed ? "#93000a" : "#00a23a"
                        }}
                      >
                        {isFailed ? "Thất bại" : "Thành công"}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className="font-mono text-[11px]"
                        style={{ color: errorCode ? "#93000a" : "#3d4d63" }}
                      >
                        {errorCode ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-sm" style={{ color: isFailed ? "#93000a" : "#162130" }}>
                      {formatCounters(row)}
                    </td>
                    <td className="py-3 pr-3 text-sm text-ink-muted">{formatDuration(row)}</td>
                    <td className="py-3 pr-3 text-sm text-ink-muted">
                      {formatDate(readString(row, "completed_at") ?? readString(row, "created_at"))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
