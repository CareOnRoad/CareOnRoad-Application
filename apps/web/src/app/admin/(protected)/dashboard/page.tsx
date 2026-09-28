import { requireAdmin } from "@/lib/auth/require-admin";
import { fetchOperationalQueue } from "@/lib/api/admin";
import type { OperationalQueueListResponse } from "@careonroad/api-contract/admin/operations";

import { AdminLayout } from "@/components/admin/admin-layout";
import { BackgroundJobsTable } from "@/components/admin/background-jobs-table";
import { MetricsBento } from "@/components/admin/metrics-bento";
import { NeedsAttentionTable } from "@/components/admin/needs-attention-table";
import { WelcomeHeader } from "@/components/admin/welcome-header";

/**
 * /admin/dashboard — Trung tâm Điều hành.
 *
 * Every number on this page comes from the read-only operational monitoring
 * queues (`/api/v1/admin/operations/*`). There are no hard-coded metrics, and
 * no queue failure is allowed to blank the page: a queue that errors renders
 * its section in an explicit unavailable state instead of fake zeros.
 *
 * `requireAdmin()` is already called by the `(protected)` layout guard, but the
 * actor is needed here for the greeting, so it is awaited again. The Supabase
 * session lookup is cached per request, so this does not double the work.
 */
export default async function AdminDashboardPage() {
  const { actor, accessToken } = await requireAdmin();
  const session = { accessToken };

  const [deadLetters, needsReview, stuckDispatch, workerRuns] = await Promise.allSettled([
    fetchOperationalQueue(session, "outbox-dead-letters", { limit: 5 }),
    fetchOperationalQueue(session, "payments-needs-review", { limit: 5 }),
    fetchOperationalQueue(session, "dispatch-stuck", { limit: 5 }),
    fetchOperationalQueue(session, "worker-runs", { limit: 20 })
  ]);

  const deadLetterRows = itemsOf(deadLetters);
  const needsReviewRows = itemsOf(needsReview);
  const stuckDispatchRows = itemsOf(stuckDispatch);
  const workerRunRows = itemsOf(workerRuns);

  const navItems = [
    { label: "Tổng quan", href: "/admin/dashboard" },
    { label: "Yêu cầu Cứu hộ", href: "/admin/service-requests", badge: queueBadge(stuckDispatch, "Tạm dừng") },
    { label: "Kỹ thuật viên", href: "/admin/mechanics" },
    { label: "Người dùng", href: "/admin/users" },
    { label: "Vận hành hệ thống", href: "/admin/operations", badge: queueBadge(deadLetters, "Cảnh báo", true) }
  ];

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành Cứu hộ", "Trực tiếp — Dữ liệu từ API vận hành"]}
      active="/admin/dashboard"
      navItems={navItems}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <WelcomeHeader userName={actor.display_name?.trim() || "Quản trị viên"} />
        <MetricsBento
          deadLetters={{ count: countOf(deadLetters, deadLetterRows), hasMore: hasMoreOf(deadLetters), unavailable: isRejected(deadLetters) }}
          needsReview={{ count: countOf(needsReview, needsReviewRows), hasMore: hasMoreOf(needsReview), unavailable: isRejected(needsReview) }}
          stuckDispatch={{ count: countOf(stuckDispatch, stuckDispatchRows), hasMore: hasMoreOf(stuckDispatch), unavailable: isRejected(stuckDispatch) }}
          failedRuns={countFailedWorkerRuns(workerRuns, workerRunRows)}
        />
        <NeedsAttentionTable stuckDispatch={stuckDispatch} needsReview={needsReview} />
        <BackgroundJobsTable result={workerRuns} />
      </div>
    </AdminLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Result helpers                                                              */
/* -------------------------------------------------------------------------- */

function isRejected(result: PromiseSettledResult<OperationalQueueListResponse>) {
  return result.status === "rejected";
}

function itemsOf<T>(result: PromiseSettledResult<OperationalQueueListResponse>) {
  return result.status === "fulfilled" ? result.value.items : [];
}

function hasMoreOf(result: PromiseSettledResult<OperationalQueueListResponse>) {
  return result.status === "fulfilled" ? result.value.page.has_more : false;
}

/**
 * The queues are error-only queues, so a single page is a good enough proxy for
 * the sidebar badge. When the backend reports more pages the count is shown as
 * a floor (`100+`) instead of triggering a full crawl of a hot queue.
 */
function countOf(
  result: PromiseSettledResult<OperationalQueueListResponse>,
  rows: Record<string, unknown>[]
) {
  if (result.status === "rejected") {
    return 0;
  }
  return result.value.page.has_more ? result.value.page.limit + 1 : rows.length;
}

function queueBadge(
  result: PromiseSettledResult<OperationalQueueListResponse>,
  suffix: string,
  danger = false
) {
  if (result.status === "rejected") {
    return undefined;
  }
  const rows = result.value.items;
  if (rows.length === 0) {
    return undefined;
  }
  const count = result.value.page.has_more ? `${result.value.page.limit}+` : rows.length;
  return { text: `${count} ${suffix}`, tone: danger ? ("danger" as const) : ("neutral" as const) };
}

/**
 * Only a failed run is an operational problem, so this is the one metric that
 * filters rather than counts. `worker-runs` is ordered by `completed_at desc`,
 * so the first page holds the most recent attempts.
 */
function countFailedWorkerRuns(
  result: PromiseSettledResult<OperationalQueueListResponse>,
  rows: Record<string, unknown>[]
) {
  if (result.status === "rejected") {
    return { count: 0, hasMore: false, unavailable: true };
  }
  return {
    count: rows.filter((row) => row.status === "failed").length,
    hasMore: result.value.page.has_more,
    unavailable: false
  };
}
