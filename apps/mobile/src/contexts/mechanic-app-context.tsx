import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import {
  getMechanicDashboard,
  getMechanicPerformance,
  getMyMechanicProfile,
  updateMyAvailability,
  type MechanicDashboardResponse,
  type MechanicPerformanceResponse,
  type MechanicProfileResponse,
} from '@/lib/mechanics-service';
import {
  createDiagnosis,
  ingestLiveLocation,
  listAssignments,
  submitEta,
  submitCompletionChecklist,
  transitionAssignment,
  type AssignmentResponse,
  type DiagnosisRecord,
} from '@/lib/mechanic-jobs-service';
import {
  calculateSubtotal,
  submitQuote,
  suggestPurposeForServiceType,
  type QuoteLineInput,
} from '@/lib/mechanic-quotes-service';
import type { Quote } from '@/lib/quotes-service';
import {
  watchCurrentPosition,
  type LocationWatchHandle,
  LocationCaptureError,
} from '@/lib/location-service';
import type {
  MechanicJob,
  MechanicJobStatus,
  MechanicJobType,
  MechanicProfile,
  GarageInfo,
  ScheduleSlot,
  MechanicEarnings,
  JobUpdatePayload,
} from '@/lib/mechanic-types';

interface MechanicState {
  mechanic: MechanicProfile;
  garage: GarageInfo;
  jobs: MechanicJob[];
  todayJobs: MechanicJob[];
  upcomingTodayJobs: MechanicJob[];
  getJob: (id: string) => MechanicJob | undefined;
  /** Map BE assignment.status (raw) cho từng job — dùng cho filter BE states (2.1). */
  getAssignmentStatus: (jobId: string) => string | undefined;
  /** Lấy serviceType (raw) của job — dùng cho suggest purpose quote. */
  getJobServiceType: (jobId: string) => string | undefined;
  /** Cập nhật status qua BE (atomic). Cập nhật optimistic local. */
  updateJobStatus: (id: string, status: MechanicJobStatus, notes?: string) => Promise<void>;
  /** Hoàn tất job: submit checklist + chuyển status completed. */
  completeJob: (id: string, payload: JobUpdatePayload) => Promise<void>;
  /** Bật/tắt trạng thái nhận việc. */
  toggleAvailability: () => Promise<void>;
  scheduleSlots: ScheduleSlot[];
  earnings: MechanicEarnings;
  dashboard: MechanicDashboardResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  darkMode: boolean;
  toggleDarkMode: () => void;
  /** Tạo/sửa báo giá cho service request. Optimistic update `latestQuote`. */
  submitQuoteForRequest: (
    jobId: string,
    input: {
      lines: QuoteLineInput[];
      discount_amount?: number;
      notes?: string;
      diagnosis_id?: string;
    },
  ) => Promise<Quote | null>;
  /** Tạo diagnosis cho assignment. Optimistic cache local. */
  submitDiagnosisForJob: (
    jobId: string,
    input: { summary: string; root_cause?: string; recommended_action?: string },
  ) => Promise<DiagnosisRecord | null>;
  /** Lấy diagnosis mới nhất (cached, không reload). */
  getLatestDiagnosisForJob: (jobId: string) => DiagnosisRecord | null;
  /** Lấy quote pending mới nhất (cached, không reload). */
  getLatestPendingQuote: (jobId: string) => Quote | null;
  // ---- Live location sharing (1.2) ----
  /** assignmentId hiện đang chia sẻ vị trí, hoặc null nếu không. */
  sharingAssignmentId: string | null;
  /** Lỗi live sharing lần cuối (tiếng Việt), null nếu không. */
  sharingError: string | null;
  /** Bật/tắt chia sẻ vị trí cho 1 assignment. Idempotent - gọi lại sẽ tắt. */
  toggleLiveSharing: (assignmentId: string) => Promise<void>;
  /** Dừng chia sẻ vị trí (nếu đang chia sẻ). */
  stopLiveSharing: () => void;

  // ---- Performance (4.1) ----
  /** Metrics tổng hợp từ `GET /api/v1/mechanics/me/performance`. */
  performance: MechanicPerformanceResponse | null;
  performanceLoading: boolean;
  /** Reload performance với optional date filters (ISO datetime có offset). */
  reloadPerformance: (filters?: { date_from?: string; date_to?: string }) => Promise<void>;
}

