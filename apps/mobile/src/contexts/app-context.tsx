import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  archiveMotorcycle as apiArchiveMotorcycle,
  createMotorcycle as apiCreateMotorcycle,
  fromVehicleInput,
  listMotorcycles,
  updateMotorcycle as apiUpdateMotorcycle,
} from '@/lib/motorcycles-service';
import {
  listServiceRequests,
  type ServiceRequestResponse,
  type RequestStatus,
} from '@/lib/service-requests-service';
import { listAssignments, type AssignmentListItem } from '@/lib/assignments-service';
import { getLatestPendingQuote, type Quote } from '@/lib/quotes-service';
import { listReminders, type Reminder } from '@/lib/reminders-service';
import {
  getUnreadCount,
  listNotifications,
  type NotificationItem,
} from '@/lib/notifications-service';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import type {
  Vehicle,
  ServiceRecord,
  Appointment,
  CanceledAppointment,
  EmergencyCall,
} from '@/lib/types';

/**
 * AppProvider — trạng thái tập trung cho rider UI.
 *
 * Quy tắc wire dữ liệu (BE-first):
 *  - vehicles       : GET /api/v1/motorcycles
 *  - services       : derive từ GET /api/v1/service-requests (status=completed)
 *  - appointments   : derive từ service-requests (status active + scheduled)
 *  - canceledAppt   : derive từ service-requests (status=canceled)
 *  - emergencyCalls : derive từ service-requests (service_type=emergency_rescue, status=completed)
 *
 * Trước đây các field trên (trừ vehicles) khởi tạo từ mock data — đã xoá.
 * User mới đăng ký giờ sẽ thấy danh sách rỗng thay vì mock Honda Vision/Exciter
 * hoặc 4 cuộc cứu hộ giả. EmptyState đã được handle ở các page tương ứng.
 */

interface AppState {
  vehicles: Vehicle[];
  vehiclesLoading: boolean;
  vehiclesError: string | null;
  reloadVehicles: () => Promise<void>;

  services: ServiceRecord[];
  appointments: Appointment[];
  canceledAppointments: CanceledAppointment[];
  emergencyCalls: EmergencyCall[];
  servicesLoading: boolean;
  servicesError: string | null;
  reloadServices: () => Promise<void>;

  addVehicle: (v: {
    brand: string;
    model: string;
    plate: string;
    year?: number;
    notes?: string;
  }) => Promise<Vehicle | null>;
  updateVehicle: (v: Vehicle) => Promise<Vehicle | null>;
  archiveVehicle: (id: string) => Promise<boolean>;

  selectedVehicleId: string | null;
  selectVehicle: (id: string | null) => void;
  selectedServiceId: string | null;
  selectService: (id: string | null) => void;

  darkMode: boolean;
  toggleDarkMode: () => void;

  user: { name: string; phone: string; email: string; avatar: string; address: string };

  // ---- Reminders aggregate (3.1) ----
  reminders: Reminder[];
  remindersLoading: boolean;
  remindersError: string | null;
  reloadReminders: () => Promise<void>;

