/**
 * Bento Grid — Dashboard section #2.
 *
 * Each card is one real operational queue count. A card whose queue failed to
 * load shows "—" and an explicit unavailable chip rather than a zero, because
 * "0 problems" and "we could not check" are very different messages for whoever
 * is on shift.
 *
 * Counts are a floor when the queue reports more pages: the badge reads
 * `100+` instead of pretending the first page is the whole story.
 */

type QueueStat = { count: number; hasMore: boolean; unavailable: boolean };
type WorkerRunStat = { count: number; hasMore: boolean; unavailable: boolean };

interface MetricCard {
  key: string;
  title: string;
  hint: string;
  chipText: string;
  tone: "green" | "blue" | "red" | "amber";
  stat: QueueStat | WorkerRunStat;
}

const toneStyles: Record<MetricCard["tone"], { bg: string; fg: string; dot: string }> = {
  green: { bg: "rgba(0,162,58,0.12)", fg: "#00a23a", dot: "#00a23a" },
  blue: { bg: "rgba(61,109,204,0.12)", fg: "#3d6dcc", dot: "#3d6dcc" },
  red: { bg: "rgba(147,0,10,0.10)", fg: "#93000a", dot: "#93000a" },
  amber: { bg: "rgba(217,119,6,0.12)", fg: "#d97706", dot: "#d97706" }
};

function formatCount(stat: QueueStat | WorkerRunStat) {
  if (stat.unavailable) {
    return "—";
  }
  if (stat.count === 0) {
    return "0";
  }
  return stat.hasMore ? `${stat.count}+` : String(stat.count);
}

export function MetricsBento({
  deadLetters,
  needsReview,
  stuckDispatch,
  failedRuns
}: {
  deadLetters: QueueStat;
  needsReview: QueueStat;
  stuckDispatch: QueueStat;
  failedRuns: WorkerRunStat;
}) {
  const metrics: MetricCard[] = [
    {
      key: "stuck-dispatch",
      title: "Yêu cầu tắc nghẽn",
      hint: "chưa có thợ nhận",
      chipText: "Cần điều phối",
      tone: stuckDispatch.count > 0 ? "red" : "green",
      stat: stuckDispatch
    },
    {
      key: "needs-review",
      title: "Giao dịch chờ soát xét",
      hint: "lệch khớp thanh toán",
      chipText: "Cần đối soát",
      tone: needsReview.count > 0 ? "amber" : "green",
      stat: needsReview
    },
    {
      key: "dead-letters",
      title: "Sự kiện chết",
      hint: "outbox không gửi được",
      chipText: deadLetters.count > 0 ? "Đã cạn số lần thử" : "Không có sự cố",
      tone: deadLetters.count > 0 ? "red" : "green",
      stat: deadLetters
    },
    {
      key: "failed-runs",
      title: "Tiến trình thất bại",
      hint: "lần chạy gần nhất",
      chipText: failedRuns.hasMore ? "Xem thêm" : "Trong 20 lần gần nhất",
      tone: failedRuns.count > 0 ? "red" : "green",
      stat: failedRuns
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {metrics.map((m) => {
        const t = toneStyles[m.tone];
        const unavailable = m.stat.unavailable;
        return (
          <article
            key={m.key}
            className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {m.title}
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className="text-3xl font-bold"
                style={{ color: unavailable ? "#6b7280" : "#162130" }}
              >
                {formatCount(m.stat)}
              </span>
              <span className="text-xs text-ink-muted">{m.hint}</span>
            </div>
            <span
              className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: unavailable ? "#e5e9ef" : t.bg,
                color: unavailable ? "#3d4d63" : t.fg
              }}
            >
              {unavailable ? null : (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: t.dot }}
                />
              )}
              {unavailable ? "Không tải được" : m.chipText}
            </span>
          </article>
        );
      })}
    </div>
  );
}
