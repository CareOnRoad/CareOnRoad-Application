import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import {
  getMechanicDashboard,
  getMyMechanicProfile,
  updateMyAvailability,
  type MechanicDashboardResponse,
  type MechanicProfileResponse,
} from '@/lib/mechanics-service';
import {
  listAssignments,
  submitEta,
  submitCompletionChecklist,
  transitionAssignment,
  type AssignmentResponse,
} from '@/lib/mechanic-jobs-service';
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
    case 'awaiting_payment':
      return 'pending';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu thợ');
    } finally {
      setLoading(false);
    }
  }, [authUser, isBackendConfigured, authStatus]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateJobStatus = useCallback(
    async (id: string, status: MechanicJobStatus, notes?: string) => {
      // Lưu local state trước (optimistic)
      const prevJobs = jobs;
      setJobs((curr) =>
        curr.map((j) => (j.id === id ? { ...j, status, notes: notes ?? j.notes } : j)),
      );

      if (!isBackendConfigured) return;

      // Map UI status → BE assignment status
      let beStatus: Parameters<typeof transitionAssignment>[1]['status'];
      switch (status) {
        case 'pending':
          // pending UI = chưa bắt đầu → giữ accepted
          beStatus = 'accepted';
          break;
        case 'in_progress':
          beStatus = 'in_progress';
          break;
        case 'awaiting_parts':
          beStatus = 'diagnosis'; // gần nhất có sẵn
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
    }),
    [
      mechanic,
      garage,
      jobs,
      todayJobs,
      upcomingTodayJobs,
      getJob,
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