  // ---- Notifications aggregate (3.1) ----
  /**
   * Top-10 notifications mới nhất, phục vụ bell badge + home screen preview.
   * List đầy đủ + markRead/markAllRead vẫn ở `useNotifications` hook
   * (xem `app/rider/notifications.tsx` + `app/mechanic/notifications.tsx`).
   */
  notifications: NotificationItem[];
  unreadCount: number;
  notificationsLoading: boolean;
  reloadNotifications: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

// =========================================================
// Mapping helpers: BE ServiceRequest → UI shape
//
// BE không lưu `mechanic`/`price` trực tiếp trên service_request —
// lấy từ assignment (mechanic_id) + quote (total_amount).
// Khi assignment/quote không có sẵn, fallback sang giá trị placeholder
// để UI không crash.
// =========================================================

const UNKNOWN_MECHANIC = 'Thợ CareOnRoad';
const NO_QUOTE_PLACEHOLDER = 0;

function requestToServiceRecord(
  req: ServiceRequestResponse,
  assignmentByReqId: Map<string, AssignmentListItem>,
  quoteByReqId: Map<string, Quote>,
  vehicleNameById: Map<string, string>,
): ServiceRecord {
  const assignment = assignmentByReqId.get(req.id);
  const quote = quoteByReqId.get(req.id);
  return {
    id: req.id,
    date: (req.scheduled_start_at ?? req.created_at).slice(0, 10),
    type: mapServiceTypeToLabel(req.service_type),
    vehicleName: vehicleNameById.get(req.motorcycle_id) ?? 'Xe',
    vehicleId: req.motorcycle_id,
    price: quote?.total_amount ?? NO_QUOTE_PLACEHOLDER,
    mechanic: assignment ? assignment.mechanic_id.slice(0, 8) : UNKNOWN_MECHANIC,
    status: 'completed',
    notes: req.problem_description || undefined,
  };
}

function requestToAppointment(
  req: ServiceRequestResponse,
  vehicleNameById: Map<string, string>,
): Appointment {
  const dt = req.scheduled_start_at ? new Date(req.scheduled_start_at) : new Date(req.created_at);
  return {
    id: req.id,
    vehicleId: req.motorcycle_id,
    vehicleName: vehicleNameById.get(req.motorcycle_id) ?? 'Xe',
    service: mapServiceTypeToLabel(req.service_type),
    date: dt.toISOString().slice(0, 10),
    time: dt.toTimeString().slice(0, 5),
    status: 'confirmed',
  };
}

function requestToCanceled(
  req: ServiceRequestResponse,
  vehicleNameById: Map<string, string>,
): CanceledAppointment {
  const dt = req.scheduled_start_at ? new Date(req.scheduled_start_at) : new Date(req.created_at);
  return {
    id: req.id,
    vehicleName: vehicleNameById.get(req.motorcycle_id) ?? 'Xe',
    service: mapServiceTypeToLabel(req.service_type),
    date: dt.toISOString().slice(0, 10),
    time: dt.toTimeString().slice(0, 5),
    canceledAt: req.updated_at,
    reason: req.canceled_reason ?? 'Không có lý do',
  };
}

function requestToEmergencyCall(
  req: ServiceRequestResponse,
  assignmentByReqId: Map<string, AssignmentListItem>,
  quoteByReqId: Map<string, Quote>,
  vehicleNameById: Map<string, string>,
): EmergencyCall {
  const assignment = assignmentByReqId.get(req.id);
  const quote = quoteByReqId.get(req.id);
  const dt = req.scheduled_start_at ? new Date(req.scheduled_start_at) : new Date(req.created_at);
  return {
    id: req.id,
    vehicleName: vehicleNameById.get(req.motorcycle_id) ?? 'Xe',
    issue: req.problem_description.slice(0, 80) || 'Cứu hộ khẩn cấp',
    damageDescription: req.problem_description,
    repairs: req.maintenance_notes ?? 'Đã xử lý theo báo giá được duyệt.',
    date: dt.toISOString().slice(0, 10),
    time: dt.toTimeString().slice(0, 5),
    mechanicName: assignment ? assignment.mechanic_id.slice(0, 8) : UNKNOWN_MECHANIC,
    price: quote?.total_amount ?? NO_QUOTE_PLACEHOLDER,
    status: 'completed',
  };
}

function mapServiceTypeToLabel(serviceType: string): string {
  switch (serviceType) {
    case 'emergency_rescue':
      return 'Cứu hộ khẩn cấp';
    case 'mobile_repair':
      return 'Sửa chữa lưu động';
    case 'at_home_service':
      return 'Dịch vụ tại nhà';
    case 'periodic_maintenance':
      return 'Bảo dưỡng định kỳ';
    case 'other':
      return 'Khác';
    default:
      return serviceType;
  }
}

const ACTIVE_REQUEST_STATUSES: RequestStatus[] = [
  'submitted',
  'dispatching',
  'offered',
  'assigned',
  'mechanic_en_route',
  'in_service',
  'awaiting_quote_approval',
  'awaiting_payment',
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, isBackendConfigured, status: authStatus } = useAuth();