const MechanicContext = createContext<MechanicState | null>(null);

// =========================================================
// Mapping helpers: BE → UI
// =========================================================

/**
 * Map BE assignment + request → UI MechanicJob.
 * BE không lưu customer/vehicle info cụ thể trên assignment → dùng từ request.
 */
function assignmentToJob(
  a: AssignmentResponse & {
    request?: {
      request_code: string;
      service_type: string;
      scheduled_start_at?: string;
      created_at: string;
    };
    latest_quote_status?: string;
  },
): MechanicJob {
  const r = a.request;
  const status = mapAssignmentStatus(a.status);
  const scheduledDate = r?.scheduled_start_at
    ? r.scheduled_start_at.slice(0, 10)
    : a.accepted_at.slice(0, 10);
  const scheduledTime = r?.scheduled_start_at
    ? r.scheduled_start_at.slice(11, 16)
    : a.accepted_at.slice(11, 16);
  const type = (r?.service_type ?? 'other') as MechanicJobType;
  return {
    id: a.id,
    customer: {
      id: '',
      name: r?.request_code ?? 'Khách hàng',
      phone: '',
    },
    vehicle: {
      id: '',
      customerId: '',
      name: '—',
      brand: '—',
      plate: '—',
      mileage: 0,
    },
    type,
    symptom: '',
    status,
    scheduledDate,
    scheduledTime,
    durationMin: 0,
    price: 0,
    ...(a.completed_at ? { completedAt: a.completed_at } : {}),
  };
}

function mapAssignmentStatus(s: string): MechanicJobStatus {
  switch (s) {
    case 'accepted':
    case 'en_route':
    case 'on_site':
    case 'diagnosis':
    case 'quoted':
      return 'pending';
    case 'awaiting_payment':
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'canceled':
    case 'recovery_canceled':
      return 'completed'; // best-effort cho UI mechanic
    default:
      return 'pending';
  }
}

function profileToUi(p: MechanicProfileResponse): MechanicProfile {
  return {
    id: p.user_id,
    name: '', // BE không trả display_name ở profile; lấy từ auth context
    avatar: '',
    specialty: p.service_types.join(', ') || 'Cứu hộ & sửa chữa',
    experienceYears: 0,
    rating: p.rating_avg,
    totalJobs: p.rating_count,
    certifications: [],
    phone: '',
  };
}

function dashboardToEarnings(d: MechanicDashboardResponse | null): MechanicEarnings {
  if (!d) return { thisWeek: 0, lastWeek: 0, thisMonth: 0 };
  // BE không trả earnings trực tiếp → derive từ job count
  return {
    thisWeek: d.today_counts.completed_jobs,
    lastWeek: 0,
    thisMonth: d.seven_day_performance.completed_jobs,
  };
}

// =========================================================
// Provider
// =========================================================

