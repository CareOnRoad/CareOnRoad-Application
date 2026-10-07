/**
 * useServiceRequests — hook quản lý state của rider service-requests.
 *
 * Quản lý:
 *  - List service-requests của rider (phân loại theo status).
 *  - Active request (đang theo dõi) + polling.
 *  - Offers (mechanic candidates) của active round.
 *  - Quote pending của active request.
 *  - Assignment của active request.
 *  - ETA + live location cho assignment active.
 *
 * Polling intervals:
 *  - Polling request status mỗi 5s khi `phase in [searching, tracking]`
 *  - Polling ETA mỗi 30s khi có assignment active
 *  - Polling live location mỗi 15s khi assignment active
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  cancelServiceRequest as apiCancelServiceRequest,
  createServiceRequest as apiCreateServiceRequest,
  getServiceRequest,
  listServiceRequests,
  startDispatch as apiStartDispatch,
  statusToPhase,
  type ServiceRequestResponse,
} from '@/lib/service-requests-service';
import { getRouteEta, getLiveLocation } from '@/lib/assignments-service';
import { getLatestPendingQuote, approveQuote, rejectQuote, type Quote } from '@/lib/quotes-service';
import { listAssignments, type AssignmentListItem } from '@/lib/assignments-service';
import { useActiveRequest } from '@/contexts/active-request-context';
import type { DispatchRoundResponse, RouteEtaResponse } from '@/lib/service-requests-service';
import type { LiveLocationResponse } from '@/lib/assignments-service';

export type Phase = 'idle' | 'searching' | 'tracking' | 'quote' | 'payment' | 'completed' | 'canceled';

export interface ActiveSession {
  requestId: string;
  phase: Phase;
  request: ServiceRequestResponse | null;
  round: DispatchRoundResponse | null;
  assignment: AssignmentListItem | null;
  quote: Quote | null;
  eta: RouteEtaResponse | null;
  liveLocation: LiveLocationResponse | null;
  lastError: string | null;
  busy: boolean;
}

const POLL_REQUEST_MS = 5000;
const POLL_ETA_MS = 30000;
const POLL_LIVE_MS = 15000;

const INITIAL_SESSION: ActiveSession = {
  requestId: '',
  phase: 'idle',
  request: null,
  round: null,
  assignment: null,
  quote: null,
  eta: null,
  liveLocation: null,
  lastError: null,
  busy: false,
};

interface UseServiceRequestsReturn {
  list: ServiceRequestResponse[];
  listLoading: boolean;
  listError: string | null;
  reloadList: () => Promise<void>;
  active: ActiveSession;
  /** Bắt đầu flow cứu hộ: tạo service-request rồi dispatch. */
  startRescue: (input: {
    motorcycleId: string;
    problemDescription: string;
    location?: { latitude: number; longitude: number };
    addressText?: string;
  }) => Promise<void>;
  /** Bắt đầu booking maintenance: tạo service-request scheduled_visit. */
  scheduleMaintenance: (input: {
    motorcycleId: string;
    problemDescription: string;
    scheduledStartAt: string;
    maintenanceNotes?: string;
  }) => Promise<void>;
  /** Huỷ request hiện tại. */
  cancel: (reason: string) => Promise<void>;
  /** Huỷ 1 request cụ thể qua id (dùng từ danh sách, không cần đang tracking). */
  cancelById: (requestId: string, reason: string) => Promise<void>;
  /** Duyệt báo giá. */
  approveQuote: () => Promise<void>;
  /** Từ chối báo giá. */
  rejectQuote: (reason?: string) => Promise<void>;
  /** Reset session (cho về idle). */
  reset: () => void;
}

