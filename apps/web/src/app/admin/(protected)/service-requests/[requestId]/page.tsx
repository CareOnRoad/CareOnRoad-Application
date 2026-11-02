import {
  fetchAdminDispatchEligibleMechanics,
  fetchAdminDispatchExplanation,
  fetchAdminDispatchRounds,
  fetchAdminDispatchStatus,
  fetchAdminServiceRequestAssignment,
  fetchAdminServiceRequestDetail,
  fetchAdminServiceRequestMedia,
  fetchAdminServiceRequestQuoteHistory,
  fetchAdminServiceRequestQuotes,
  fetchAdminServiceRequestSupervisionActions,
  fetchAdminServiceRequestTimeline
} from "@/lib/api/admin";
import {
  flattenSearchParams,
  getAdminSession,
  readParam,
  settle,
  settleOrNotFound,
  type AdminSearchParams
} from "@/lib/admin/session";

import { AdminLayout } from "@/components/admin/admin-layout";
import {
  CursorPagination,
  DataTable,
  buildCursorHref,
  formatDateTime,
  formatVnd,
  type AdminTableColumn
} from "@/components/admin/data-table";
import { ErrorState, PageHeader, Panel } from "@/components/admin/page-header";
import {
  BooleanBadge,
  DetailField,
  StatusBadge
} from "@/components/admin/status-badge";

import {
  RequestCancellationRepairForm,
  RequestCommandForms,
  RequestNoteForm,
  RequestReservationRepairForm
} from "./request-forms";
import { DispatchRoundExpireForm } from "./dispatch-round-expire-form";
import { QuoteDisputeForm } from "@/app/admin/(protected)/quotes/quote-dispute-form";

import type {
  AdminRequestMedia,
  AdminRequestQuote,
  AdminRequestTimelineItem
} from "@careonroad/api-contract/admin/service-requests";
import type { AdminDispatchRound } from "@careonroad/api-contract/admin/dispatch";
import type { AdminSupervisionAction } from "@careonroad/api-contract/admin/assignments";

/**
 * /admin/service-requests/[requestId] — the detail screen of the
 * "Yêu cầu cứu hộ" tab.
 *
 * This screen is the busiest one: eleven backend reads feed it.
 *
 *  - `GET .../{id}`                     → the request
 *  - `GET .../{id}/timeline`            → status transitions + notes
 *  - `GET .../{id}/media`               → media metadata
 *  - `GET .../{id}/assignment`          → the active assignment
 *  - `GET .../{id}/quotes`              → the quote summary list
 *  - `GET .../{id}/quotes/history`      → the supervision quote history
 *  - `GET .../{id}/supervision-actions` → the admin action log
 *  - `GET .../{id}/dispatch`            → the dispatch summary
 *  - `GET .../{id}/dispatch/rounds`     → the round history
 *  - `GET .../{id}/dispatch/eligible-mechanics`
 *  - `GET .../{id}/dispatch/explanation`
 *
 * The write buttons are driven by `next_action_codes`, which is the BACKEND's
 * own decision about what is legal right now. The frontend never re-derives
 * those rules.
 */
