import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  mockVehicles,
  mockServices,
  mockAppointments,
  mockCanceledAppointments,
  mockEmergencyCalls,
} from '@/lib/mock-data';
import {
  archiveMotorcycle as apiArchiveMotorcycle,
  createMotorcycle as apiCreateMotorcycle,
  fromVehicleInput,
  listMotorcycles,
  updateMotorcycle as apiUpdateMotorcycle,
} from '@/lib/motorcycles-service';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import type {
  Vehicle,
  ServiceRecord,
  Appointment,
  CanceledAppointment,
  EmergencyCall,
} from '@/lib/types';

interface AppState {
  vehicles: Vehicle[];
  vehiclesLoading: boolean;
  vehiclesError: string | null;
  reloadVehicles: () => Promise<void>;
  services: ServiceRecord[];
  appointments: Appointment[];
  canceledAppointments: CanceledAppointment[];
  emergencyCalls: EmergencyCall[];
  addVehicle: (v: {
    brand: string;
    model: string;
    plate: string;
    year?: number;
    notes?: string;
  }) => Promise<Vehicle | null>;
  updateVehicle: (v: Vehicle) => Promise<Vehicle | null>;
  archiveVehicle: (id: string) => Promise<boolean>;
  addAppointment: (a: Omit<Appointment, 'id'>) => Appointment;
  cancelAppointment: (id: string, reason: string) => void;
  addEmergencyCall: (
    c: Omit<EmergencyCall, 'id' | 'status'> & { status?: EmergencyCall['status'] },
  ) => EmergencyCall;

  selectedVehicleId: string | null;
  selectVehicle: (id: string | null) => void;
  selectedServiceId: string | null;
  selectService: (id: string | null) => void;

  darkMode: boolean;
  toggleDarkMode: () => void;

  user: { name: string; phone: string; email: string; avatar: string };
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, isBackendConfigured, status: authStatus } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  const [services] = useState<ServiceRecord[]>(mockServices);
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [canceledAppointments, setCanceledAppointments] =
    useState<CanceledAppointment[]>(mockCanceledAppointments);
  const [emergencyCalls, setEmergencyCalls] = useState<EmergencyCall[]>(mockEmergencyCalls);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  // =========================================================
  // Load vehicles từ backend khi đã cấu hình + đã đăng nhập.
  // =========================================================
  const reloadVehicles = useCallback(async () => {
    if (!isBackendConfigured) {
      setVehicles(mockVehicles);
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

  useEffect(() => {
    if (!isBackendConfigured) return;
    if (authStatus !== 'authenticated') return;
    reloadVehicles();
  }, [isBackendConfigured, authStatus, reloadVehicles]);

  // =========================================================
  // Vehicles CRUD
  // =========================================================
  const addVehicle = useCallback(
    async (input: { brand: string; model: string; plate: string; year?: number; notes?: string }) => {
      if (!isBackendConfigured) {
        // Demo fallback: thêm vào state local nhưng giữ API shape.
        const local: Vehicle = {
          id: `v${Date.now()}`,
          name: `${input.brand || 'Motorcycle'} ${input.model || 'Vehicle'}`.trim(),
          brand: input.brand.trim() || 'Motorcycle',
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

  // =========================================================
  // Appointments / Emergency calls (giữ mock)
  // =========================================================
  const addAppointment = useCallback((a: Omit<Appointment, 'id'>) => {
    const appt: Appointment = { ...a, id: `a${Date.now()}` };
    setAppointments((prev) => [appt, ...prev]);
    return appt;
  }, []);

  const cancelAppointment = useCallback((id: string, reason: string) => {
    setAppointments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) {
        const canceled: CanceledAppointment = {
          id: `ca${Date.now()}`,
          vehicleName: target.vehicleName,
          service: target.service,
          date: target.date,
          time: target.time,
          canceledAt: new Date().toISOString(),
          reason: reason || 'Không có lý do',
        };
        setCanceledAppointments((prevCanceled) => [canceled, ...prevCanceled]);
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const addEmergencyCall = useCallback(
    (
      c: Omit<EmergencyCall, 'id' | 'status'> & {
        status?: EmergencyCall['status'];
      },
    ) => {
      const call: EmergencyCall = {
        ...c,
        id: `e${Date.now()}`,
        status: c.status ?? 'completed',
      };
      setEmergencyCalls((prev) => [call, ...prev]);
      return call;
    },
    [],
  );

  const toggleDarkMode = useCallback(() => setDarkMode((d) => !d), []);

  // Ưu tiên user từ auth session, fallback mock data.
  const mergedUser = useMemo(
    () => ({
      name: authUser?.name ?? 'Nguyen Van An',
      phone: authUser?.phone ?? '+84 90 555 1234',
      email: authUser?.email ?? 'an.nguyen@email.com',
      avatar:
        authUser?.avatar ?? 'https://i.pravatar.cc/200?img=15',
    }),
    [authUser?.name, authUser?.phone, authUser?.email, authUser?.avatar],
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
      addVehicle,
      updateVehicle,
      archiveVehicle,
      addAppointment,
      cancelAppointment,
      addEmergencyCall,
      selectedVehicleId,
      selectVehicle: setSelectedVehicleId,
      selectedServiceId,
      selectService: setSelectedServiceId,
      darkMode,
      toggleDarkMode,
      user: mergedUser,
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
      addVehicle,
      updateVehicle,
      archiveVehicle,
      addAppointment,
      cancelAppointment,
      addEmergencyCall,
      selectedVehicleId,
      selectedServiceId,
      darkMode,
      toggleDarkMode,
      mergedUser,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