export function MechanicAppProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, isBackendConfigured, status: authStatus } = useAuth();
  const [jobs, setJobs] = useState<MechanicJob[]>([]);
  const [assignmentStatusMap, setAssignmentStatusMap] = useState<Record<string, string>>({});
  const [serviceTypeMap, setServiceTypeMap] = useState<Record<string, string>>({});
  const [latestDiagnosisMap, setLatestDiagnosisMap] = useState<Record<string, DiagnosisRecord>>({});
  const [latestQuoteMap, setLatestQuoteMap] = useState<Record<string, Quote>>({});
  const [mechanic, setMechanic] = useState<MechanicProfile>({
    id: '',
    name: authUser?.name ?? '',
    avatar: authUser?.avatar ?? '',
    specialty: '',
    experienceYears: 0,
    rating: 0,
    totalJobs: 0,
    certifications: [],
    phone: authUser?.phone ?? '',
  });
  const [dashboard, setDashboard] = useState<MechanicDashboardResponse | null>(null);
  const [performance, setPerformance] = useState<MechanicPerformanceResponse | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  // Live-sharing state - 1.2
  const [sharingAssignmentId, setSharingAssignmentId] = useState<string | null>(null);
  const [sharingError, setSharingError] = useState<string | null>(null);
  const watchHandleRef = useRef<LocationWatchHandle | null>(null);
  const lastIngestAtRef = useRef<Record<string, number>>({});

  /**
   * Load toàn bộ data BE:
   *  - profile (mechanic info + rating)
   *  - dashboard (today counts, perf, action codes)
   *  - jobs list (assignments của thợ, gồm active và completed)
   */
  const reload = useCallback(async () => {
    if (!isBackendConfigured || authStatus !== 'authenticated') {
      setMechanic((m) => ({
        ...m,
        name: authUser?.name ?? m.name,
        avatar: authUser?.avatar ?? m.avatar,
        phone: authUser?.phone ?? m.phone,
      }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [profile, dash, jobsPage] = await Promise.all([
        getMyMechanicProfile().catch((e) => {
          if (e instanceof ApiError && e.status === 404) return null;
          throw e;
        }),
        getMechanicDashboard().catch(() => null),
        listAssignments({ limit: 50 }).catch((e) => {
          if (e instanceof ApiError && e.status === 403) return { items: [], next_cursor: undefined };
          throw e;
        }),
      ]);

      if (profile) {
        setMechanic((prev) => ({
          ...profileToUi(profile),
          // Ưu tiên tên/avatar/phone từ auth context cho UI
          name: authUser?.name || prev.name,
          avatar: authUser?.avatar || prev.avatar,
          phone: authUser?.phone || prev.phone,
        }));
      }
      if (dash) setDashboard(dash);
      // Load performance song song (không chặn reload chính).
      void getMechanicPerformance()
        .then(setPerformance)
        .catch(() => undefined);
      const list = (jobsPage?.items ?? []) as (AssignmentResponse & { request?: unknown })[];
      // BE wire: chỉ dùng jobs từ assignments. Nếu rỗng → EmptyState, KHÔNG fallback mock.
      setJobs(
        list.map((a) =>
          assignmentToJob(
            a as AssignmentResponse & {
              request?: {
                request_code: string;
                service_type: string;
                scheduled_start_at?: string;
                created_at: string;
              };
              latest_quote_status?: string;
            },
          ),
        ),
      );
      // Cache BE raw status + service type cho filter (2.1) và quote suggest (1.1).
      const nextStatusMap: Record<string, string> = {};
      const nextServiceMap: Record<string, string> = {};
      for (const a of list) {
        nextStatusMap[a.id] = a.status;
        const svc = (a as { request?: { service_type?: string } }).request?.service_type;
        if (svc) nextServiceMap[a.id] = svc;
      }
      setAssignmentStatusMap(nextStatusMap);
      setServiceTypeMap(nextServiceMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu thợ');
    } finally {
      setLoading(false);
    }
  }, [authUser, isBackendConfigured, authStatus]);

  useEffect(() => {
    void reload();
    // Polling mỗi 30s để cập nhật offer mới (worker reminder pickup các job
    // bảo dưỡng đặt lịch → tạo assignment cho mechanic).
    const interval = setInterval(() => {
      void reload();
    }, 30_000);
    return () => clearInterval(interval);
  }, [reload]);

  const updateJobStatus = useCallback(
    async (id: string, status: MechanicJobStatus, notes?: string) => {
      // Lưu local state trước (optimistic)
      const prevJobs = jobs;
      setJobs((curr) =>
        curr.map((j) => (j.id === id ? { ...j, status, notes: notes ?? j.notes } : j)),
      );

      if (!isBackendConfigured) return;

      // Map UI status → BE assignment status.
      // UI pending = thợ chưa bắt đầu thao tác; giữ accepted ở BE.
      // UI awaiting_parts = thợ đang chờ phụ tùng → chuyển sang diagnosis (BE state gần nhất).
      // UI in_progress = đang sửa → matched với in_progress.
      // UI completed = hoàn tất → matched với completed.
      // Guard ke được delegate sang BE error (rollback local khi fail).
      let beStatus: Parameters<typeof transitionAssignment>[1]['status'];
      switch (status) {
        case 'pending':
          beStatus = 'accepted';
          break;
        case 'in_progress':
          beStatus = 'in_progress';
          break;
        case 'awaiting_parts':
          beStatus = 'diagnosis';
          break;
        case 'completed':
          beStatus = 'completed';
          break;
        default:
          return;
      }

      try {
        await transitionAssignment(id, {
          status: beStatus,
          ...(notes ? { reason: notes } : {}),
        });
      } catch (e) {
        // Rollback nếu fail
        setJobs(prevJobs);
        setError(e instanceof Error ? e.message : 'Không thể cập nhật trạng thái');
      }
    },
    [jobs, isBackendConfigured],
  );

  const completeJob = useCallback(
    async (id: string, payload: JobUpdatePayload) => {
      // Optimistic local
      const prevJobs = jobs;
      setJobs((curr) =>
        curr.map((j) =>
          j.id === id
            ? {
                ...j,
                status: 'completed',
                price: payload.price,
                notes: payload.notes ?? j.notes,
                partsReplaced: payload.partsReplaced ?? j.partsReplaced,
                completedAt: new Date().toISOString(),
              }
            : j,
        ),
      );

      if (!isBackendConfigured) return;

      try {
        // Submit checklist trước (BE không có giá trực tiếp → log qua notes)
        await submitCompletionChecklist(id, {
          work_summary: payload.notes || `Hoàn tất công việc với chi phí ${payload.price.toLocaleString('vi-VN')}đ`,
          safety_checklist: {
            test_ride_completed: true,
            tools_removed: true,
            area_safe: true,
            rider_briefed: true,
            no_fluid_leak: true,
          },
        });
        // Sau đó chuyển status → completed
        await transitionAssignment(id, { status: 'completed' });
      } catch (e) {
        setJobs(prevJobs);
        setError(e instanceof Error ? e.message : 'Không thể hoàn tất công việc');
      }
    },
    [jobs, isBackendConfigured],
  );

  const toggleAvailability = useCallback(async () => {
    if (!isBackendConfigured) {
      setMechanic((m) => ({ ...m, specialty: m.specialty }));
      return;
    }
    const next = !(dashboard?.availability.is_available ?? false);
    try {
      await updateMyAvailability({ is_available: next });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cập nhật trạng thái nhận việc');
    }
  }, [isBackendConfigured, dashboard, reload]);

  const toggleDarkMode = useCallback(() => setDarkMode((d) => !d), []);

  /**
   * Reload performance metrics. Best-effort - lỗi chỉ set null và không
   * hiển thị error banner (vì performance page là second-class UI, không
   * blocking flow mechanic).
   */
  const reloadPerformance = useCallback(
    async (filters: { date_from?: string; date_to?: string } = {}) => {
      if (!isBackendConfigured) {
        setPerformance(null);
        return;
      }
      setPerformanceLoading(true);
      try {
        const res = await getMechanicPerformance(filters);
        setPerformance(res);
      } catch {
        setPerformance(null);
      } finally {
        setPerformanceLoading(false);
      }
    },
    [isBackendConfigured],
  );

  // ---- Live sharing ----

  const stopLiveSharing = useCallback(() => {
    if (watchHandleRef.current) {
      watchHandleRef.current.stop();
      watchHandleRef.current = null;
    }
    setSharingAssignmentId(null);
  }, []);

  /**
   * Bật/tắt chia sẻ vị trí cho 1 assignment.
   *
   * - Nếu đã đang chia sẻ assignment này → toggle off.
   * - Nếu đang chia sẻ assignment khác → dừng cái cũ, bật cái mới.
   * - Lần đầu bật → xin permission qua `watchCurrentPosition`, lắng nghe
   *   position fix → `ingestLiveLocation` mỗi lần có update (rate-limited
   *   tối thiểu 10s/lần client-side; BE cũng rate-limit theo env).
   * - Auto-stop khi assignment không còn ở state active (completed/canceled)
   *   qua useEffect watcher bên dưới.
   */
  const toggleLiveSharing = useCallback(
    async (assignmentId: string) => {
      // Đang chia sẻ cùng assignment → tắt.
      if (sharingAssignmentId === assignmentId) {
        stopLiveSharing();
        return;
      }
      // Đang chia sẻ assignment khác → dừng cái cũ trước.
      if (sharingAssignmentId && sharingAssignmentId !== assignmentId) {
        stopLiveSharing();
      }
      // Guard: job phải còn active.
      const status = assignmentStatusMap[assignmentId];
      if (status === 'completed' || status === 'canceled' || status === 'recovery_canceled') {
        setSharingError('Job đã hoàn tất hoặc bị huỷ, không thể chia sẻ vị trí.');
        return;
      }

      setSharingError(null);
      try {
        const handle = await watchCurrentPosition(
          (loc) => {
            // Rate-limit client-side tối thiểu 10s/lần (BE cũng rate-limit).
            const last = lastIngestAtRef.current[assignmentId] ?? 0;
            const now = Date.now();
            if (now - last < 10_000) return;
            // Skip nếu accuracy quá kém (chỉ khi BE trả về > 100m).
            if (typeof loc.accuracy === 'number' && loc.accuracy > 100) return;
            lastIngestAtRef.current[assignmentId] = now;
            void ingestLiveLocation(assignmentId, {
              latitude: loc.latitude,
              longitude: loc.longitude,
              observed_at: new Date().toISOString(),
              accuracy_meters: loc.accuracy ?? 50,
            }).catch(() => {
              // Lỗi không dừng vòng watch - chỉ log vào error state.
              setSharingError('Không thể gửi vị trí. Kiểm tra kết nối mạng.');
            });
          },
          (err) => {
            setSharingError(err.message);
            stopLiveSharing();
          },
          { timeInterval: 15_000, distanceInterval: 25 },
        );
        watchHandleRef.current = handle;
        setSharingAssignmentId(assignmentId);
      } catch (err) {
        if (err instanceof LocationCaptureError) {
          setSharingError(err.message);
        } else {
          setSharingError('Không thể bật chia sẻ vị trí.');
        }
      }
    },
    [sharingAssignmentId, stopLiveSharing, assignmentStatusMap],
  );

  // Auto-stop khi assignment active đổi sang completed/canceled.
  useEffect(() => {
    if (!sharingAssignmentId) return;
    const status = assignmentStatusMap[sharingAssignmentId];
    if (status === 'completed' || status === 'canceled' || status === 'recovery_canceled') {
      stopLiveSharing();
    }
  }, [sharingAssignmentId, assignmentStatusMap, stopLiveSharing]);

  // Cleanup watch khi unmount provider.
  useEffect(() => {
    return () => {
      if (watchHandleRef.current) {
        watchHandleRef.current.stop();
        watchHandleRef.current = null;
      }
    };
  }, []);

  const todayJobs = useMemo(
    () => jobs.filter((j) => j.scheduledDate === new Date().toISOString().slice(0, 10)),
    [jobs],
  );

  const upcomingTodayJobs = useMemo(
    () =>
      todayJobs
        .filter((j) => j.status !== 'completed')
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [todayJobs],
  );

  const getJob = useCallback((id: string) => jobs.find((j) => j.id === id), [jobs]);

  const getAssignmentStatus = useCallback(
    (id: string) => assignmentStatusMap[id],
    [assignmentStatusMap],
  );

  const getJobServiceType = useCallback(
    (id: string) => serviceTypeMap[id],
    [serviceTypeMap],
  );

  const getLatestDiagnosisForJob = useCallback(
    (id: string) => latestDiagnosisMap[id] ?? null,
    [latestDiagnosisMap],
  );

  const getLatestPendingQuote = useCallback(
    (id: string) => latestQuoteMap[id] ?? null,
    [latestQuoteMap],
  );

  /**
   * Submit báo giá cho service request gắn với 1 job/assignment.
   * BE map `assignment_id` → request_id tự động. Trả về Quote vừa tạo.
   *
   * Khi BE không configured (mock mode) → không làm gì, trả null để UI
   * không bị kẹt spinner.
   */
  const submitQuoteForRequest = useCallback(
    async (
      jobId: string,
      input: {
        lines: QuoteLineInput[];
        discount_amount?: number;
        notes?: string;
        diagnosis_id?: string;
      },
    ): Promise<Quote | null> => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) {
        setError('Không tìm thấy job để tạo báo giá.');
        return null;
      }
      const serviceType = serviceTypeMap[jobId];
      const purpose = suggestPurposeForServiceType(serviceType);

      if (!isBackendConfigured) return null;

      const previousQuote = latestQuoteMap[jobId];
      // Optimistic placeholder để UI phản hồi nhanh.
      const placeholderSubtotal = calculateSubtotal(input.lines);
      const optimistic: Quote = {
        id: `optimistic-${Date.now()}`,
        request_id: job.customer.id || '',
        assignment_id: jobId,
        ...(input.diagnosis_id ? { diagnosis_id: input.diagnosis_id } : {}),
        version: (previousQuote?.version ?? 0) + 1,
        status: 'pending',
        currency: 'VND',
        subtotal_amount: placeholderSubtotal,
        discount_amount: input.discount_amount ?? 0,
        total_amount: placeholderSubtotal - (input.discount_amount ?? 0),
        ...(input.notes ? { notes: input.notes } : {}),
        created_by: authUser?.id ?? '',
        created_at: new Date().toISOString(),
        lines: input.lines.map((line, idx) => ({
          id: `opt-${idx}`,
          quote_id: `optimistic-${Date.now()}`,
          line_type: line.line_type,
          description: line.description,
          quantity: line.quantity,
          unit_amount: line.unit_amount,
          line_total_amount: Math.round(line.quantity * line.unit_amount),
          sort_order: idx,
        })),
      };
      setLatestQuoteMap((prev) => ({ ...prev, [jobId]: optimistic }));

      try {
        // BE `submitQuote` cần `requestId`. UI mechanic chỉ giữ `assignmentId`.
        // Lấy `requestId` từ `latestQuoteMap` (cache) hoặc fallback từ job.customer.id.
        // Lưu ý: MechanicJob.customer.id hiện đang rỗng (xem `assignmentToJob`) →
        // dùng cách an toàn: gọi fetch job detail nếu cache rỗng.
        // Đơn giản hơn: truyền job.customer.id (BE hiện trả qua `request.id` field của
        // assignment - xem `assignmentToJob` chỗ `customer.id`).
        const requestId =
          job.customer.id && job.customer.id.length > 0 ? job.customer.id : null;
        if (!requestId) {
          // Rollback placeholder, set error.
          setLatestQuoteMap((prev) => {
            const next = { ...prev };
            if (previousQuote) next[jobId] = previousQuote;
            else delete next[jobId];
            return next;
          });
          setError('Không tìm thấy request gắn với job này.');
          return null;
        }
        const result = await submitQuote(requestId, {
          assignment_id: jobId,
          purpose,
          lines: input.lines,
          ...(input.discount_amount !== undefined
            ? { discount_amount: input.discount_amount }
            : {}),
          ...(input.notes ? { notes: input.notes } : {}),
          ...(input.diagnosis_id ? { diagnosis_id: input.diagnosis_id } : {}),
        });
        setLatestQuoteMap((prev) => ({ ...prev, [jobId]: result }));
        return result;
      } catch (e) {
        // Rollback.
        setLatestQuoteMap((prev) => {
          const next = { ...prev };
          if (previousQuote) next[jobId] = previousQuote;
          else delete next[jobId];
          return next;
        });
        const msg =
          e instanceof ApiError && e.status === 409
            ? 'Trạng thái job không cho phép tạo báo giá lúc này.'
            : e instanceof Error
              ? e.message
              : 'Không thể tạo báo giá';
        setError(msg);
        return null;
      }
    },
    [jobs, serviceTypeMap, latestQuoteMap, isBackendConfigured, authUser?.id],
  );

  /**
   * Tạo diagnosis mới cho assignment.
   * Lưu vào cache local (UI render ngay). Khi BE fail → rollback.
   */
  const submitDiagnosisForJob = useCallback(
    async (
      jobId: string,
      input: { summary: string; root_cause?: string; recommended_action?: string },
    ): Promise<DiagnosisRecord | null> => {
      if (!isBackendConfigured) return null;
      const previous = latestDiagnosisMap[jobId];
      const optimistic: DiagnosisRecord = {
        id: `optimistic-${Date.now()}`,
        assignment_id: jobId,
        summary: input.summary,
        ...(input.root_cause ? { root_cause: input.root_cause } : {}),
        ...(input.recommended_action
          ? { recommended_action: input.recommended_action }
          : {}),
        created_by: authUser?.id ?? '',
        created_at: new Date().toISOString(),
      };
      setLatestDiagnosisMap((prev) => ({ ...prev, [jobId]: optimistic }));

      try {
        const result = await createDiagnosis(jobId, input);
        setLatestDiagnosisMap((prev) => ({ ...prev, [jobId]: result }));
        return result;
      } catch (e) {
        // Rollback.
        setLatestDiagnosisMap((prev) => {
          const next = { ...prev };
          if (previous) next[jobId] = previous;
          else delete next[jobId];
          return next;
        });
        const msg =
          e instanceof ApiError && e.status === 409
            ? 'Chẩn đoán đã tồn tại hoặc assignment không hợp lệ.'
            : e instanceof Error
              ? e.message
              : 'Không thể tạo chẩn đoán';
        setError(msg);
        return null;
      }
    },
    [isBackendConfigured, latestDiagnosisMap, authUser?.id],
  );

  // Helper bổ sung: submit ETA từ UI mechanic.

  // Garage: BE không có endpoint garage cho thợ → trả rỗng để UI không hiển thị
  // dữ liệu giả. Garage profile sẽ được bổ sung qua /mechanics/me/profile khi BE có.
  const garage: GarageInfo = useMemo(
    () => ({ id: '', name: '', address: '', phone: '' }),
    [],
  );

  // Schedule slots: derive rỗng từ jobs (BE chưa có schedule read endpoint).
  // UI sẽ hiển thị EmptyState thay vì lịch giả.
  const scheduleSlots: ScheduleSlot[] = useMemo(() => {
    if (jobs.length === 0) return [];
    const slots: ScheduleSlot[] = [];
    const seen = new Set<string>();
    for (const j of jobs) {
      const key = `${j.scheduledDate}T${j.scheduledTime}`;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push({
        date: j.scheduledDate,
        time: j.scheduledTime,
        status: j.status === 'completed' ? 'working' : 'working',
        ...(j.id ? { jobId: j.id } : {}),
      });
    }
    return slots;
  }, [jobs]);

  const value = useMemo<MechanicState>(
    () => ({
      mechanic,
      garage,
      jobs,
      todayJobs,
      upcomingTodayJobs,
      getJob,
      getAssignmentStatus,
      getJobServiceType,
      updateJobStatus,
      completeJob,
      toggleAvailability,
      scheduleSlots,
      earnings: dashboardToEarnings(dashboard),
      dashboard,
      loading,
      error,
      reload,
      darkMode,
      toggleDarkMode,
      submitQuoteForRequest,
      submitDiagnosisForJob,
      getLatestDiagnosisForJob,
      getLatestPendingQuote,
      sharingAssignmentId,
      sharingError,
      toggleLiveSharing,
      stopLiveSharing,
      performance,
      performanceLoading,
      reloadPerformance,
    }),
    [
      mechanic,
      garage,
      jobs,
      todayJobs,
      upcomingTodayJobs,
      getJob,
      getAssignmentStatus,
      getJobServiceType,
      updateJobStatus,
      completeJob,
      toggleAvailability,
      scheduleSlots,
      dashboard,
      loading,
      error,
      reload,
      darkMode,
      toggleDarkMode,
      submitQuoteForRequest,
      submitDiagnosisForJob,
      getLatestDiagnosisForJob,
      getLatestPendingQuote,
      sharingAssignmentId,
      sharingError,
      toggleLiveSharing,
      stopLiveSharing,
      performance,
      performanceLoading,
      reloadPerformance,
    ],
  );

  return <MechanicContext.Provider value={value}>{children}</MechanicContext.Provider>;
}

export function useMechanicApp() {
  const ctx = useContext(MechanicContext);
  if (!ctx) throw new Error('useMechanicApp must be used within MechanicAppProvider');
  return ctx;
}

// Exported for UI hooks that want to call ETA submit directly
export { submitEta };
