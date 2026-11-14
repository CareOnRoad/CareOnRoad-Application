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
  listMechanicJobs,
  mergeMechanicJobLists,
  updateMyAvailability,
  updateMyLocation,
  type MechanicDashboardJob,
  type MechanicDashboardResponse,
  type MechanicPerformanceResponse,
  type MechanicProfileResponse,
} from '@/lib/mechanics-service';
import {
  createDiagnosis,
  getJobDetail as fetchJobDetail,
  listDiagnoses as fetchDiagnosisHistory,
  nextAllowedStatuses,
  statusLabel,
  submitEta,
  submitCompletionChecklist,
  transitionAssignment,
  type AssignmentStatus,
  type DiagnosisRecord,
  type MechanicJobDetailResponse,
  type SafetyChecklist,
} from '@/lib/mechanic-jobs-service';
import { ingestLiveLocation } from '@/lib/assignments-service';
import { listQuotesForRequest } from '@/lib/quotes-service';
import {
  calculateSubtotal,
  submitQuote,
  suggestPurposeForServiceType,
  type QuoteLineInput,
  type QuotePurpose,
  type RescueLaborPricingInput,
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
  /**
   * Chuyển assignment sang 1 BE status cụ thể (mirror `nextAllowedStatuses`).
   *
   * Dùng cho nút "Cập nhật tiến độ": danh sách target lấy từ BE state
   * machine, FE không tự suy luận.
   */
  advanceJobStatus: (
    id: string,
    target: AssignmentStatus,
    notes?: string,
  ) => Promise<void>;
  /**
   * `on_site → diagnosis`: bắt đầu chẩn đoán tại chỗ.
   *
   * Cần cho flow standard (BE chỉ cho tạo quote khi assignment ở `diagnosis`),
   * và là bước mở đầu của mọi flow cứu hộ / bảo dưỡng.
   */
  startDiagnosis: (id: string) => Promise<void>;
  /**
   * `awaiting_payment → in_progress`: bắt đầu sửa sau khi rider đã thanh toán.
   * BE trả 409 nếu payment chưa `succeeded`.
   */
  startRepair: (id: string) => Promise<void>;
  /**
   * `in_progress → awaiting_payment`: báo đã sửa xong, chờ rider thanh toán phần
   * còn lại (dùng cho cứu hộ / bảo dưỡng có thu tiền nhiều bước).
   */
  markReadyForPayment: (id: string) => Promise<void>;
  /**
   * Gửi completion checklist (bắt buộc cho bảo dưỡng trước khi chuyển
   * `in_progress → awaiting_payment`).
   *
   * BE tự gắn `approved_quote_id` = quote `maintenance_work` đã approved →
   * client KHÔNG được tự chọn quote.
   */
  submitChecklist: (
    id: string,
    input: {
      work_summary: string;
      safety_checklist: SafetyChecklist;
      notes?: string;
    },
  ) => Promise<void>;
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
      /** Override `purpose` — dùng cho workflow cứu hộ / bảo dưỡng. */
      purpose?: QuotePurpose;
      /** Bảng giá công cứu hộ (bắt buộc cho `rescue_labor`). */
      labor_pricing?: RescueLaborPricingInput;
      /** Quote nền cho maintenance addition. */
      basis_quote_id?: string;
    },
  ) => Promise<Quote | null>;
  /**
   * Tạo chẩn đoán + báo giá trong 1 lần bấm (luồng rút gọn).
   *
   * 2 call API tuần tự: `POST .../diagnoses` → `POST .../quotes` (kèm
   * `diagnosis_id`). BE không cần thay đổi.
   */
  submitDiagnosisAndQuote: (
    jobId: string,
    input: {
      diagnosis?: {
        diagnosis_text: string;
        safety_notes?: string;
        recommended_work_text?: string;
      };
      lines: QuoteLineInput[];
      discount_amount?: number;
      notes?: string;
      purpose?: QuotePurpose;
      labor_pricing?: RescueLaborPricingInput;
      basis_quote_id?: string;
    },
  ) => Promise<{ diagnosis: DiagnosisRecord | null; quote: Quote }>;
  /** Tạo diagnosis cho assignment. Optimistic cache local. */
  submitDiagnosisForJob: (
    jobId: string,
    input: { diagnosis_text: string; safety_notes?: string; recommended_work_text?: string },
  ) => Promise<DiagnosisRecord | null>;
  /** Lấy diagnosis mới nhất (cached, không reload). */
  getLatestDiagnosisForJob: (jobId: string) => DiagnosisRecord | null;
  /** Lấy lịch sử tất cả diagnosis versions cho job (latest first). */
  getDiagnosisHistoryForJob: (jobId: string) => DiagnosisRecord[];
  /** Lazy load + cache lịch sử diagnosis từ BE. Best-effort. */
  loadDiagnosisHistory: (jobId: string) => Promise<DiagnosisRecord[]>;
  /** Lấy quote pending mới nhất (cached, không reload). */
  getLatestPendingQuote: (jobId: string) => Quote | null;
  /**
   * Lấy TOÀN BỘ quote của request gắn với job (cached).
   *
   * Nguồn sự thật là BE `GET /api/v1/service-requests/{requestId}/quotes`.
   * Dùng để:
   *  - hiển thị báo giá đã gửi khi mở lại màn chi tiết (không mất dữ liệu
   *    sau khi app reload),
   *  - biết quote cuối đã được rider duyệt chưa (`rescue_final` /
   *    `maintenance_work`) → mở nút "Bắt đầu sửa" cho mechanic.
   */
  getQuotesForJob: (jobId: string) => Quote[];
  /** Lazy load + cache quote của job. Best-effort, lỗi → mảng rỗng. */
  loadQuotesForJob: (jobId: string) => Promise<Quote[]>;
  /**
   * Đã có quote cuối được rider duyệt chưa (`rescue_final` / `maintenance_work`).
   * Mirror guard của BE (`assignment.service.ts`) khi chuyển `diagnosis → in_progress`.
   */
  hasApprovedFinalQuote: (jobId: string) => boolean;
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
 * Map BE mechanic job (`GET /api/v1/mechanics/me/jobs`) → UI MechanicJob.
 *
 * Nguồn dữ liệu: `MechanicDashboardJob` — có `request.service_type` +
 * `request.request_code`. KHÔNG có rider identity (BE không expose) nên:
 *  - `customer` = placeholder an toàn dùng mã yêu cầu (không PII).
 *  - `symptom` = '' (chỉ có ở job detail endpoint).
 *  - `vehicle` = placeholder; thật sự nằm ở job detail.
 */