export function useServiceRequests(): UseServiceRequestsReturn {
  const [list, setList] = useState<ServiceRequestResponse[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveSession>(INITIAL_SESSION);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const etaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist request đang theo dõi qua AsyncStorage. Đây là nguồn sự thật
  // duy nhất — mọi screen gọi `useServiceRequests()` đều thấy cùng giá trị,
  // và giá trị sống qua app restart. Xem `active-request-context.tsx`.
  const { activeRequestId, hydrated: activeHydrated, setActiveRequest, clearActiveRequest } =
    useActiveRequest();

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (etaTimerRef.current) clearTimeout(etaTimerRef.current);
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    pollTimerRef.current = null;
    etaTimerRef.current = null;
    liveTimerRef.current = null;
  }, []);

  const reloadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const items = await listServiceRequests();
      setList(items);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Không thể tải danh sách yêu cầu');
    } finally {
      setListLoading(false);
    }
  }, []);

  /**
   * Refresh active session (status, assignment, quote).
   * Gọi định kỳ khi phase in [searching, tracking, quote, payment].
   */
  const refreshActive = useCallback(async (requestId: string) => {
    try {
      const request = await getServiceRequest(requestId);
      const phase = statusToPhase(request.status);

      // Assignment từ list filtered theo request_id
      let assignment: AssignmentListItem | null = null;
      try {
        const listRes = await listAssignments({ active_only: true, limit: 50 });
        assignment = listRes.items.find((a) => a.request_id === requestId) ?? null;
      } catch {
        assignment = null;
      }

      let quote: Quote | null = null;
      try {
        quote = await getLatestPendingQuote(requestId);
      } catch {
        quote = null;
      }

      let eta: RouteEtaResponse | null = null;
      let liveLocation: LiveLocationResponse | null = null;
      if (assignment) {
        try {
          eta = await getRouteEta(assignment.id);
        } catch {
          eta = null;
        }
        try {
          liveLocation = await getLiveLocation(assignment.id);
        } catch {
          liveLocation = null;
        }
      }

      setActive((prev) => ({
        ...prev,
        phase,
        request,
        assignment,
        quote,
        eta,
        liveLocation,
        lastError: null,
      }));

      return phase;
    } catch (e) {
      setActive((prev) => ({
        ...prev,
        lastError: e instanceof Error ? e.message : 'Không thể cập nhật trạng thái',
      }));
      return null;
    }
  }, []);

  /**
   * Schedule tiếp theo: nếu cần polling, đặt timer.
   *
   * Polling matrix:
   *  - request status: mỗi 5s khi searching/tracking/quote/payment/completed (đợi các transition)
   *  - ETA: mỗi 30s khi có assignment active (tracking/quote/payment/completed)
   *  - live-location: mỗi 15s khi assignment active
   *
   * completed/canceled chỉ poll 1 lần rồi dừng (sau ~5s) để chốt state.
   */
  const scheduleNextPoll = useCallback(
    (requestId: string, phase: Phase) => {
      clearTimers();
      // Request status polling — luôn chạy cho mọi phase active
      if (['searching', 'tracking', 'quote', 'payment', 'completed'].includes(phase)) {
        pollTimerRef.current = setTimeout(async () => {
          const next = await refreshActive(requestId);
          if (next && ['searching', 'tracking', 'quote', 'payment', 'completed'].includes(next)) {
            scheduleNextPoll(requestId, next);
          }
        }, POLL_REQUEST_MS);
      }
      // ETA + live-location chỉ khi có assignment active
      if (['tracking', 'quote', 'payment', 'completed'].includes(phase)) {
        etaTimerRef.current = setTimeout(async () => {
          await refreshActive(requestId);
          if (['tracking', 'quote', 'payment', 'completed'].includes(phase)) {
            etaTimerRef.current = setTimeout(
              () => scheduleNextPoll(requestId, phase),
              POLL_ETA_MS,
            );
          }
        }, POLL_ETA_MS);
        liveTimerRef.current = setTimeout(async () => {
          await refreshActive(requestId);
          if (['tracking', 'quote', 'payment', 'completed'].includes(phase)) {
            liveTimerRef.current = setTimeout(
              () => scheduleNextPoll(requestId, phase),
              POLL_LIVE_MS,
            );
          }
        }, POLL_LIVE_MS);
      }
    },
    [clearTimers, refreshActive],
  );

  /**
   * Hydrate session từ AsyncStorage khi app mở lại.
   *
   * `ActiveRequestProvider` mirror `activeRequestId` sang AsyncStorage, nên sau
   * khi app restart rider vẫn thấy request đang chạy (thợ đã nhận / chờ báo
   * giá / chờ thanh toán) thay vì màn hình trống.
   *
   * Chỉ chạy 1 lần sau khi AsyncStorage đọc xong (`activeHydrated`) và chỉ
   * khi session local vẫn `idle` — tránh ghi đè một flow đang diễn ra.
   */
  useEffect(() => {
    if (!activeHydrated) return;
    if (!activeRequestId) return;
    if (active.requestId === activeRequestId) return;
    // Session local đang theo dõi request khác → không hydrate đè lên.
    if (active.requestId) return;
    void (async () => {
      try {
        const request = await getServiceRequest(activeRequestId);
        setActive({
          ...INITIAL_SESSION,
          requestId: request.id,
          request,
          phase: statusToPhase(request.status),
        });
        await refreshActive(activeRequestId);
        const phase = statusToPhase(request.status);
        if (['searching', 'tracking', 'quote', 'payment', 'completed'].includes(phase)) {
          scheduleNextPoll(activeRequestId, phase);
        }
      } catch {
        // Request không còn tồn tại (đã xoá ở máy khác / BE reset) → xoá persist.
        clearActiveRequest();
      }
    })();
  }, [
    activeHydrated,
    activeRequestId,
    active.requestId,
    clearActiveRequest,
    refreshActive,
    scheduleNextPoll,
  ]);

  const startRescue = useCallback<UseServiceRequestsReturn['startRescue']>(
    async ({ motorcycleId, problemDescription, location, addressText }) => {
      clearTimers();
      setActive({ ...INITIAL_SESSION, busy: true });
      try {
        // BE: `emergency_rescue` thuộc nhóm fixed-mode (chỉ `other` mới nhận
        // `fulfillment_mode`). Địa điểm xác định bằng `location`/`address_text`.
        // Gửi `fulfillment_mode` sẽ bị BE trả 400 INVALID_INPUT.
        const created = await apiCreateServiceRequest({
          motorcycle_id: motorcycleId,
          service_type: 'emergency_rescue',
          problem_description: problemDescription,
          ...(location ? { location } : {}),
          ...(addressText ? { address_text: addressText } : {}),
        });
        setActive({
          ...INITIAL_SESSION,
          requestId: created.id,
          request: created,
          phase: 'searching',
          busy: true,
        });
        // Persist request id → app restart vẫn vào lại được màn hình này.
        setActiveRequest(created.id);
        // Auto-start dispatch
        try {
          const round = await apiStartDispatch(created.id);
          setActive((prev) => ({ ...prev, round, busy: false }));
        } catch (e) {
          setActive((prev) => ({
            ...prev,
            lastError: e instanceof Error ? e.message : 'Không thể ghép thợ',
            busy: false,
          }));
        }
        // Begin polling
        await reloadList();
        scheduleNextPoll(created.id, 'searching');
      } catch (e) {
        setActive((prev) => ({
          ...prev,
          lastError: e instanceof Error ? e.message : 'Không thể tạo yêu cầu cứu hộ',
          busy: false,
        }));
      }
    },
    [clearTimers, reloadList, scheduleNextPoll, setActiveRequest],
  );

  const scheduleMaintenance = useCallback<UseServiceRequestsReturn['scheduleMaintenance']>(
    async ({ motorcycleId, problemDescription, scheduledStartAt, maintenanceNotes }) => {
      clearTimers();
      setActive({ ...INITIAL_SESSION, busy: true });
      try {
        // BE: `periodic_maintenance` thuộc nhóm fixed-mode (chỉ `other` mới nhận
        // `fulfillment_mode`). Lịch hẹn xác định bằng `scheduled_start_at`.
        // Gửi `fulfillment_mode` sẽ bị BE trả 400 INVALID_INPUT.
        const created = await apiCreateServiceRequest({
          motorcycle_id: motorcycleId,
          service_type: 'periodic_maintenance',
          problem_description: problemDescription,
          scheduled_start_at: scheduledStartAt,
          ...(maintenanceNotes ? { maintenance_notes: maintenanceNotes } : {}),
        });
        setActive({
          ...INITIAL_SESSION,
          requestId: created.id,
          request: created,
          phase: 'searching',
          busy: false,
        });
        // Persist request id → app restart vẫn vào lại được màn hình này.
        setActiveRequest(created.id);
        await reloadList();
        // Không tự dispatch — scheduled request sẽ được worker tự động dispatch
        // khi tới giờ (xem AGENTS.md "reminder-originated periodic-maintenance").
        // Vẫn schedule poll nhẹ để update status khi worker chạy.
        scheduleNextPoll(created.id, 'searching');
      } catch (e) {
        setActive((prev) => ({
          ...prev,
          lastError: e instanceof Error ? e.message : 'Không thể đặt lịch bảo dưỡng',
          busy: false,
        }));
      }
    },
    [clearTimers, reloadList, scheduleNextPoll, setActiveRequest],
  );

  const cancel = useCallback<UseServiceRequestsReturn['cancel']>(
    async (reason) => {
      const requestId = active.requestId;
      if (!requestId) return;
      setActive((prev) => ({ ...prev, busy: true }));
      try {
        await apiCancelServiceRequest(requestId, reason);
        // Huỷ xong thì không còn request "đang chạy" → xoá persist.
        clearActiveRequest();
        await refreshActive(requestId);
        await reloadList();
        setActive((prev) => ({ ...prev, busy: false }));
      } catch (e) {
        setActive((prev) => ({
          ...prev,
          lastError: e instanceof Error ? e.message : 'Không thể huỷ yêu cầu',
          busy: false,
        }));
      }
    },
    [active.requestId, refreshActive, reloadList, clearActiveRequest],
  );

  /**
   * Huỷ 1 request bất kỳ qua id. Dùng cho danh sách maintenance / history.
   * Không cần request đang được tracking ở active session.
   */
  const cancelById = useCallback<UseServiceRequestsReturn['cancelById']>(
    async (requestId, reason) => {
      await apiCancelServiceRequest(requestId, reason);
      // Nếu huỷ đúng request đang theo dõi thì xoá persist.
      if (requestId === activeRequestId) clearActiveRequest();
      await reloadList();
    },
    [reloadList, activeRequestId, clearActiveRequest],
  );

  const approveQuoteHandler = useCallback(async () => {
    const { requestId, quote } = active;
    if (!requestId || !quote) return;
    setActive((prev) => ({ ...prev, busy: true }));
    try {
      await approveQuote(quote.id);
      await refreshActive(requestId);
      await reloadList();
      setActive((prev) => ({ ...prev, busy: false }));
    } catch (e) {
      setActive((prev) => ({
        ...prev,
        lastError: e instanceof Error ? e.message : 'Không thể duyệt báo giá',
        busy: false,
      }));
    }
  }, [active, refreshActive, reloadList]);

  const rejectQuoteHandler = useCallback<UseServiceRequestsReturn['rejectQuote']>(
    async (reason) => {
      const { requestId, quote } = active;
      if (!requestId || !quote) return;
      setActive((prev) => ({ ...prev, busy: true }));
      try {
        await rejectQuote(quote.id, reason);
        await refreshActive(requestId);
        setActive((prev) => ({ ...prev, busy: false }));
      } catch (e) {
        setActive((prev) => ({
          ...prev,
          lastError: e instanceof Error ? e.message : 'Không thể từ chối báo giá',
          busy: false,
        }));
      }
    },
    [active, refreshActive],
  );

  const reset = useCallback(() => {
    clearTimers();
    setActive(INITIAL_SESSION);
    // KHÔNG xoá `activeRequestId` ở đây.
    //
    // `reset()` được gọi khi rider bấm "Quay lại" trên màn hình tracking để
    // dọn session cũ (đã render xong). Xoá persist ở đây sẽ khiến rider mất
    // đường quay lại request đang chạy — đúng thứ họ cần giữ. Persist chỉ bị
    // xoá khi request thực sự kết thúc (cancel) hoặc không còn tồn tại ở BE.
  }, [clearTimers]);

  // Cleanup timers khi unmount
  useEffect(() => clearTimers, [clearTimers]);

  return useMemo<UseServiceRequestsReturn>(
    () => ({
      list,
      listLoading,
      listError,
      reloadList,
      active,
      startRescue,
      scheduleMaintenance,
      cancel,
      cancelById,
      approveQuote: approveQuoteHandler,
      rejectQuote: rejectQuoteHandler,
      reset,
    }),
    [
      list,
      listLoading,
      listError,
      reloadList,
      active,
      startRescue,
      scheduleMaintenance,
      cancel,
      cancelById,
      approveQuoteHandler,
      rejectQuoteHandler,
      reset,
    ],
  );
}