  // =========================================================
  // Vehicles state (giữ nguyên như trước, đã wire BE)
  // =========================================================
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  // =========================================================
  // Services / appointments / emergency calls (derive từ service-requests)
  // =========================================================
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [canceledAppointments, setCanceledAppointments] = useState<CanceledAppointment[]>([]);
  const [emergencyCalls, setEmergencyCalls] = useState<EmergencyCall[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  // ---- Reminders aggregate (3.1) ----
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState<string | null>(null);

  // ---- Notifications aggregate (3.1) ----
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // =========================================================
  // Vehicles: reload từ BE
  // =========================================================
  const reloadVehicles = useCallback(async () => {
    if (!isBackendConfigured) {
      // Demo mode không có BE — để rỗng, EmptyState sẽ hướng dẫn user.
      setVehicles([]);
      return;
    }
    setVehiclesLoading(true);
    setVehiclesError(null);
    try {
      const items = await listMotorcycles();
      setVehicles(items);
    } catch (e) {
      const message =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Không thể tải danh sách xe';
      setVehiclesError(message);
    } finally {
      setVehiclesLoading(false);
    }
  }, [isBackendConfigured]);

  // =========================================================
  // Services: reload từ BE service-requests rồi derive 4 danh sách UI.
  //
  // Vì một ServiceRequest có thể vừa là canceled, vừa có appointment liên quan
  // nên ta lấy:
  //   - listServiceRequests()          -> gốc
  //   - listAssignments()              -> mechanic cho từng request
  //   - getLatestPendingQuote(req.id)  -> giá + lines (cho mỗi request completed)
  //
  // Khi BE không có route để bulk-fetch quotes, fallback graceful:
  // mỗi request gọi getLatestPendingQuote riêng (chấp nhận N+1 cho list nhỏ).
  // =========================================================
  const reloadServices = useCallback(async () => {
    if (!isBackendConfigured) {
      setServices([]);
      setAppointments([]);
      setCanceledAppointments([]);
      setEmergencyCalls([]);
      return;
    }
    setServicesLoading(true);
    setServicesError(null);
    try {
      const requests = await listServiceRequests();
      const vehicleNameById = new Map<string, string>(vehicles.map((v) => [v.id, v.name]));

      // Build assignment map
      const assignmentByReqId = new Map<string, AssignmentListItem>();
      try {
        const assignmentsPage = await listAssignments({ limit: 100 });
        for (const a of assignmentsPage.items) {
          assignmentByReqId.set(a.request_id, a);
        }
      } catch {
        // ignore — list rỗng vẫn OK
      }

      // Build quote map (best-effort, từng request)
      const quoteByReqId = new Map<string, Quote>();
      await Promise.all(
        requests.map(async (r) => {
          try {
            const q = await getLatestPendingQuote(r.id);
            if (q) quoteByReqId.set(r.id, q);
          } catch {
            // request chưa có quote hoặc 403 — bỏ qua
          }
        }),
      );

      const completed = requests.filter((r) => r.status === 'completed');
      const canceled = requests.filter((r) => r.status === 'canceled');
      const active = requests.filter((r) => ACTIVE_REQUEST_STATUSES.includes(r.status));
      const emergencies = completed.filter((r) => r.service_type === 'emergency_rescue');

      setServices(completed.map((r) =>
        requestToServiceRecord(r, assignmentByReqId, quoteByReqId, vehicleNameById),
      ));
      setAppointments(active.map((r) => requestToAppointment(r, vehicleNameById)));
      setCanceledAppointments(canceled.map((r) => requestToCanceled(r, vehicleNameById)));
      setEmergencyCalls(emergencies.map((r) =>
        requestToEmergencyCall(r, assignmentByReqId, quoteByReqId, vehicleNameById),
      ));
    } catch (e) {
      const message =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Không thể tải danh sách dịch vụ';
      setServicesError(message);
    } finally {
      setServicesLoading(false);
    }
  }, [isBackendConfigured, vehicles]);

  // =========================================================
  // Reminders reload
  // =========================================================
  const reloadReminders = useCallback(async () => {
    if (!isBackendConfigured) {
      setReminders([]);
      return;
    }
    setRemindersLoading(true);
    setRemindersError(null);
    try {
      const items = await listReminders();
      setReminders(items);
    } catch (e) {
      const message =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Không thể tải nhắc nhở';
      setRemindersError(message);
    } finally {
      setRemindersLoading(false);
    }
  }, [isBackendConfigured]);

  // =========================================================
  // Notifications aggregate reload - chỉ lấy top-10 + unread count
  // cho bell badge + home preview. Detail screen dùng useNotifications hook.
  // =========================================================
  const reloadNotifications = useCallback(async () => {
    if (!isBackendConfigured) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setNotificationsLoading(true);
    try {
      const [count, listRes] = await Promise.all([
        getUnreadCount().catch(() => 0),
        listNotifications({ limit: 10 }).catch(() => ({ items: [] as NotificationItem[] })),
      ]);
      setUnreadCount(count);
      setNotifications(listRes.items);
    } finally {
      setNotificationsLoading(false);
    }
  }, [isBackendConfigured]);

  // Trigger reloadVehicles khi auth thay đổi
  useEffect(() => {
    if (!isBackendConfigured) return;
    if (authStatus !== 'authenticated') return;
    void reloadVehicles();
  }, [isBackendConfigured, authStatus, reloadVehicles]);

  // Sau khi vehicles load xong, fetch services (vì cần vehicleName lookup).
  useEffect(() => {
    if (!isBackendConfigured) return;
    if (authStatus !== 'authenticated') return;
    // Chỉ fetch services khi vehicles đã sẵn sàng (initial load).
    if (vehiclesLoading) return;
    void reloadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBackendConfigured, authStatus, vehiclesLoading]);

  // Reminders + notifications aggregate - load khi auth ready
  useEffect(() => {
    if (!isBackendConfigured) return;
    if (authStatus !== 'authenticated') return;
    void reloadReminders();
    void reloadNotifications();
    // Polling unread count mỗi 60s (ít hơn hook 30s vì chỉ cần bell badge).
    const interval = setInterval(() => {
      void reloadNotifications();
    }, 60_000);
    return () => clearInterval(interval);
  }, [isBackendConfigured, authStatus, reloadReminders, reloadNotifications]);

  // =========================================================
  // Vehicles CRUD
  // =========================================================
  const addVehicle = useCallback(
    async (input: { brand: string; model: string; plate: string; year?: number; notes?: string }) => {
      if (!isBackendConfigured) {
        // Demo fallback: giữ shape nhưng KHÔNG dùng mock data gốc.
        // Khi backend lên, demo mode sẽ hiển thị EmptyState đúng nghĩa.
        const local: Vehicle = {
          id: `local-${Date.now()}`,
          name: `${input.brand || 'Xe máy'} ${input.model || 'Xe'}`.trim(),
          brand: input.brand.trim() || 'Xe máy',
          plate: input.plate.trim(),
          mileage: 0,
          color: '—',
          year: input.year ?? new Date().getFullYear(),
          lastMaintenance: new Date().toISOString().slice(0, 10),
          nextMaintenance: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120)
            .toISOString()
            .slice(0, 10),
          image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800',
        };
        setVehicles((prev) => [local, ...prev]);
        return local;
      }
      try {
        const created = await apiCreateMotorcycle(fromVehicleInput(input));
        setVehicles((prev) => [created, ...prev]);
        return created;
      } catch (e) {
        setVehiclesError(e instanceof Error ? e.message : 'Không thể thêm xe');
        return null;
      }
    },
    [isBackendConfigured],
  );

