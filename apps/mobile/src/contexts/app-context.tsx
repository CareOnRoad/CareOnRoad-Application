import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  mockVehicles,
  mockServices,
  mockAppointments,
  mockCanceledAppointments,
  mockEmergencyCalls,
} from '@/lib/mock-data';
import type {
  Vehicle,
  ServiceRecord,
  Appointment,
  CanceledAppointment,
  EmergencyCall,
} from '@/lib/types';

interface AppState {
  vehicles: Vehicle[];
  services: ServiceRecord[];
  appointments: Appointment[];
  canceledAppointments: CanceledAppointment[];
  emergencyCalls: EmergencyCall[];
  addVehicle: (v: Omit<Vehicle, 'id' | 'image'>) => void;
  updateVehicle: (v: Vehicle) => void;
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
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [services] = useState<ServiceRecord[]>(mockServices);
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [canceledAppointments, setCanceledAppointments] =
    useState<CanceledAppointment[]>(mockCanceledAppointments);
  const [emergencyCalls, setEmergencyCalls] = useState<EmergencyCall[]>(mockEmergencyCalls);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const addVehicle = useCallback((v: Omit<Vehicle, 'id' | 'image'>) => {
    setVehicles((prev) => [
      ...prev,
      {
        ...v,
        id: `v${Date.now()}`,
        image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800',
      },
    ]);
  }, []);

  const updateVehicle = useCallback((updated: Vehicle) => {
    setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  }, []);

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

  const value = useMemo<AppState>(
    () => ({
      vehicles,
      services,
      appointments,
      canceledAppointments,
      emergencyCalls,
      addVehicle,
      updateVehicle,
      addAppointment,
      cancelAppointment,
      addEmergencyCall,
      selectedVehicleId,
      selectVehicle: setSelectedVehicleId,
      selectedServiceId,
      selectService: setSelectedServiceId,
      darkMode,
      toggleDarkMode,
      user: {
        name: 'Nguyen Van An',
        phone: '+84 90 555 1234',
        email: 'an.nguyen@email.com',
        avatar: 'https://i.pravatar.cc/200?img=15',
      },
    }),
    [
      vehicles,
      services,
      appointments,
      canceledAppointments,
      emergencyCalls,
      addVehicle,
      updateVehicle,
      addAppointment,
      cancelAppointment,
      addEmergencyCall,
      selectedVehicleId,
      selectedServiceId,
      darkMode,
      toggleDarkMode,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
