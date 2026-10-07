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
  updateMyLocation,
  type MechanicDashboardResponse,
  type MechanicPerformanceResponse,
  type MechanicProfileResponse,
} from '@/lib/mechanics-service';
import {
  createDiagnosis,
  getJobDetail as fetchJobDetail,
  listAssignments,
  listDiagnoses as fetchDiagnosisHistory,
  submitEta,
  submitCompletionChecklist,
  transitionAssignment,
  type AssignmentResponse,
  type DiagnosisRecord,
  type MechanicJobDetailResponse,
} from '@/lib/mechanic-jobs-service';
import { ingestLiveLocation } from '@/lib/assignments-service';
import {
  calculateSubtotal,
  submitQuote,
  suggestPurposeForServiceType,
  type QuoteLineInput,
} from '@/lib/mechanic-quotes-service';
import type { Quote } from '@/lib/quotes-service';
import {
  watchCurrentPosition,
  startAutoTracking,
  startAvailabilityHeartbeat,
  type LocationWatchHandle,
  type AutoTrackingHandle,
  type AvailabilityHeartbeatHandle,
  LocationCaptureError,
  isLocationPermissionGranted,
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
  /**
   * Chi tiết job đầy đủ từ `GET /api/v1/mechanics/me/jobs/{id}`:
   * problem description, motorcycle, latest quote, completion checklist.
   * `null` nếu chưa load hoặc load fail (403/404).
   */
  jobDetail: (jobId: string) => MechanicJobDetailResponse | null;
  jobDetailLoading: boolean;
  /** Fetch (hoặc refetch) chi tiết 1 job. Safe no-op nếu BE chưa configured. */
  loadJobDetail: (jobId: string) => Promise<MechanicJobDetailResponse | null>;
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
  /** Lấy lịch sử tất cả diagnosis versions cho job (latest first). */
  getDiagnosisHistoryForJob: (jobId: string) => DiagnosisRecord[];
  /** Lazy load + cache lịch sử diagnosis từ BE. Best-effort. */
  loadDiagnosisHistory: (jobId: string) => Promise<DiagnosisRecord[]>;
  /** Lấy quote pending mới nhất (cached, không reload). */
  getLatestPendingQuote: (jobId: string) => Quote | null;
  // ---- Live location sharing (1.2 + auto parity) ----
  /** assignmentId hiện đang chia sẻ vị trí, hoặc null nếu không. */
  sharingAssignmentId: string | null;
  /** Lỗi live sharing lần cuối (tiếng Việt), null nếu không. */
  sharingError: string | null;
  /**
   * Permission foreground location đã được user cấp hay chưa.
   * - `true`: đã grant; auto-tracking có thể chạy.
   * - `false`: chưa grant / bị deny; auto-tracking bị skip và UI nên
   *   hiển thị nút "Mở cài đặt vị trí".
   */
  locationPermissionGranted: boolean;
  /** Bật/tắt thủ công chia sẻ vị trí cho 1 assignment. Idempotent. */
  toggleLiveSharing: (assignmentId: string) => Promise<void>;
  /** Bật chia sẻ vị trí (no-op nếu đã chạy cho assignment đó). */
  startLiveSharing: (assignmentId: string) => Promise<void>;
  /** Dừng chia sẻ vị trí (nếu đang chia sẻ). */
  stopLiveSharing: () => void;

  // ---- Performance (4.1) ----
  /** Metrics tổng hợp từ `GET /api/v1/mechanics/me/performance`. */
  performance: MechanicPerformanceResponse | null;
  performanceLoading: boolean;
  /** Reload performance với optional date filters (ISO datetime có offset). */
  reloadPerformance: (filters?: { date_from?: string; date_to?: string }) => Promise<void>;
  /**
   * Auto-tracking preference (persisted in-memory cho phiên hiện tại).
   * Khi `true` (default), provider tự động start ingest cho assignment
   * mới vào travel state. Khi `false`, user phải bấm toggle thủ công.
   */
  autoTrackingEnabled: boolean;
  setAutoTrackingEnabled: (enabled: boolean) => void;
}