function mechanicJobToUiJob(a: MechanicDashboardJob): MechanicJob {
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
    id: a.assignment_id,
    customer: {
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
    case 'in_progress':
      // BE: "đang thực hiện công việc" (rescue đã approved parts hoặc
      // standard sau khi rider thanh toán). UI mechanic thấy "Đang sửa"
      // — phản ánh đúng giai đoạn giữa chừng.
      return 'in_progress';
    case 'awaiting_payment':
      // BE: phần việc mechanic đã xong, chờ rider thanh toán. Map về
      // `'completed'` để:
      //   - Status pill ổn định sau khi submit checklist (không flicker
      //     giữa "Hoàn tất" → "Đang xử lý" ở mỗi lần polling).
      //   - Form giữ field "Phụ tùng đã thay" / "Chi phí cuối" để mechanic
      //     xem lại hoặc sửa trước khi rider thanh toán.
      // Để biết BE thật sự đã `completed` (rider thanh toán xong) hay còn
      // `awaiting_payment` (chưa thanh toán), dùng `assignmentStatusMap`
      // (BE raw status) — xem "Trạng thái BE" ở detail page.
      return 'completed';
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
  const [quotesByJobMap, setQuotesByJobMap] = useState<Record<string, Quote[]>>({});
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
  // Đếm số lần ingestLiveLocation thất bại liên tiếp với 409 để tự stop
  // auto-tracking sau 3 lần (tránh BE spam 409 log).
  const consecutiveFailuresRef = useRef<Record<string, number>>({});

  /**
   * Đọc trạng thái BE của 1 assignment.
   *
   * Ưu tiên cache từ list (`GET /api/v1/mechanics/me/jobs`), fallback job detail
   * (`GET /api/v1/mechanics/me/jobs/{id}`).
   *
   * Lý do: khi list endpoint lỗi (BE 500 do hết connection pool) mà job detail
   * vẫn OK, mọi guard `if (!currentBeStatus) return "Chưa tải được trạng thái
   * BE"` sẽ chặn mechanic, và UI hiển thị như thợ chưa nhận việc.
   */
  const resolveBeStatus = useCallback(
    (id: string): string | undefined =>
      assignmentStatusMap[id] ?? jobDetailMap[id]?.assignment.status,
    [assignmentStatusMap, jobDetailMap],
  );

  /**
   * `service_type` của 1 job: ưu tiên cache list, fallback job detail.
   *
   * Thiếu `service_type` → `quotePurposePlanFor` rơi về `standard` → BE từ
   * chối báo giá cứu hộ/bảo dưỡng với 400 "Quote purpose does not match".
   */
  const resolveServiceType = useCallback(
    (id: string): string | undefined =>
      serviceTypeMap[id] ?? jobDetailMap[id]?.request?.service_type,
    [serviceTypeMap, jobDetailMap],
  );

  /**
   * Bản gộp của trạng thái assignment: list cache + job detail fallback.
   *
   * Dùng cho các logic cần quét nhiều assignment (auto-tracking, heartbeat)
   * mà không phụ thuộc vào việc list endpoint có load được hay không.
   */
  const mergedStatusMap = useMemo<Record<string, string>>(() => {
    const merged: Record<string, string> = { ...assignmentStatusMap };
    for (const [id, detail] of Object.entries(jobDetailMap)) {
      if (!merged[id] && detail.assignment?.status) {
        merged[id] = detail.assignment.status;
      }
    }
    return merged;
  }, [assignmentStatusMap, jobDetailMap]);

  /**
   * Load toàn bộ data BE:
   *  - profile (mechanic info + rating)
   *  - dashboard (today counts, perf, action codes)
   *  - jobs list (assignments của thợ, gồm active và completed)
   *
   * Nguồn danh sách job: `GET /api/v1/mechanics/me/jobs` — endpoint này **có**
   * `request.service_type` + `request.request_code`. `GET /api/v1/assignments`
   * (fallback) chỉ trả assignment phẳng, KHÔNG có `request` → thiếu
   * `service_type` → `quotePurposePlanFor` rơi về `standard` → BE từ chối
   * báo giá của cứu hộ/bảo dưỡng (400 "Quote purpose does not match").
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
      const [profile, dash, jobsPage, activeJobsPage, perf] = await Promise.all([
        getMyMechanicProfile().catch((e) => {
          if (e instanceof ApiError && e.status === 404) return null;
          throw e;
        }),
        getMechanicDashboard().catch(() => null),
        listMechanicJobs({ limit: 50 }).catch((e) => {
          if (e instanceof ApiError && e.status === 403) return null;
          throw e;
        }),
        // Job đang xử lý LUÔN được tải riêng (active_only).
        //
        // Lý do: BE sort `created_at desc` + limit 50 → job cũ đang chạy (tạo
        // từ lâu) bị đẩy khỏi trang đầu → mechanic mở lại app thấy list rỗng /
        // mất job đang làm. Query `active_only=true` chỉ trả job active nên
        // luôn nằm trong 50 dòng đầu.
        listMechanicJobs({ active_only: true, limit: 50 }).catch(() => null),
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
      // Shape của `GET /api/v1/mechanics/me/jobs`:
      //   { assignment_id, request_id, status, request: { request_code, service_type, ... } }
      // Gộp thêm job active (query `active_only`) — bảo đảm job đang làm luôn
      // hiện trong list kể cả khi BE sort theo `created_at desc` và job đã cũ.
      const mergedList = mergeMechanicJobLists(
        jobsPage?.items ?? [],
        activeJobsPage?.items ?? [],
      );
      // BE wire: chỉ dùng jobs từ BE. Nếu rỗng → EmptyState, KHÔNG fallback mock.
      setJobs(mergedList.map(mechanicJobToUiJob));
      // Cache BE raw status + service type cho filter (2.1) và quote suggest (1.1).
      const nextStatusMap: Record<string, string> = {};
      const nextServiceMap: Record<string, string> = {};
      // Map assignmentId → requestId. Cần cho submitQuote vì
      // `MechanicJob.customer.id` không mang request id (xem `mechanicJobToUiJob`).
      const nextRequestIdMap: Record<string, string> = {};
      for (const a of mergedList) {
        nextStatusMap[a.assignment_id] = a.status;
        const svc = a.request?.service_type;
        if (svc) nextServiceMap[a.assignment_id] = svc;
        if (a.request_id) nextRequestIdMap[a.assignment_id] = a.request_id;
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

  /**
   * Đã có quote cuối được rider duyệt chưa?
   *
   * - Cứu hộ: quote `rescue_final` có `status === 'approved'`.
   * - Bảo dưỡng: quote `maintenance_work` có `status === 'approved'`.
   *
   * Mirror guard BE (`assignment.service.ts`): "An approved final rescue quote is
   * required before repair." / "Approved maintenance work with no pending
   * additions is required."
   *
   * KHỞI TẠO Ở ĐÂY (trước các callback dùng nó) để tránh temporal dead zone.
   */
  const hasApprovedFinalQuote = useCallback(
    (jobId: string): boolean => {
      // `service_type` ưu tiên cache list; fallback job detail (list có thể lỗi).
      const serviceType =
        serviceTypeMap[jobId] ?? jobDetailMap[jobId]?.request?.service_type;
      const quotes = quotesByJobMap[jobId] ?? [];
      if (quotes.length === 0) return false;
      if (serviceType === 'emergency_rescue') {
        return quotes.some((q) => q.purpose === 'rescue_final' && q.status === 'approved');
      }
      if (serviceType === 'periodic_maintenance') {
        return quotes.some((q) => q.purpose === 'maintenance_work' && q.status === 'approved');
      }
      return false;
    },
    [quotesByJobMap, serviceTypeMap, jobDetailMap],
  );

  /**
   * Cập nhật status job qua BE (atomic). Cập nhật optimistic local.
   *
   * Lưu ý: UI MechanicJobStatus chỉ gồm 5 giá trị (`pending | in_progress
   * | awaiting_parts | completed | canceled`) — phải map sang BE state
   * machine 10 trạng thái:
   *   - `pending`         → `accepted` (giữ nguyên, mechanic chưa bắt đầu thao tác)
   *   - `awaiting_parts`  → `on_site` (thợ đã tới nơi, đang chờ phụ tùng)
   *   - `in_progress`     → KHÔNG transition trực tiếp. Phải dùng action riêng
   *                         `startRepair()` (B.3) vì BE yêu cầu đi qua
   *                         `accepted → en_route → on_site → diagnosis → quoted`
   *                         hoặc theo service_type.
   *   - `completed`       → KHÔNG transition trực tiếp từ mechanic. Việc đóng
   *                         assignment thuộc về rider (sau thanh toán) hoặc admin.
   *
   * UI mechanic chỉ dùng action này cho các bước "Bắt đầu đi" (pending → en_route
   * mặc dù UI hiển thị `pending`) hoặc "Đã tới nơi" (→ on_site).
   * Xem thêm `startRepair()` và `markReadyForPayment()`.
   */
  const updateJobStatus = useCallback(
    async (id: string, status: MechanicJobStatus, notes?: string) => {
      // Lưu local state trước (optimistic)
      const prevJobs = jobs;
      setJobs((curr) =>
        curr.map((j) => (j.id === id ? { ...j, status, notes: notes ?? j.notes } : j)),
      );

      if (!isBackendConfigured) return;

      // Map UI status → BE assignment status. CHỈ những transition mà BE
      // state machine cho phép mechanic thực hiện từ trạng thái `accepted`/`en_route`.
      // `accepted` → {quoted, en_route, canceled, recovery_canceled}
      // `en_route` → {on_site, canceled, recovery_canceled}
      // `on_site`  → {diagnosis, canceled}
      // `diagnosis` → {quoted, in_progress, canceled}
      // `quoted`   → {accepted, diagnosis, awaiting_payment, canceled, recovery_canceled}
      // `in_progress`/`completed` chỉ được set thông qua helper riêng.
      let beStatus: Parameters<typeof transitionAssignment>[1]['status'];
      switch (status) {
        case 'pending':
          beStatus = 'en_route';
          break;
        case 'awaiting_parts':
          beStatus = 'on_site';
          break;
        case 'in_progress':
        case 'completed':
        case 'canceled':
          // Các action này phải đi qua helper riêng (startRepair / markReadyForPayment
          // / cancelAssignment). Bỏ qua ở đây để tránh BE 409.
          setJobs(prevJobs);
          setError(
            'Vui lòng dùng nút "Bắt đầu sửa" hoặc "Báo đã sửa xong" để chuyển trạng thái.',
          );
          return;
        default:
          return;
      }

      // Guard: bỏ qua BE call nếu assignment đã ở đúng trạng thái BE
      // (tránh `accepted → en_route` lặp lại khi user nhấn "Bắt đầu đi" 2
      // lần liên tiếp ⇒ BE trả 409 Conflict).
      const currentBeStatus = resolveBeStatus(id);
      if (!currentBeStatus) {
        // Chưa có cache BE status (vd chưa load list) — không gọi BE,
        // set error để user biết cần đợi load list xong.
        setJobs(prevJobs);
        setError('Chưa tải được trạng thái BE. Vui lòng thử lại sau vài giây.');
        return;
      }
      if (currentBeStatus === beStatus) {
        // Đã ở đúng trạng thái BE — no-op, giữ optimistic UI.
        return;
      }
      // Verify transition hợp lệ trước khi gọi BE. Dùng cùng helper với
      // `nextAllowedStatuses` ở `mechanic-jobs-service.ts` để đảm bảo FE
      // và BE dùng chung 1 state machine mirror.
      const allowedNext = nextAllowedStatuses(
        currentBeStatus as Parameters<typeof nextAllowedStatuses>[0],
        {
          serviceType: resolveServiceType(id),
          hasApprovedFinalQuote: hasApprovedFinalQuote(id),
        },
      );
      if (!allowedNext.includes(beStatus)) {
        setJobs(prevJobs);
        setError(
          `Không thể chuyển từ "${statusLabel(
            currentBeStatus as Parameters<typeof statusLabel>[0],
          )}" sang "${statusLabel(beStatus)}". Vui lòng làm theo đúng thứ tự: ${allowedNext
            .map((s) => statusLabel(s))
            .join(' · ')}.`,
        );
        return;
      }

      try {
        await transitionAssignment(id, {
          status: beStatus,
          ...(notes ? { reason: notes } : {}),
        });
        // Cập nhật cache BE status ngay (optimistic) để UI không phải chờ
        // polling 30s mới thấy trạng thái mới.
        setAssignmentStatusMap((prev) => ({ ...prev, [id]: beStatus }));
        setError(null);
      } catch (e) {
        // Rollback nếu fail
        setJobs(prevJobs);
        setError(e instanceof Error ? e.message : 'Không thể cập nhật trạng thái');
      }
    },
    [jobs, resolveBeStatus, isBackendConfigured, resolveServiceType, hasApprovedFinalQuote],
  );

  /**
   * Chuyển assignment sang 1 BE status cụ thể (nút "Cập nhật tiến độ").
   *
   * Guard bằng `nextAllowedStatuses` (mirror state machine BE) để không gọi
   * BE khi transition không hợp lệ. Sau khi thành công cập nhật cache
   * `assignmentStatusMap` ngay → UI phản ánh trạng thái mới ngay lập tức.
   */
  const advanceJobStatus = useCallback(
    async (id: string, target: AssignmentStatus, notes?: string) => {
      if (!isBackendConfigured) return;
      const currentBeStatus = resolveBeStatus(id);
      if (!currentBeStatus) {
        setError('Chưa tải được trạng thái BE. Vui lòng thử lại sau vài giây.');
        return;
      }
      if (currentBeStatus === target) return;
      const allowedNext = nextAllowedStatuses(currentBeStatus as AssignmentStatus, {
        serviceType: resolveServiceType(id),
        hasApprovedFinalQuote: hasApprovedFinalQuote(id),
      });
      if (!allowedNext.includes(target)) {
        setError(
          `Không thể chuyển từ "${statusLabel(
            currentBeStatus as AssignmentStatus,
          )}" sang "${statusLabel(target)}".`,
        );
        return;
      }
      try {
        await transitionAssignment(id, {
          status: target,
          ...(notes ? { reason: notes } : {}),
        });
        setAssignmentStatusMap((prev) => ({ ...prev, [id]: target }));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không thể cập nhật trạng thái');
      }
    },
    [resolveBeStatus, isBackendConfigured, resolveServiceType, hasApprovedFinalQuote],
  );

  /**
   * Đảm bảo assignment ở stage `diagnosis` trước khi tạo báo giá.
   *
   * BE (`quote.service.ts`) yêu cầu assignment status = `diagnosis` cho
   * version báo giá đầu tiên sau khi tới nơi (`accepted` chỉ dành cho báo
   * giá tiền công trước khi đi). Nếu thợ đang ở `on_site` → chuyển sang
   * `diagnosis` trước, sau đó mới tạo chẩn đoán + báo giá.
   *
   * Hàm này NÉM lỗi khi transition thất bại (không nuốt lỗi như
   * `transitionBeStatus`) vì caller cần biết chính xác bước nào hỏng để
   * giữ nguyên nội dung form.
   */
  const ensureDiagnosisStage = useCallback(
    async (id: string): Promise<void> => {
      if (!isBackendConfigured) return;
      const current = resolveBeStatus(id);
      if (!current) {
        throw new Error('Chưa tải được trạng thái BE. Vui lòng thử lại sau vài giây.');
      }
      if (current === 'diagnosis' || current === 'quoted') return;
      if (current !== 'on_site') {
        throw new Error(
          `Chỉ tạo báo giá khi thợ đã tới nơi. Trạng thái hiện tại: ${statusLabel(
            current as AssignmentStatus,
          )}.`,
        );
      }
      try {
        await transitionAssignment(id, { status: 'diagnosis' });
        setAssignmentStatusMap((prev) => ({ ...prev, [id]: 'diagnosis' }));
        setError(null);
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : 'Không thể chuyển sang bước chẩn đoán.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [resolveBeStatus, isBackendConfigured],
  );

  /**
   * Transition BE có kiểm tra state machine trước khi gọi API.
   *
   * - Đọc trạng thái BE hiện tại từ `assignmentStatusMap` (không re-derive từ
   *   UI status).
   * - Guard theo `nextAllowedStatuses` để tránh gọi BE khi transition không hợp
   *   lệ (BE trả 409 và thông báo khó hiểu).
   * - `notAllowedMessage` là thông báo tiếng Việt hiển thị cho mechanic.
   */
  const transitionBeStatus = useCallback(
    async (
      id: string,
      target: Parameters<typeof transitionAssignment>[1]['status'],
      notAllowedMessage: string,
    ) => {
      const currentBeStatus = resolveBeStatus(id);
      if (!currentBeStatus) {
        setError('Chưa tải được trạng thái BE. Vui lòng thử lại sau vài giây.');
        return;
      }
      if (currentBeStatus === target) return;
      const allowedNext = nextAllowedStatuses(
        currentBeStatus as Parameters<typeof nextAllowedStatuses>[0],
        {
          serviceType: resolveServiceType(id),
          hasApprovedFinalQuote: hasApprovedFinalQuote(id),
        },
      );
      if (!allowedNext.includes(target as never)) {
        setError(
          `${notAllowedMessage} Hiện tại: ${statusLabel(
            currentBeStatus as Parameters<typeof statusLabel>[0],
          )}. Có thể chuyển: ${allowedNext.map((s) => statusLabel(s)).join(' · ')}.`,
        );
        return;
      }
      try {
        await transitionAssignment(id, { status: target });
        // Cập nhật cache BE status ngay (optimistic) → UI phản ánh trạng thái
        // mới mà không phải chờ polling 30s.
        setAssignmentStatusMap((prev) => ({ ...prev, [id]: target }));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không thể cập nhật trạng thái');
      }
    },
    [resolveBeStatus, resolveServiceType, hasApprovedFinalQuote],
  );

  /** `on_site → diagnosis`: bắt đầu chẩn đoán tại chỗ (mở đường cho tạo quote). */
  const startDiagnosis = useCallback(
    async (id: string) => {
      if (!isBackendConfigured) return;
      await transitionBeStatus(
        id,
        'diagnosis',
        'Không thể bắt đầu chẩn đoán. Thợ cần đã tới nơi trước.',
      );
    },
    [isBackendConfigured, transitionBeStatus],
  );

  /** `awaiting_payment → in_progress`: bắt đầu sửa (rider đã thanh toán). */
  const startRepair = useCallback(
    async (id: string) => {
      if (!isBackendConfigured) return;
      await transitionBeStatus(
        id,
        'in_progress',
        'Không thể bắt đầu sửa. Chỉ bắt đầu được khi rider đã thanh toán.',
      );
    },
    [isBackendConfigured, transitionBeStatus],
  );

  /** `in_progress → awaiting_payment`: đã sửa xong, chờ thanh toán phần còn lại. */
  const markReadyForPayment = useCallback(
    async (id: string) => {
      if (!isBackendConfigured) return;
      await transitionBeStatus(
        id,
        'awaiting_payment',
        'Không thể báo đã sửa xong. Thợ cần đang sửa (in_progress).',
      );
    },
    [isBackendConfigured, transitionBeStatus],
  );

  /**
   * Gửi completion checklist.
   *
   * Bảo dưỡng BẮT BUỘC có checklist gắn quote `maintenance_work` đã approved
   * trước khi chuyển `in_progress → awaiting_payment` (BE trả 409 nếu thiếu).
   * BE tự gắn `approved_quote_id` → client không chọn quote.
   */
  const submitChecklist = useCallback(
    async (
      id: string,
      input: {
        work_summary: string;
        safety_checklist: SafetyChecklist;
        notes?: string;
      },
    ) => {
      if (!isBackendConfigured) return;
      try {
        await submitCompletionChecklist(id, input);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không thể gửi checklist hoàn tất');
        throw e;
      }
    },
    [isBackendConfigured],
  );

  /**
   * Hoàn tất 1 phần công việc mechanic-side.
   *
   * Lưu ý quan trọng: `completed` (đóng assignment) là hành động thuộc về
   * rider (sau khi thanh toán) hoặc admin. Mechanic KHÔNG tự transition
   * assignment sang `completed` — BE sẽ trả 409 vì vi phạm state machine.
   *
   * Flow thực tế mechanic-side:
   *  1. Submit completion checklist (B.3) — BE validate assignment đang
   *     ở `in_progress` hoặc `awaiting_payment`.
   *  2. Transition assignment → `awaiting_payment` để rider thanh toán.
   *  3. Rider thanh toán → BE tự transition sang `in_progress` → `completed`.
   *
   * Hàm này làm đúng 2 bước đầu:
   *  - Submit `submitCompletionChecklist` với safety_checklist đầy đủ.
   *  - Transition `quoted | diagnosis | in_progress` → `awaiting_payment`.
   *
   * Rollback optimistic local nếu bất kỳ bước nào fail.
   */
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

      // Guard: chỉ chuyển sang `awaiting_payment` khi BE đã có transition
      // hợp lệ. Xem BE `assignment-state.ts:7-10`:
      //   `quoted` → {awaiting_payment, ...}
      //   `in_progress` → {awaiting_payment, completed, canceled}
      //   `awaiting_payment` → {in_progress, completed, canceled}
      // Nếu assignment đang ở trạng thái khác (vd `accepted`/`en_route`),
      // BE sẽ trả 409 Conflict — fail-fast và thông báo rõ ràng thay vì
      // để BE reject lặp lại nhiều lần.
      const currentBeStatus = assignmentStatusMap[id];
      if (!currentBeStatus) {
        setJobs(prevJobs);
        setError('Chưa tải được trạng thái BE. Vui lòng thử lại sau vài giây.');
        return;
      }
      const allowedNext = nextAllowedStatuses(
        currentBeStatus as Parameters<typeof nextAllowedStatuses>[0],
        {
          serviceType: resolveServiceType(id),
          hasApprovedFinalQuote: hasApprovedFinalQuote(id),
        },
      );
      const checklistAllowed = ['in_progress', 'awaiting_payment'].includes(currentBeStatus);
      if (!checklistAllowed) {
        setJobs(prevJobs);
        setError(
          `Trạng thái hiện tại (${statusLabel(
            currentBeStatus as Parameters<typeof statusLabel>[0],
          )}) chưa cho phép gửi checklist hoàn tất. Có thể chuyển: ${allowedNext
            .map((s) => statusLabel(s))
            .join(' · ')}.`,
        );
        return;
      }
      if (!allowedNext.includes('awaiting_payment' as never)) {
        // Cho phép submit checklist nhưng không transition sang
        // awaiting_payment từ trạng thái này. Skip bước transition.
      }

      try {
        // Bước 1: submit completion checklist. BE cho phép khi assignment
        // đang ACTIVE (in_progress / awaiting_payment cho maintenance;
        // accepted / on_site / diagnosis / in_progress cho standard).
        await submitCompletionChecklist(id, {
          work_summary:
            payload.notes || `Hoàn tất công việc với chi phí ${payload.price.toLocaleString('vi-VN')}đ`,
          safety_checklist: {
            test_ride_completed: true,
            tools_removed: true,
            area_safe: true,
            rider_briefed: true,
            no_fluid_leak: true,
          },
        });
        // Bước 2: chuyển sang `awaiting_payment` để rider thanh toán.
        // BE state machine: `quoted` → `awaiting_payment` OK;
        // `in_progress` → `awaiting_payment` OK;
        // `awaiting_payment` → KHÔNG transition được (đã ở đó).
        if (allowedNext.includes('awaiting_payment' as never)) {
          await transitionAssignment(id, { status: 'awaiting_payment' });
        }
      } catch (e) {
        setJobs(prevJobs);
        setError(e instanceof Error ? e.message : 'Không thể hoàn tất công việc');
      }
    },
    [jobs, resolveBeStatus, isBackendConfigured, resolveServiceType, hasApprovedFinalQuote],
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
   * Dừng auto-tracking vị trí. Đặt TRƯỚC `ingestForAssignment` vì hàm đó
   * gọi `stopAutoTracking()` trong nhánh lỗi 409 liên tiếp — khai báo sau
   * sẽ gây lỗi temporal dead zone ("Cannot access variable before it is
   * declared") và crash runtime.
   */
  const stopAutoTracking = useCallback(() => {
    if (autoHandleRef.current) {
      autoHandleRef.current.stop();
      autoHandleRef.current = null;
    }
  }, []);

  /**
   * Helper ingest: rate-limit + accuracy filter + chỉ gửi nếu assignment
   * còn ở travel state. Tách ra để dùng được cả cho manual toggle và auto
   * tracking đều đi qua cùng 1 rate-limit (per-assignment).
   */
  const ingestForAssignment = useCallback(
    async (assignmentId: string, loc: { latitude: number; longitude: number; accuracy?: number }) => {
      // Skip nếu status đã rời travel states (race trong lúc polling).
      const status = resolveBeStatus(assignmentId);
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
        // Reset fail counter khi ingest thành công.
        consecutiveFailuresRef.current[assignmentId] = 0;
      } catch (e) {
        // Phân loại lỗi:
        //  - 409 (BE trả conflict vì assignment rời travel state) → dừng
        //    auto-tracking sau N lần liên tiếp, hiển thị banner để mechanic
        //    bật lại thủ công.
        //  - 4xx khác / 5xx / network → set banner thường, không tự dừng
        //    (chỉ reset counter thành 0 nếu thành công lại sau đó).
        const apiErr = e as { status?: number; code?: string };
        if (typeof apiErr.status === 'number' && apiErr.status === 409) {
          const count = (consecutiveFailuresRef.current[assignmentId] ?? 0) + 1;
          consecutiveFailuresRef.current[assignmentId] = count;
          if (count >= 3) {
            stopAutoTracking();
            setSharingError(
              'Thợ đã rời trạng thái chia sẻ vị trí (BE trả 409 nhiều lần liên tiếp). Vui lòng bật lại thủ công sau khi bước vào travel state mới.',
            );
            consecutiveFailuresRef.current[assignmentId] = 0;
            return;
          }
          setSharingError(
            'Không thể gửi vị trí: assignment không còn ở trạng thái cho phép (409).',
          );
        } else {
          setSharingError('Không thể gửi vị trí. Kiểm tra kết nối mạng.');
        }
      }
    },
    [resolveBeStatus],
  );

  const stopLiveSharing = useCallback(() => {
    if (watchHandleRef.current) {
      watchHandleRef.current.stop();
      watchHandleRef.current = null;
    }
    setSharingAssignmentId(null);
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
      const status = resolveBeStatus(assignmentId);
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
    const status = resolveBeStatus(sharingAssignmentId);
    if (!status || !LIVE_TRACKING_STATUSES.has(status)) {
      stopLiveSharing();
    }
  }, [sharingAssignmentId, resolveBeStatus, stopLiveSharing]);

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
    const candidate = Object.entries(mergedStatusMap).find(([, s]) =>
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
    mergedStatusMap,
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
  const hasActiveTravelAssignment = Object.values(mergedStatusMap).some((s) =>
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

  /**
   * Trạng thái BE hiện tại của 1 assignment.
   *
   * Ưu tiên cache list (`GET /api/v1/mechanics/me/jobs`), fallback job detail
   * (`GET /api/v1/mechanics/me/jobs/{id}`) khi list endpoint lỗi (BE 500).
   *
   * Không có fallback → mọi nút hành động báo "Chưa tải được trạng thái BE"
   * và mechanic không thể chuyển bước dù job vẫn tồn tại.
   */
  const getAssignmentStatus = useCallback(
    (id: string): string | undefined =>
      assignmentStatusMap[id] ?? jobDetailMap[id]?.assignment.status,
    [assignmentStatusMap, jobDetailMap],
  );

  const getJobServiceType = useCallback(
    (id: string) => serviceTypeMap[id] ?? jobDetailMap[id]?.request?.service_type,
    [serviceTypeMap, jobDetailMap],
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
   * Lấy toàn bộ quote của job (cached).
   *
   * Cache được đổ bởi `loadQuotesForJob()` (gọi từ màn chi tiết) và bởi
   * `submitQuoteForRequest()` (ghi thêm quote vừa tạo).
   */
  const getQuotesForJob = useCallback(
    (id: string) => quotesByJobMap[id] ?? [],
    [quotesByJobMap],
  );

  /**
   * Lazy load quote của job từ BE.
   *
   * Best-effort: lỗi → trả `[]`, KHÔNG set error banner (đây là dữ liệu
   * supplementary; UI vẫn render được form báo giá).
   */
  const loadQuotesForJob = useCallback(
    async (jobId: string): Promise<Quote[]> => {
      if (!isBackendConfigured) return [];
      // Ưu tiên request id từ list; fallback từ job detail (list có thể lỗi).
      const requestId = requestIdMap[jobId] ?? jobDetailMap[jobId]?.request?.id;
      if (!requestId) return [];
      try {
        const items = await listQuotesForRequest(requestId);
        const sorted = [...items].sort((a, b) => b.version - a.version);
        setQuotesByJobMap((prev) => ({ ...prev, [jobId]: sorted }));
        // Đồng bộ cache "quote pending mới nhất" để UI không hiện nhầm
        // "Chờ duyệt" sau khi rider đã duyệt.
        const pending = sorted.find((q) => q.status === 'pending');
        setLatestQuoteMap((prev) => {
          const next = { ...prev };
          if (pending) next[jobId] = pending;
          else delete next[jobId];
          return next;
        });
        return sorted;
      } catch {
        return [];
      }
    },
    [isBackendConfigured, requestIdMap, jobDetailMap],
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
        purpose?: QuotePurpose;
        labor_pricing?: RescueLaborPricingInput;
        basis_quote_id?: string;
      },
    ): Promise<Quote | null> => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) {
        setError('Không tìm thấy job để tạo báo giá.');
        return null;
      }
      const serviceType = resolveServiceType(jobId);
      // Caller có thể override `purpose` (workflow cứu hộ / bảo dưỡng nhiều bước).
      const purpose = input.purpose ?? suggestPurposeForServiceType(serviceType);

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
          ...(input.labor_pricing ? { labor_pricing: input.labor_pricing } : {}),
          ...(input.basis_quote_id ? { basis_quote_id: input.basis_quote_id } : {}),
        });
        setLatestQuoteMap((prev) => ({ ...prev, [jobId]: result }));
        // Đồng bộ cache "toàn bộ quote của job" để màn chi tiết hiển thị
        // đúng báo giá vừa gửi (và `hasApprovedFinalQuote` cập nhật ngay).
        setQuotesByJobMap((prev) => {
          const existing = prev[jobId] ?? [];
          const withoutSame = existing.filter((q) => q.id !== result.id);
          return { ...prev, [jobId]: [result, ...withoutSame] };
        });
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
            : e instanceof ApiError && e.status === 400
              ? e.message
              : e instanceof Error
                ? e.message
                : 'Không thể tạo báo giá';
        setError(msg);
        // Ném lại cho caller (form) để hiển thị lỗi ngay tại form + giữ
        // nguyên nội dung người dùng đã nhập.
        throw e instanceof Error ? e : new Error(msg);
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
      input: { diagnosis_text: string; safety_notes?: string; recommended_work_text?: string },
    ): Promise<DiagnosisRecord | null> => {
      if (!isBackendConfigured) return null;
      const previous = latestDiagnosisMap[jobId];
      const optimistic: DiagnosisRecord = {
        id: `optimistic-${Date.now()}`,
        assignment_id: jobId,
        diagnosis_text: input.diagnosis_text,
        ...(input.safety_notes ? { safety_notes: input.safety_notes } : {}),
        ...(input.recommended_work_text
          ? { recommended_work_text: input.recommended_work_text }
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
            ? 'Chẩn đoán chỉ được tạo khi thợ đã tới nơi (trạng thái "Đã đến nơi" hoặc "Đang chẩn đoán").'
            : e instanceof ApiError && e.status === 400
              ? e.message
              : e instanceof Error
                ? e.message
                : 'Không thể tạo chẩn đoán';
        setError(msg);
        // Ném lại cho caller (form) để giữ nội dung người dùng đã nhập và
        // hiển thị lỗi đúng chỗ.
        throw e instanceof Error ? e : new Error(msg);
      }
    },
    [isBackendConfigured, latestDiagnosisMap, authUser?.id],
  );

  /**
   * Tạo chẩn đoán + báo giá trong 1 lần bấm (luồng rút gọn).
   *
   * Thực hiện 2 call API TUẦN TỰ:
   *   1. `POST /api/v1/assignments/{id}/diagnoses` (nếu có nội dung chẩn đoán)
   *   2. `POST /api/v1/service-requests/{requestId}/quotes` với
   *      `diagnosis_id` trỏ tới chẩn đoán vừa tạo.
   *
   * BE KHÔNG cần thay đổi: `quote.service.ts` đã validate `diagnosis_id`
   * thuộc đúng assignment/request. Ưu điểm: rider nhận 1 lần duyệt thay vì
   * 2 lần, và thợ không phải chuyển qua màn hình "chẩn đoán" rồi mới
   * tới "báo giá".
   *
   * BE bắt buộc assignment = `diagnosis` khi tạo version báo giá đầu tiên
   * sau khi tới nơi → gọi `ensureDiagnosisStage()` trước.
   *
   * Nếu bước 1 thành công nhưng bước 2 thất bại → chẩn đoán ĐÃ được lưu
   * (BE upsert, không rollback được). Form báo lỗi để thợ thử lại báo giá;
   * lần sau bỏ qua bước 1 vì đã có chẩn đoán.
   */
  const submitDiagnosisAndQuote = useCallback(
    async (
      jobId: string,
      input: {
        diagnosis?: {
          diagnosis_text: string;
          safety_notes?: string;
          recommended_work_text?: string;
        };
        lines: QuoteLineInput[];
        discount_amount?: number;
        notes?: string;
        purpose?: QuotePurpose;
        labor_pricing?: RescueLaborPricingInput;
        basis_quote_id?: string;
      },
    ): Promise<{ diagnosis: DiagnosisRecord | null; quote: Quote }> => {
      if (!isBackendConfigured) {
        throw new Error('Chưa cấu hình backend. Không thể gửi báo giá.');
      }
      const job = jobs.find((j) => j.id === jobId);
      if (!job) throw new Error('Không tìm thấy job để tạo báo giá.');
      if (!requestIdMap[jobId]) {
        throw new Error('Không tìm thấy request gắn với job này.');
      }

      // Báo giá tiền công trước khi đi (rescue_labor / maintenance_labor) KHÔNG
      // được gắn chẩn đoán (BE chặn `diagnosis_id` cho pre-travel labor).
      const purpose =
        input.purpose ?? suggestPurposeForServiceType(resolveServiceType(jobId));
      const preTravel =
        purpose === 'rescue_labor' || purpose === 'maintenance_labor';

      // Bước 0: đưa assignment về `diagnosis` (BE yêu cầu cho báo giá
      // version đầu tiên sau khi tới nơi).
      if (!preTravel) {
        await ensureDiagnosisStage(jobId);
      }

      // Bước 1: tạo chẩn đoán (nếu thợ có nhập nội dung chẩn đoán).
      let diagnosis: DiagnosisRecord | null = null;
      if (input.diagnosis?.diagnosis_text?.trim()) {
        const existing = latestDiagnosisMap[jobId];
        // BE upsert diagnosis (1 record / assignment) — chỉ gọi khi chưa có.
        if (!existing || existing.id.startsWith('optimistic-')) {
          diagnosis = await submitDiagnosisForJob(jobId, {
            diagnosis_text: input.diagnosis.diagnosis_text.trim(),
            ...(input.diagnosis.safety_notes?.trim()
              ? { safety_notes: input.diagnosis.safety_notes.trim() }
              : {}),
            ...(input.diagnosis.recommended_work_text?.trim()
              ? { recommended_work_text: input.diagnosis.recommended_work_text.trim() }
              : {}),
          });
        } else {
          diagnosis = existing;
        }
      }

      // Bước 2: tạo báo giá.
      const quote = await submitQuoteForRequest(jobId, {
        lines: input.lines,
        ...(input.discount_amount !== undefined
          ? { discount_amount: input.discount_amount }
          : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        ...(diagnosis ? { diagnosis_id: diagnosis.id } : {}),
        purpose,
        ...(input.labor_pricing ? { labor_pricing: input.labor_pricing } : {}),
        ...(input.basis_quote_id ? { basis_quote_id: input.basis_quote_id } : {}),
      });

      if (!quote) throw new Error('Không thể tạo báo giá.');
      return { diagnosis, quote };
    },
    [
      isBackendConfigured,
      jobs,
      requestIdMap,
      serviceTypeMap,
      latestDiagnosisMap,
      ensureDiagnosisStage,
      submitDiagnosisForJob,
      submitQuoteForRequest,
    ],
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
      advanceJobStatus,
      startDiagnosis,
      startRepair,
      markReadyForPayment,
      submitChecklist,
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
      submitDiagnosisAndQuote,
      submitDiagnosisForJob,
      getLatestDiagnosisForJob,
      getDiagnosisHistoryForJob,
      loadDiagnosisHistory,
      getLatestPendingQuote,
      getQuotesForJob,
      loadQuotesForJob,
      hasApprovedFinalQuote,
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
      advanceJobStatus,
      startDiagnosis,
      startRepair,
      markReadyForPayment,
      submitChecklist,
      completeJob,
      toggleAvailability,
      scheduleSlots,
      dashboard,
      loading,
      error,
      reload,
      darkMode,
      toggleDarkMode,
      submitDiagnosisAndQuote,
      submitQuoteForRequest,
      submitDiagnosisForJob,
      getLatestDiagnosisForJob,
      getDiagnosisHistoryForJob,
      loadDiagnosisHistory,
      getLatestPendingQuote,
      getQuotesForJob,
      loadQuotesForJob,
      hasApprovedFinalQuote,
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
