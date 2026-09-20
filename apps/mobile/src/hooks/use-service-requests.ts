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
   */
  const scheduleNextPoll = useCallback(
    (requestId: string, phase: Phase) => {
      clearTimers();
      if (['searching', 'tracking'].includes(phase)) {
        pollTimerRef.current = setTimeout(async () => {
          const next = await refreshActive(requestId);
          if (next) scheduleNextPoll(requestId, next);
        }, POLL_REQUEST_MS);
      }
      if (phase === 'tracking' || phase === 'quote' || phase === 'payment') {
        etaTimerRef.current = setTimeout(async () => {
          await refreshActive(requestId);
          etaTimerRef.current = setTimeout(
            () => scheduleNextPoll(requestId, phase),
            POLL_ETA_MS,
          );
        }, POLL_ETA_MS);
        liveTimerRef.current = setTimeout(async () => {
          await refreshActive(requestId);
          liveTimerRef.current = setTimeout(
            () => scheduleNextPoll(requestId, phase),
            POLL_LIVE_MS,
          );
        }, POLL_LIVE_MS);
      }
    },
    [clearTimers, refreshActive],
  );

  const startRescue = useCallback<UseServiceRequestsReturn['startRescue']>(
    async ({ motorcycleId, problemDescription, location, addressText }) => {
      clearTimers();
      setActive({ ...INITIAL_SESSION, busy: true });
      try {
        const created = await apiCreateServiceRequest({
          motorcycle_id: motorcycleId,
          service_type: 'emergency_rescue',
          fulfillment_mode: 'immediate_location',
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
    [clearTimers, reloadList, scheduleNextPoll],
  );

  const scheduleMaintenance = useCallback<UseServiceRequestsReturn['scheduleMaintenance']>(
    async ({ motorcycleId, problemDescription, scheduledStartAt, maintenanceNotes }) => {
      clearTimers();
      setActive({ ...INITIAL_SESSION, busy: true });
      try {
        const created = await apiCreateServiceRequest({
          motorcycle_id: motorcycleId,
          service_type: 'periodic_maintenance',
          fulfillment_mode: 'scheduled_visit',
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
    [clearTimers, reloadList, scheduleNextPoll],
  );

  const cancel = useCallback<UseServiceRequestsReturn['cancel']>(
    async (reason) => {
      const { requestId } = active;
      if (!requestId) return;
      setActive((prev) => ({ ...prev, busy: true }));
      try {
        await apiCancelServiceRequest(requestId, reason);
        await refreshActive(requestId);
        await reloadList();
      } catch (e) {
        setActive((prev) => ({
          ...prev,
          lastError: e instanceof Error ? e.message : 'Không thể huỷ yêu cầu',
          busy: false,
        }));
      }
    },
    [active.requestId, refreshActive, reloadList], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const approveQuoteHandler = useCallback(async () => {
    const { requestId, quote } = active;
    if (!requestId || !quote) return;
    setActive((prev) => ({ ...prev, busy: true }));
    try {
      await approveQuote(quote.id);
      await refreshActive(requestId);
      await reloadList();
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
      approveQuoteHandler,
      rejectQuoteHandler,
      reset,
    ],
  );
}