const MechanicContext = createContext<MechanicState | null>(null);

// =========================================================
// Status helpers
// =========================================================

/**
 * Danh sách assignment status mà BE whitelist cho live-location ingest.
 * Phải khớp `TRACKING_STATUSES` trong
 * `apps/api/src/features/live-tracking/live-tracking.service.ts`.
 */
const LIVE_TRACKING_STATUSES = new Set<string>(['accepted', 'en_route']);

// =========================================================
// Mapping helpers: BE → UI
// =========================================================

/**
 * Map BE assignment + request → UI MechanicJob.
 *
 * Nguồn dữ liệu: `GET /api/v1/assignments` trả
 * `AssignmentResponse & { request?: {...} }`. Field `request` là optional
 * và **không** chứa rider identity — xem `mechanic-job-list.service.ts`
 * → `getJob()` (endpoint riêng `/mechanics/me/jobs/{id}`) cho job detail
 * đầy đủ gồm `problem_description`, `motorcycle`, `latest_quote`.
 *
 * Vì vậy:
 *  - `customer` = placeholder an toàn, không chứa PII (BE không expose).
 *  - `symptom` = `request.problem_description` (nếu list có trả).
 *  - `vehicle` = placeholder; thật sự nằm ở job detail.
 */
function assignmentToJob(
  a: AssignmentResponse & {
    request?: {
      request_code: string;
      service_type: string;
      scheduled_start_at?: string;
      created_at: string;
      problem_description?: string;
      address_text?: string;
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
      // Không có rider identity trong list response — dùng mã yêu cầu làm
      // nhãn nhận diện an toàn (không PII).
      id: '',
      name: r?.request_code ?? 'Yêu cầu cứu hộ',
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
    symptom: r?.problem_description ?? '',
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
      // Trước đây map về 'completed' để "best-effort cho UI mechanic"
      // nhưng khiến user thấy "Hoàn tất" thay vì "Đã huỷ". Giờ render đúng
      // status canceled với tone neutral để thợ phân biệt được.
      return 'canceled';
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
  const [requestIdMap, setRequestIdMap] = useState<Record<string, string>>({});
  const [jobDetailMap, setJobDetailMap] = useState<Record<string, MechanicJobDetailResponse>>({});
  const [jobDetailLoadingId, setJobDetailLoadingId] = useState<string | null>(null);
  const [latestDiagnosisMap, setLatestDiagnosisMap] = useState<Record<string, DiagnosisRecord>>({});
  const [diagnosisHistoryMap, setDiagnosisHistoryMap] = useState<Record<string, DiagnosisRecord[]>>({});
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
  // Live-sharing state - 1.2 + auto parity
  const [sharingAssignmentId, setSharingAssignmentId] = useState<string | null>(null);
  const [sharingError, setSharingError] = useState<string | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  // Khi `true`, provider sẽ tự động start ingest cho assignment mới chuyển
  // sang `accepted`/`en_route`. Khi `false`, chỉ chạy khi user bấm toggle.
  const [autoTrackingEnabled, setAutoTrackingEnabledState] = useState(true);
  // Refs để cleanup khi unmount / đổi assignment.
  const watchHandleRef = useRef<LocationWatchHandle | null>(null);
  const autoHandleRef = useRef<AutoTrackingHandle | null>(null);
  const heartbeatHandleRef = useRef<AvailabilityHeartbeatHandle | null>(null);
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
      const [profile, dash, jobsPage, perf] = await Promise.all([
        getMyMechanicProfile().catch((e) => {
          if (e instanceof ApiError && e.status === 404) return null;
          throw e;
        }),
        getMechanicDashboard().catch(() => null),
        listAssignments({ limit: 50 }).catch((e) => {
          if (e instanceof ApiError && e.status === 403) return { items: [], next_cursor: undefined };
          throw e;
        }),
        getMechanicPerformance().catch(() => null),
      ]);

      if (profile) {
        setMechanic((prev) => {
          // totalJobs semantic = số job đã completed (BE aggregate).
          // Trước đây map từ rating_count (số review) → sai nghĩa.
          // Ưu tiên seven_day_performance, fallback performance.completed_jobs.
          const completedFromDash =
            dash?.seven_day_performance.completed_jobs ??
            dash?.today_counts.completed_jobs;
          const completedFromPerf = perf?.completed_jobs;
          const totalJobs =
            completedFromDash ??
            completedFromPerf ??
            // Cuối cùng fallback rating_count (giữ behaviour cũ nếu cả
            // dashboard + performance đều không có).
            profile.rating_count;
          return {
            ...profileToUi(profile),
            totalJobs,
            // Ưu tiên tên/avatar/phone từ auth context cho UI
            name: authUser?.name || prev.name,
            avatar: authUser?.avatar || prev.avatar,
            phone: authUser?.phone || prev.phone,
          };
        });
      }
      if (dash) setDashboard(dash);
      // Performance đã load song song ở trên, set ngay nếu chưa có.
      if (perf) setPerformance(perf);
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
      // Map assignmentId → requestId. Cần cho submitQuote vì
      // `MechanicJob.customer.id` không mang request id (xem `assignmentToJob`).
      const nextRequestIdMap: Record<string, string> = {};
      for (const a of list) {
        nextStatusMap[a.id] = a.status;
        const svc = (a as { request?: { service_type?: string } }).request?.service_type;
        if (svc) nextServiceMap[a.id] = svc;
        if (a.request_id) nextRequestIdMap[a.id] = a.request_id;
      }
      setAssignmentStatusMap(nextStatusMap);
      setServiceTypeMap(nextServiceMap);
      setRequestIdMap(nextRequestIdMap);
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
   * Bật / tắt auto-tracking. Khi tắt, provider sẽ stopAutoTracking() ngay;
   * ngược lại, useEffect watcher sẽ tự start lại cho assignment hiện tại.
   */
  const setAutoTrackingEnabled = useCallback((enabled: boolean) => {
    setAutoTrackingEnabledState(enabled);
  }, []);

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

  /**
   * Helper ingest: rate-limit + accuracy filter + chỉ gửi nếu assignment
   * còn ở travel state. Tách ra để dùng được cả cho manual toggle và auto
   * tracking đều đi qua cùng 1 rate-limit (per-assignment).
   */
  const ingestForAssignment = useCallback(
    async (assignmentId: string, loc: { latitude: number; longitude: number; accuracy?: number }) => {
      // Skip nếu status đã rời travel states (race trong lúc polling).
      const status = assignmentStatusMap[assignmentId];
      if (!status || !LIVE_TRACKING_STATUSES.has(status)) return;
      const last = lastIngestAtRef.current[assignmentId] ?? 0;
      const now = Date.now();
      if (now - last < 10_000) return;
      if (typeof loc.accuracy === 'number' && loc.accuracy > 100) return;
      lastIngestAtRef.current[assignmentId] = now;
      try {
        await ingestLiveLocation(assignmentId, {
          latitude: loc.latitude,
          longitude: loc.longitude,
          observed_at: new Date().toISOString(),
          accuracy_meters: loc.accuracy ?? 50,
        });
      } catch {
        // Lỗi không dừng vòng watch - chỉ set banner.
        setSharingError('Không thể gửi vị trí. Kiểm tra kết nối mạng.');
      }
    },
    [assignmentStatusMap],
  );

  const stopLiveSharing = useCallback(() => {
    if (watchHandleRef.current) {
      watchHandleRef.current.stop();
      watchHandleRef.current = null;
    }
    setSharingAssignmentId(null);
  }, []);

  const stopAutoTracking = useCallback(() => {
    if (autoHandleRef.current) {
      autoHandleRef.current.stop();
      autoHandleRef.current = null;
    }
  }, []);

  const stopAvailabilityHeartbeat = useCallback(() => {
    if (heartbeatHandleRef.current) {
      heartbeatHandleRef.current.stop();
      heartbeatHandleRef.current = null;
    }
  }, []);

  /**
   * Bật chia sẻ vị trí thủ công cho 1 assignment. Idempotent.
   * - Nếu đã chạy cho assignment này → no-op.
   * - Nếu đang chạy cho assignment khác → swap.
   * - Nếu job đã rời travel state → set error, return.
   */
  const startLiveSharing = useCallback(
    async (assignmentId: string) => {
      if (sharingAssignmentId === assignmentId && watchHandleRef.current) {
        return; // đã chạy
      }
      if (sharingAssignmentId && sharingAssignmentId !== assignmentId) {
        stopLiveSharing();
      }
      const status = assignmentStatusMap[assignmentId];
      if (!status || !LIVE_TRACKING_STATUSES.has(status)) {
        setSharingError('Job không ở trạng thái cho phép chia sẻ vị trí.');
        return;
      }
      setSharingError(null);
      try {
        const handle = await watchCurrentPosition(
          (loc) => {
            void ingestForAssignment(assignmentId, loc);
          },
          (err) => {
            setSharingError(err.message);
            stopLiveSharing();
            setLocationPermissionGranted(false);
          },
          { timeInterval: 15_000, distanceInterval: 25 },
        );
        watchHandleRef.current = handle;
        setSharingAssignmentId(assignmentId);
        setLocationPermissionGranted(true);
      } catch (err) {
        if (err instanceof LocationCaptureError) {
          setSharingError(err.message);
          setLocationPermissionGranted(err.code !== 'PERMISSION_DENIED');
        } else {
          setSharingError('Không thể bật chia sẻ vị trí.');
        }
      }
    },
    [sharingAssignmentId, stopLiveSharing, assignmentStatusMap, ingestForAssignment],
  );

  /**
   * Toggle thủ công giữ nguyên hành vi cũ (back-compat cho UI cũ):
   * - Đang bật cho cùng assignment → tắt.
   * - Đang tắt → bật.
   */
  const toggleLiveSharing = useCallback(
    async (assignmentId: string) => {
      if (sharingAssignmentId === assignmentId) {
        stopLiveSharing();
        return;
      }
      await startLiveSharing(assignmentId);
    },
    [sharingAssignmentId, startLiveSharing, stopLiveSharing],
  );

  // Auto-stop manual share khi assignment rời travel state.
  useEffect(() => {
    if (!sharingAssignmentId) return;
    const status = assignmentStatusMap[sharingAssignmentId];
    if (!status || !LIVE_TRACKING_STATUSES.has(status)) {
      stopLiveSharing();
    }
  }, [sharingAssignmentId, assignmentStatusMap, stopLiveSharing]);

  // Permission check khi provider mount - cập nhật flag để UI render hint.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const granted = await isLocationPermissionGranted();
      if (!cancelled) setLocationPermissionGranted(granted);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-start watch cho assignment active sớm nhất (accepted/en_route).
  // Tự tắt khi assignment rời travel state, khi permission bị deny, hoặc
  // khi user bật/tắt autoTrackingEnabled.
  useEffect(() => {
    if (!autoTrackingEnabled) {
      stopAutoTracking();
      return;
    }
    if (!locationPermissionGranted) {
      // Không start watch nếu user chưa cấp permission. UI sẽ render hint.
      stopAutoTracking();
      return;
    }
    // Tìm assignment đang ở travel state.
    const candidate = Object.entries(assignmentStatusMap).find(([, s]) =>
      LIVE_TRACKING_STATUSES.has(s),
    );
    if (!candidate) {
      stopAutoTracking();
      return;
    }
    const [assignmentId] = candidate;
    // Đã chạy cho assignment này rồi thì thôi.
    if (autoHandleRef.current && sharingAssignmentId === assignmentId) {
      return;
    }
    // Nếu manual share đang chạy cho assignment khác, auto track không cần can thiệp.
    if (sharingAssignmentId && sharingAssignmentId !== assignmentId && watchHandleRef.current) {
      return;
    }
    let cancelledEffect = false;
    void (async () => {
      // Stop any stale handle trước khi start mới.
      stopAutoTracking();
      const handle = await startAutoTracking(
        (loc) => {
          void ingestForAssignment(assignmentId, loc);
        },
        (err) => {
          setSharingError(err.message);
          setLocationPermissionGranted(false);
          stopAutoTracking();
        },
        { minTickIntervalMs: 10_000, maxAccuracyMeters: 100, distanceInterval: 25 },
      );
      if (cancelledEffect) {
        handle.stop();
        return;
      }
      if (!handle.permissionGranted) {
        // Permission bị deny giữa chừng (race với user revoke).
        setLocationPermissionGranted(false);
        return;
      }
      autoHandleRef.current = handle;
      setLocationPermissionGranted(true);
      // Không ghi đè `sharingAssignmentId` - đó là manual UI flag.
      // Auto-track chỉ chạy ngầm; rider vẫn nhận được update qua BE.
    })();
    return () => {
      cancelledEffect = true;
      stopAutoTracking();
    };
  }, [
    autoTrackingEnabled,
    locationPermissionGranted,
    assignmentStatusMap,
    sharingAssignmentId,
    ingestForAssignment,
    stopAutoTracking,
  ]);

  // =========================================================
  // Availability heartbeat (1.x)
  // -------------------------------------------------------------
  // Khi mechanic `is_available=true` mà chưa accept assignment nào, FE
  // cần ping location định kỳ lên BE để `mechanic_profiles.latest_location`
  // luôn nằm trong fresh window (BE: `DISPATCH_LOCATION_MAX_AGE_SECONDS=300s`).
  // Nếu location quá cũ, `listEligibility` loại mechanic ra khỏi round → offer
  // cho request gần nhất bị rỗng.
  //
  // Cách hoạt động:
  //  - Ping mỗi 180s (3 phút) < 300s fresh window.
  //  - Auto-stop khi: `is_available=false`, khi có assignment đang ở travel
  //    state (đã có watch handle riêng), hoặc khi permission bị revoke.
  //  - Skip ping nếu accuracy > 100m; skip nếu BE fail.
  // =========================================================
  const isAvailableForDispatch = dashboard?.availability.is_available ?? false;
  const hasActiveTravelAssignment = Object.values(assignmentStatusMap).some((s) =>
    LIVE_TRACKING_STATUSES.has(s),
  );
  useEffect(() => {
    if (!isBackendConfigured || authStatus !== 'authenticated') {
      stopAvailabilityHeartbeat();
      return;
    }
    if (!isAvailableForDispatch) {
      stopAvailabilityHeartbeat();
      return;
    }
    // Khi đã có travel assignment, watch handle riêng đã đẩy location liên tục
    // → heartbeat thừa. Skip.
    if (hasActiveTravelAssignment) {
      stopAvailabilityHeartbeat();
      return;
    }
    if (!locationPermissionGranted) {
      stopAvailabilityHeartbeat();
      return;
    }
    // Đã chạy rồi thì thôi.
    if (heartbeatHandleRef.current) return;

    const handle = startAvailabilityHeartbeat(
      async (loc) => {
        try {
          await updateMyLocation({ latitude: loc.latitude, longitude: loc.longitude });
        } catch {
          // Lỗi BE (network/auth) → bỏ qua tick này, loop sẽ retry ở tick sau.
        }
      },
      { intervalMs: 180_000, maxAccuracyMeters: 100 },
    );
    heartbeatHandleRef.current = handle;
    return () => {
      stopAvailabilityHeartbeat();
    };
  }, [
    isBackendConfigured,
    authStatus,
    isAvailableForDispatch,
    hasActiveTravelAssignment,
    locationPermissionGranted,
    stopAvailabilityHeartbeat,
  ]);

  // Cleanup khi provider unmount.
  useEffect(() => {
    return () => {
      if (watchHandleRef.current) {
        watchHandleRef.current.stop();
        watchHandleRef.current = null;
      }
      if (autoHandleRef.current) {
        autoHandleRef.current.stop();
        autoHandleRef.current = null;
      }
      if (heartbeatHandleRef.current) {
        heartbeatHandleRef.current.stop();
        heartbeatHandleRef.current = null;
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

  const getJobDetail = useCallback(
    (id: string) => jobDetailMap[id] ?? null,
    [jobDetailMap],
  );

  /**
   * Fetch chi tiết job (problem description, motorcycle, latest quote,
   * completion checklist) từ `GET /api/v1/mechanics/me/jobs/{id}`.
   *
   * Best-effort: 403 (không phải job của mechanic) hoặc 404 → trả null,
   * không set error banner vì đây là read-only supplementary data.
   */
  const loadJobDetail = useCallback(
    async (jobId: string) => {
      if (!isBackendConfigured) return null;
      setJobDetailLoadingId(jobId);
      try {
        const detail = await fetchJobDetail(jobId);
        setJobDetailMap((prev) => ({ ...prev, [jobId]: detail }));
        return detail;
      } catch {
        return null;
      } finally {
        setJobDetailLoadingId((cur) => (cur === jobId ? null : cur));
      }
    },
    [isBackendConfigured],
  );

  const getLatestDiagnosisForJob = useCallback(
    (id: string) => latestDiagnosisMap[id] ?? null,
    [latestDiagnosisMap],
  );

  const getDiagnosisHistoryForJob = useCallback(
    (id: string) => diagnosisHistoryMap[id] ?? [],
    [diagnosisHistoryMap],
  );

  /**
   * Lazy load lịch sử diagnosis versions cho 1 assignment.
   * Best-effort: BE fail → trả `[]` và cache rỗng, không set error banner.
   * Cache trong `diagnosisHistoryMap` để UI không phải gọi lại khi remount.
   */
  const loadDiagnosisHistory = useCallback(
    async (jobId: string): Promise<DiagnosisRecord[]> => {
      if (!isBackendConfigured) return [];
      try {
        const items = await fetchDiagnosisHistory(jobId);
        // BE không đảm bảo sort → sort theo created_at desc cho chắc.
        const sorted = [...items].sort((a, b) =>
          (b.created_at ?? '').localeCompare(a.created_at ?? ''),
        );
        setDiagnosisHistoryMap((prev) => ({ ...prev, [jobId]: sorted }));
        return sorted;
      } catch {
        return [];
      }
    },
    [isBackendConfigured],
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
      const requestIdForQuote = requestIdMap[jobId] ?? '';
      const placeholderSubtotal = calculateSubtotal(input.lines);
      const optimistic: Quote = {
        id: `optimistic-${Date.now()}`,
        request_id: requestIdForQuote,
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
        // BE `submitQuote` cần `requestId`. Lấy từ cache `requestIdMap` được
        // build từ `GET /api/v1/assignments` (field `request_id`).
        // `MechanicJob.customer.id` không phải request id → không dùng.
        const requestId = requestIdMap[jobId];
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
    [jobs, serviceTypeMap, requestIdMap, latestQuoteMap, isBackendConfigured, authUser?.id],
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
      jobDetail: getJobDetail,
      jobDetailLoading: jobDetailLoadingId !== null,
      loadJobDetail,
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
      getDiagnosisHistoryForJob,
      loadDiagnosisHistory,
      getLatestPendingQuote,
      sharingAssignmentId,
      sharingError,
      locationPermissionGranted,
      toggleLiveSharing,
      startLiveSharing,
      stopLiveSharing,
      performance,
      performanceLoading,
      reloadPerformance,
      autoTrackingEnabled,
      setAutoTrackingEnabled,
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
      getJobDetail,
      jobDetailLoadingId,
      loadJobDetail,
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
      getDiagnosisHistoryForJob,
      loadDiagnosisHistory,
      getLatestPendingQuote,
      sharingAssignmentId,
      sharingError,
      locationPermissionGranted,
      toggleLiveSharing,
      startLiveSharing,
      stopLiveSharing,
      performance,
      performanceLoading,
      reloadPerformance,
      autoTrackingEnabled,
      setAutoTrackingEnabled,
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