export default async function AdminServiceRequestDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<AdminSearchParams>;
}) {
  const { requestId } = await params;
  const query = await searchParams;
  const { actor, session } = await getAdminSession();

  const detailResult = await settleOrNotFound(
    fetchAdminServiceRequestDetail(session, requestId)
  );

  if (!detailResult.ok) {
    return (
      <AdminLayout
        crumb={["CareOnRoad", "Điều hành", "Yêu cầu cứu hộ"]}
        userName={actor.display_name?.trim() || "Quản trị viên"}
      >
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Yêu cầu cứu hộ"
            endpoint={`GET /api/v1/admin/service-requests/${requestId}`}
            backHref="/admin/service-requests"
          />
          <ErrorState
            title="Không tải được thông tin yêu cầu"
            message={detailResult.error.message}
          />
        </div>
      </AdminLayout>
    );
  }

  const detail = detailResult.data;
  const flatParams = flattenSearchParams(query);

  const [
    timelineResult,
    mediaResult,
    assignmentResult,
    quotesResult,
    quoteHistoryResult,
    supervisionResult,
    dispatchStatusResult,
    dispatchRoundsResult,
    eligibleResult,
    explanationResult
  ] = await Promise.all([
    settle(
      fetchAdminServiceRequestTimeline(session, requestId, {
        cursor: readParam(query, "cursor"),
        limit: 20
      })
    ),
    settle(fetchAdminServiceRequestMedia(session, requestId, { limit: 20 })),
    settle(fetchAdminServiceRequestAssignment(session, requestId)),
    settle(
      fetchAdminServiceRequestQuotes(session, requestId, {
        cursor: readParam(query, "quote_cursor"),
        limit: 20
      })
    ),
    settle(fetchAdminServiceRequestQuoteHistory(session, requestId, { limit: 20 })),
    settle(fetchAdminServiceRequestSupervisionActions(session, requestId, { limit: 20 })),
    settle(fetchAdminDispatchStatus(session, requestId)),
    settle(
      fetchAdminDispatchRounds(session, requestId, {
        cursor: readParam(query, "round_cursor"),
        limit: 20
      })
    ),
    settle(fetchAdminDispatchEligibleMechanics(session, requestId, { limit: 20 })),
    settle(fetchAdminDispatchExplanation(session, requestId, { limit: 20 }))
  ]);

  const dispatch = dispatchStatusResult.ok ? dispatchStatusResult.data : null;
  const nextActions = new Set(dispatch?.next_action_codes ?? []);

  const assignment = assignmentResult.ok ? assignmentResult.data : null;
  const assignmentId = assignment?.id ?? detail.assignment?.id;

  return (
    <AdminLayout
      crumb={[
        "CareOnRoad",
        "Điều hành",
        "Yêu cầu cứu hộ",
        detail.request_code
      ]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title={detail.request_code}
          description={`Loại dịch vụ: ${detail.service_type} · Ưu tiên: ${detail.priority}`}
          endpoint={`GET /api/v1/admin/service-requests/${requestId}`}
          backHref="/admin/service-requests"
        />

        <Panel title="Thông tin yêu cầu">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <DetailField label="Trạng thái">
              <StatusBadge status={detail.status} />
            </DetailField>
            <DetailField label="Ưu tiên">
              <StatusBadge
                status={detail.priority}
                tone={
                  detail.priority === "emergency"
                    ? "danger"
                    : detail.priority === "high"
                      ? "warning"
                      : "neutral"
                }
              />
            </DetailField>
            <DetailField label="Cách thực hiện">
              {detail.fulfillment_mode ?? "—"}
            </DetailField>
            <DetailField label="Lịch hẹn">
              {detail.scheduled_start_at
                ? formatDateTime(detail.scheduled_start_at)
                : "—"}
            </DetailField>
            <DetailField label="Người dùng">
              <span className="font-mono text-xs">{detail.rider_id}</span>
            </DetailField>
            <DetailField label="Xe máy">
              <span className="font-mono text-xs">{detail.motorcycle_id}</span>
            </DetailField>
            <DetailField label="Kỹ thuật viên">
              <span className="font-mono text-xs">{detail.mechanic_id ?? "—"}</span>
            </DetailField>
            <DetailField label="Tạo lúc">
              {formatDateTime(detail.created_at)}
            </DetailField>
          </div>
        </Panel>

        {detail.dispatch ? (
          <Panel title="Vòng điều phối hiện tại">
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              <DetailField label="Vòng số">
                {detail.dispatch.round_number}
              </DetailField>
              <DetailField label="Trạng thái">
                <StatusBadge status={detail.dispatch.status} />
              </DetailField>
              <DetailField label="Số ứng viên">
                {detail.dispatch.open_candidate_count}
              </DetailField>
              <DetailField label="Hết hạn">
                {formatDateTime(detail.dispatch.expires_at)}
              </DetailField>
            </div>
          </Panel>
        ) : null}

        {dispatch ? (
          <Panel
            title="Tình trạng điều phối"
            description="GET /api/v1/admin/service-requests/{id}/dispatch"
          >
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              <DetailField label="Vòng khởi đầu">
                {dispatch.episode_start_round}
              </DetailField>
              <DetailField label="Số lần thử lại">
                {dispatch.retry_count} / {dispatch.max_retry_count}
              </DetailField>
              <DetailField label="Số vòng trong chu kỳ">
                {dispatch.episode_round_count} / {dispatch.max_rounds_per_episode}
              </DetailField>
              <DetailField label="Số vòng đã lưu">
                {dispatch.round_history_count}
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
                {dispatch.next_action_codes.length === 0 ? (
                  <span className="text-xs" style={{ color: "#6b7a8d" }}>
                    Không có hành động nào khả dụng.
                  </span>
                ) : (
                  dispatch.next_action_codes.map((code) => (
                    <StatusBadge key={code} status={code} tone="info" label={code} />
                  ))
                )}
              </span>
            </div>

            {dispatch.reason_codes.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "#3d4d63" }}
                >
                  Mã lý do
                </span>
                <span className="flex flex-wrap gap-1">
                  {dispatch.reason_codes.map((code) => (
                    <StatusBadge key={code} status={code} tone="warning" label={code} />
                  ))}
                </span>
              </div>
            ) : null}
          </Panel>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel title="Xử lý yêu cầu">
            <RequestCommandForms
              requestId={requestId}
              canCancel={nextActions.has("cancel_request")}
              canEscalate={nextActions.has("manual_escalate")}
              canRetryDispatch={nextActions.has("retry_dispatch")}
              canCancelDispatch={nextActions.has("cancel_dispatch")}
              canManualAssign={nextActions.has("manual_assign")}
            />
          </Panel>

          <Panel title="Ghi chú nội bộ">
            <RequestNoteForm requestId={requestId} />
          </Panel>
        </div>

        <Panel
          title="Tranh chấp báo giá"
          description="POST /api/v1/admin/service-requests/{id}/quote-dispute/resolve — chỉ áp dụng cho báo giá mới nhất của yêu cầu."
        >
          <QuoteDisputeForm requestId={requestId} />
        </Panel>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel title="Sửa trạng thái huỷ">
            <RequestCancellationRepairForm
              requestId={requestId}
              assignmentId={assignmentId}
            />
          </Panel>
          <Panel title="Sửa chỗ đặt lịch">
            <RequestReservationRepairForm
              requestId={requestId}
              assignmentId={assignmentId}
            />
          </Panel>
        </div>

        <Panel title="Phân công">
          {!assignmentResult.ok ? (
            <ErrorState
              title="Không tải được thông tin phân công"
              message={assignmentResult.error.message}
            />
          ) : !assignmentResult.data ? (
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              Yêu cầu chưa có phân công nào.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              <DetailField label="Mã phân công">
                <span className="font-mono text-xs">{assignmentResult.data.id}</span>
              </DetailField>
              <DetailField label="Kỹ thuật viên">
                <span className="font-mono text-xs">
                  {assignmentResult.data.mechanic_id}
                </span>
              </DetailField>
              <DetailField label="Trạng thái">
                <StatusBadge status={assignmentResult.data.status} />
              </DetailField>
              <DetailField label="Nhận việc lúc">
                {formatDateTime(assignmentResult.data.accepted_at)}
              </DetailField>
            </div>
          )}
        </Panel>

        <Panel title="Báo giá">
          {!quotesResult.ok ? (
            <ErrorState
              title="Không tải được danh sách báo giá"
              message={quotesResult.error.message}
            />
          ) : (
            <>
              <DataTable<AdminRequestQuote>
                caption="Báo giá của yêu cầu"
                rows={quotesResult.data.items}
                emptyLabel="Yêu cầu chưa có báo giá nào."
                columns={quoteColumns}
                rowKey={(row) => row.id}
              />
              <CursorPagination
                page={quotesResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
              />
            </>
          )}

          {!quoteHistoryResult.ok ? (
            <ErrorState
              title="Không tải được lịch sử báo giá"
              message={quoteHistoryResult.error.message}
            />
          ) : quoteHistoryResult.data.items.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "#3d4d63" }}
              >
                Lịch sử giám sát báo giá
              </span>
              <ul className="flex flex-col gap-1">
                {quoteHistoryResult.data.items.map((item) => (
                  <li key={item.id} className="text-xs" style={{ color: "#3d4d63" }}>
                    <span className="font-mono">{item.id}</span> · v{item.version} ·{" "}
                    {item.status} · {formatVnd(item.total_amount)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        <Panel title="Dòng thời gian">
          {!timelineResult.ok ? (
            <ErrorState
              title="Không tải được dòng thời gian"
              message={timelineResult.error.message}
            />
          ) : (
            <>
              <DataTable<AdminRequestTimelineItem>
                caption="Dòng thời gian của yêu cầu"
                rows={timelineResult.data.items}
                emptyLabel="Chưa có sự kiện nào trên yêu cầu này."
                columns={timelineColumns}
                rowKey={(row) => row.id}
              />
              <CursorPagination
                page={timelineResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
              />
            </>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel title="Tệp đính kèm">
            {!mediaResult.ok ? (
              <ErrorState
                title="Không tải được danh sách tệp đính kèm"
                message={mediaResult.error.message}
              />
            ) : mediaResult.data.items.length === 0 ? (
              <p className="text-sm" style={{ color: "#3d4d63" }}>
                Yêu cầu không có tệp đính kèm.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {mediaResult.data.items.map((media) => (
                  <MediaRow key={media.id} media={media} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Nhật ký giám sát của quản trị">
            {!supervisionResult.ok ? (
              <ErrorState
                title="Không tải được nhật ký giám sát"
                message={supervisionResult.error.message}
              />
            ) : supervisionResult.data.items.length === 0 ? (
              <p className="text-sm" style={{ color: "#3d4d63" }}>
                Chưa có hành động giám sát nào.
              </p>
            ) : (
              <DataTable<AdminSupervisionAction>
                caption="Nhật ký giám sát"
                rows={supervisionResult.data.items}
                emptyLabel="Chưa có hành động giám sát nào."
                columns={supervisionColumns}
                rowKey={(row) => row.id}
              />
            )}
          </Panel>
        </div>

        <Panel title="Lịch sử vòng điều phối">
          {!dispatchRoundsResult.ok ? (
            <ErrorState
              title="Không tải được lịch sử vòng điều phối"
              message={dispatchRoundsResult.error.message}
            />
          ) : (
            <>
              <DataTable<AdminDispatchRound>
                caption="Các vòng điều phối"
                rows={dispatchRoundsResult.data.items}
                emptyLabel="Yêu cầu chưa có vòng điều phối nào."
                columns={roundColumns}
                rowKey={(row) => row.id}
              />
              <CursorPagination
                page={dispatchRoundsResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
              />

              {dispatchRoundsResult.data.items
                .filter((round) => round.status === "active")
                .map((round) => (
                  <div key={round.id} className="flex flex-col gap-2 pt-2">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: "#3d4d63" }}
                    >
                      Vòng #{round.round_number} · {round.id}
                    </span>
                    <DispatchRoundExpireForm
                      roundId={round.id}
                      requestId={requestId}
                      status={round.status}
                      expiresAt={round.expires_at}
                    />
                  </div>
                ))}
            </>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel
            title="Kỹ thuật viên đủ điều kiện"
            description="GET .../dispatch/eligible-mechanics"
          >
            {!eligibleResult.ok ? (
              <ErrorState
                title="Không tải được danh sách kỹ thuật viên đủ điều kiện"
                message={eligibleResult.error.message}
              />
            ) : eligibleResult.data.items.length === 0 ? (
              <p className="text-sm" style={{ color: "#3d4d63" }}>
                Không có kỹ thuật viên nào đủ điều kiện.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {eligibleResult.data.items.map((item) => (
                  <li
                    key={item.mechanic_id}
                    className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs"
                    style={{ backgroundColor: "#f8fafc" }}
                  >
                    <span className="font-mono" style={{ color: "#162130" }}>
                      {item.mechanic_id}
                    </span>
                    <BooleanBadge
                      value={item.eligible}
                      trueLabel="Đủ điều kiện"
                      falseLabel="Không đủ"
                    />
                    {item.distance_m !== undefined ? (
                      <span style={{ color: "#6b7a8d" }}>
                        {Math.round(item.distance_m)} m
                      </span>
                    ) : null}
                    <span style={{ color: "#6b7a8d" }}>
                      ★ {item.rating_avg.toFixed(2)} ({item.rating_count})
                    </span>
                    {item.reason_codes.map((code) => (
                      <StatusBadge key={code} status={code} tone="warning" label={code} />
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Giải thích điều phối"
            description="GET .../dispatch/explanation"
          >
            {!explanationResult.ok ? (
              <ErrorState
                title="Không tải được dữ liệu giải thích điều phối"
                message={explanationResult.error.message}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
                  <DetailField label="Đánh giá">
                    {explanationResult.data.evaluation}
                  </DetailField>
                  <DetailField label="Bán kính">
                    {explanationResult.data.radius_m} m
                  </DetailField>
                  <DetailField label="Phạm vi thống kê">
                    {explanationResult.data.reason_counts_scope ?? "—"}
                  </DetailField>
                </div>
                <ul className="flex flex-col gap-1">
                  {explanationResult.data.items.map((item) => (
                    <li
                      key={item.mechanic_id}
                      className="flex flex-wrap items-center gap-2 text-xs"
                    >
                      <span className="font-mono" style={{ color: "#162130" }}>
                        {item.mechanic_id}
                      </span>
                      <BooleanBadge value={item.eligible} />
                      {item.reason_codes.map((code) => (
                        <StatusBadge
                          key={code}
                          status={code}
                          tone="warning"
                          label={code}
                        />
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AdminLayout>
  );
}

function MediaRow({ media }: { media: AdminRequestMedia }) {
  return (
    <li
      className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs"
      style={{ backgroundColor: "#f8fafc" }}
    >
      <span className="font-semibold" style={{ color: "#162130" }}>
        {media.media_type}
      </span>
      <span style={{ color: "#3d4d63" }}>{media.content_type}</span>
      {media.size_bytes !== undefined ? (
        <span style={{ color: "#6b7a8d" }}>{media.size_bytes} bytes</span>
      ) : null}
      <span style={{ color: "#6b7a8d" }}>
        {formatDateTime(media.created_at)}
      </span>
    </li>
  );
}

const quoteColumns: AdminTableColumn<AdminRequestQuote>[] = [
  {
    key: "version",
    header: "Phiên bản",
    render: (row) => (
      <span className="text-xs" style={{ color: "#162130" }}>
        v{row.version}
      </span>
    )
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => <StatusBadge status={row.status} />
  },
  {
    key: "total_amount",
    header: "Tổng tiền",
    render: (row) => (
      <span className="text-xs font-semibold" style={{ color: "#162130" }}>
        {formatVnd(row.total_amount)}
      </span>
    )
  },
  {
    key: "discount_amount",
    header: "Giảm giá",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatVnd(row.discount_amount)}
      </span>
    )
  },
  {
    key: "expires_at",
    header: "Hết hạn",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.expires_at ? formatDateTime(row.expires_at) : "—"}
      </span>
    )
  },
  {
    key: "created_at",
    header: "Tạo lúc",
    render: (row) => (
      <span className="text-xs" style={{ color: "#6b7a8d" }}>
        {formatDateTime(row.created_at)}
      </span>
    )
  }
];

const timelineColumns: AdminTableColumn<AdminRequestTimelineItem>[] = [
  {
    key: "kind",
    header: "Loại",
    render: (row) => (
      <StatusBadge
        status={row.kind}
        tone={row.kind === "internal_note" ? "info" : "neutral"}
        label={row.kind === "internal_note" ? "Ghi chú" : "Chuyển trạng thái"}
      />
    )
  },
  {
    key: "transition",
    header: "Chuyển trạng thái",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.kind === "status"
          ? `${row.from_status ?? "—"} → ${row.to_status}`
          : row.note}
      </span>
    )
  },
  {
    key: "actor",
    header: "Người thực hiện",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#6b7a8d" }}>
        {row.kind === "internal_note" ? row.admin_id : (row.actor_id ?? "—")}
      </span>
    )
  },
  {
    key: "created_at",
    header: "Thời điểm",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.created_at)}
      </span>
    )
  }
];

const supervisionColumns: AdminTableColumn<AdminSupervisionAction>[] = [
  {
    key: "action",
    header: "Hành động",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#162130" }}>
        {row.action}
      </span>
    )
  },
  {
    key: "target",
    header: "Đối tượng",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.request_id ?? row.assignment_id ?? row.quote_id ?? row.diagnosis_id ?? "—"}
      </span>
    )
  },
  {
    key: "admin_id",
    header: "Quản trị viên",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#6b7a8d" }}>
        {row.admin_id}
      </span>
    )
  },
  {
    key: "created_at",
    header: "Thời điểm",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.created_at)}
      </span>
    )
  }
];

const roundColumns: AdminTableColumn<AdminDispatchRound>[] = [
  {
    key: "round_number",
    header: "Vòng",
    render: (row) => (
      <span className="text-xs" style={{ color: "#162130" }}>
        #{row.round_number}
      </span>
    )
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => <StatusBadge status={row.status} />
  },
  {
    key: "radius_m",
    header: "Bán kính",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.radius_m} m
      </span>
    )
  },
  {
    key: "candidates",
    header: "Ứng viên",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.candidates.length}
      </span>
    )
  },
  {
    key: "expires_at",
    header: "Hết hạn",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.expires_at)}
      </span>
    )
  }
];