  const updateVehicle = useCallback(
    async (next: Vehicle): Promise<Vehicle | null> => {
      if (!isBackendConfigured) {
        setVehicles((prev) => prev.map((v) => (v.id === next.id ? next : v)));
        return next;
      }
      try {
        const updated = await apiUpdateMotorcycle(next.id, {
          brand_text: next.brand,
          model_text: next.name.replace(next.brand, '').trim() || next.name,
          license_plate: next.plate || undefined,
          year: next.year,
        });
        setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
        return updated;
      } catch (e) {
        setVehiclesError(e instanceof Error ? e.message : 'Không thể cập nhật xe');
        return null;
      }
    },
    [isBackendConfigured],
  );

  const archiveVehicle = useCallback(
    async (id: string): Promise<boolean> => {
      if (!isBackendConfigured) {
        setVehicles((prev) => prev.filter((v) => v.id !== id));
        return true;
      }
      try {
        await apiArchiveMotorcycle(id);
        setVehicles((prev) => prev.filter((v) => v.id !== id));
        return true;
      } catch (e) {
        setVehiclesError(e instanceof Error ? e.message : 'Không thể lưu trữ xe');
        return false;
      }
    },
    [isBackendConfigured],
  );

  const toggleDarkMode = useCallback(() => setDarkMode((d) => !d), []);

  // Ưu tiên user từ auth session, fallback empty string (KHÔNG mock data).
  const mergedUser = useMemo(
    () => ({
      name: authUser?.name ?? '',
      phone: authUser?.phone ?? '',
      email: authUser?.email ?? '',
      avatar: authUser?.avatar ?? '',
      address: authUser?.address ?? '',
    }),
    [authUser?.name, authUser?.phone, authUser?.email, authUser?.avatar, authUser?.address],
  );

  const value = useMemo<AppState>(
    () => ({
      vehicles,
      vehiclesLoading,
      vehiclesError,
      reloadVehicles,
      services,
      appointments,
      canceledAppointments,
      emergencyCalls,
      servicesLoading,
      servicesError,
      reloadServices,
      addVehicle,
      updateVehicle,
      archiveVehicle,
      selectedVehicleId,
      selectVehicle: setSelectedVehicleId,
      selectedServiceId,
      selectService: setSelectedServiceId,
      darkMode,
      toggleDarkMode,
      user: mergedUser,
      reminders,
      remindersLoading,
      remindersError,
      reloadReminders,
      notifications,
      unreadCount,
      notificationsLoading,
      reloadNotifications,
    }),
    [
      vehicles,
      vehiclesLoading,
      vehiclesError,
      reloadVehicles,
      services,
      appointments,
      canceledAppointments,
      emergencyCalls,
      servicesLoading,
      servicesError,
      reloadServices,
      addVehicle,
      updateVehicle,
      archiveVehicle,
      selectedVehicleId,
      selectedServiceId,
      darkMode,
      toggleDarkMode,
      mergedUser,
      reminders,
      remindersLoading,
      remindersError,
      reloadReminders,
      notifications,
      unreadCount,
      notificationsLoading,
      reloadNotifications,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
