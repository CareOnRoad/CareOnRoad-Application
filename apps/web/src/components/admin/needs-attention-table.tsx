import type { OperationalQueueListResponse } from "@careonroad/api-contract/admin/operations";

/**
 * Items Needing Immediate Attention — Dashboard section #4.
 *
 * Two real queues, side by side instead of one merged table:
 *  - `dispatch-stuck`: requests that no mechanic has picked up.
 *  - `payments-needs-review`: payment orders whose status needs a human.
 *
 * Both queue item schemas are `z.record(z.unknown())`, so every field is read
 * defensively: a missing key renders as a dash rather than `undefined`. A queue
 * that failed to load renders an explicit error row — it is never mixed in with
 * the other queue's rows, so a broken queue can never be mistaken for an empty
 * one.
 *
 * There is no per-row action link. The `/admin/service-requests/[requestId]`
 * page does not exist yet, and linking to it produced a guaranteed 404. The
 * request id is shown instead so the row stays copyable.
 */

type QueueResult = PromiseSettledResult<OperationalQueueListResponse>;

function rowsOf(result: QueueResult) {
  return result.status === "fulfilled" ? result.value.items : [];
}

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(date);
}

const statusTone: Record<string, { fg: string; bg: string }> = {
  dispatching: { fg: "#d97706", bg: "rgba(217,119,6,0.14)" },
  offered: { fg: "#3d6dcc", bg: "rgba(61,109,204,0.12)" },
  needs_review: { fg: "#93000a", bg: "rgba(147,0,10,0.10)" }
};

const statusLabel: Record<string, string> = {
  dispatching: "Đang điều phối",
  offered: "Đã gửi đề nghị",
  needs_review: "Chờ soát xét"
};

export function NeedsAttentionTable({
  stuckDispatch,
  needsReview
}: {
  stuckDispatch: QueueResult;
  needsReview: QueueResult;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <QueueCard
        title="Yêu cầu chưa có thợ nhận"
        description="Yêu cầu đang điều phối nhưng không thợ nào nhận trước khi hết hạn"
        result={stuckDispatch}
        renderRow={(row) => {
          const status = readString(row, "status") ?? "dispatching";
          const attempts = readString(row, "updated_at");
          return (
            <>
              <CodeCell value={readString(row, "request_code") ?? readString(row, "id")} />
              <StatusCell status={status} />
              <Cell text={formatTimestamp(attempts)} />
            </>
          );
        }}
        columns={["Mã yêu cầu", "Trạng thái", "Cập nhật lúc"]}
      />

      <QueueCard
        title="Giao dịch chờ soát xét"
        description="Lệnh thanh toán bị giữ lại để đối chiếu thủ công"
        result={needsReview}
        renderRow={(row) => {
          const status = readString(row, "status") ?? "needs_review";
          const amount = row.amount;
          return (
            <>
              <CodeCell value={readString(row, "request_code") ?? readString(row, "request_id")} />
              <Cell
                text={
                  typeof amount === "number"
                    ? new Intl.NumberFormat("vi-VN").format(amount) + " đ"
                    : "—"
                }
              />
              <StatusCell status={status} />
              <Cell text={formatTimestamp(readString(row, "updated_at"))} />
            </>
          );
        }}
        columns={["Mã yêu cầu", "Số tiền", "Nhóm", "Cập nhật lúc"]}
      />
    </div>
  );
}

function QueueCard({
  title,
  description,
  columns,
  result,
  renderRow
}: {
  title: string;
  description: string;
  columns: string[];
  result: QueueResult;
  renderRow: (row: Record<string, unknown>) => React.ReactNode;
}) {
  const rows = rowsOf(result);
  const failed = result.status === "rejected";
  const hasMore = result.status === "fulfilled" ? result.value.page.has_more : false;

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <p className="text-xs text-ink-muted">{description}</p>
      </header>

      {failed ? (
        <p
          className="rounded-lg px-3 py-2 text-xs font-semibold"
          style={{ backgroundColor: "rgba(147,0,10,0.10)", color: "#93000a" }}
        >
          Không tải được hàng đợi này. Số liệu phía trên không bao gồm mục này.
        </p>
      ) : rows.length === 0 ? (
        <p
          className="rounded-lg px-3 py-2 text-xs font-semibold"
          style={{ backgroundColor: "rgba(0,162,58,0.12)", color: "#00a23a" }}
        >
          Không có mục nào cần xử lý.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-ink-muted" style={{ borderColor: "#e5e9ef" }}>
                {columns.map((column) => (
                  <th key={column} className="py-2 pr-3 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={readString(row, "id") ?? index} className="border-b align-top" style={{ borderColor: "#e5e9ef" }}>
                  {renderRow(row)}
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore ? (
            <p className="pt-3 text-[11px] text-ink-muted">
              Đang hiển thị {rows.length} mục đầu. Xem toàn bộ tại hàng đợi vận hành.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function CodeCell({ value }: { value: string | null }) {
  return (
    <td className="py-3 pr-3">
      <span className="font-mono text-xs font-bold" style={{ color: "#3d6dcc" }}>
        {value ?? "—"}
      </span>
    </td>
  );
}

function Cell({ text }: { text: string }) {
  return (
    <td className="py-3 pr-3 text-sm text-ink">{text}</td>
  );
}

function StatusCell({ status }: { status: string }) {
  const tone = statusTone[status] ?? { fg: "#3d4d63", bg: "#f3f5f8" };
  return (
    <td className="py-3 pr-3">
      <span
        className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold"
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        {statusLabel[status] ?? status}
      </span>
    </td>
  );
}
