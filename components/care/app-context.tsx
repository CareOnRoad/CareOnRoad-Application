"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react"
import {
  mockVehicles,
  mockServices,
  mockAppointments,
} from "@/lib/mock-data"
import type {
  Vehicle,
  ServiceRecord,
  Appointment,
  ScreenId,
  TabId,
} from "@/lib/types"

interface AppState {
  // navigation
  screen: ScreenId
  activeTab: TabId
  navigate: (screen: ScreenId) => void
  setTab: (tab: TabId) => void

  // data
  vehicles: Vehicle[]
  services: ServiceRecord[]
  appointments: Appointment[]
  addVehicle: (v: Omit<Vehicle, "id" | "image">) => void
  updateVehicle: (v: Vehicle) => void
  addAppointment: (a: Omit<Appointment, "id">) => Appointment

  // selection
  selectedVehicleId: string | null
  selectVehicle: (id: string | null) => void
  selectedServiceId: string | null
  selectService: (id: string | null) => void

  // theme
  darkMode: boolean
  toggleDarkMode: () => void

  // user
  user: { name: string; phone: string; email: string; avatar: string }
}

const AppContext = createContext<AppState | null>(null)

const tabScreens: TabId[] = ["home", "vehicles", "rescue", "schedule", "profile"]

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>("home")
  const [activeTab, setActiveTab] = useState<TabId>("home")
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles)
  const [services] = useState<ServiceRecord[]>(mockServices)
  const [appointments, setAppointments] =
    useState<Appointment[]>(mockAppointments)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(false)

  const navigate = useCallback((s: ScreenId) => {
    setScreen(s)
    if (tabScreens.includes(s as TabId)) {
      setActiveTab(s as TabId)
    }
  }, [])

  const setTab = useCallback((tab: TabId) => {
    setActiveTab(tab)
    setScreen(tab)
  }, [])

  const addVehicle = useCallback((v: Omit<Vehicle, "id" | "image">) => {
    setVehicles((prev) => [
      ...prev,
      {
        ...v,
        id: `v${Date.now()}`,
        image: "/generic-motorcycle.jpg",
      },
    ])
  }, [])

  const updateVehicle = useCallback((updated: Vehicle) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === updated.id ? updated : v)),
    )
  }, [])

  const addAppointment = useCallback((a: Omit<Appointment, "id">) => {
    const appt: Appointment = { ...a, id: `a${Date.now()}` }
    setAppointments((prev) => [appt, ...prev])
    return appt
  }, [])

  const toggleDarkMode = useCallback(() => {
    setDarkMode((d) => !d)
  }, [])

  const value: AppState = {
    screen,
    activeTab,
    navigate,
    setTab,
    vehicles,
    services,
    appointments,
    addVehicle,
    updateVehicle,
    addAppointment,
    selectedVehicleId,
    selectVehicle: setSelectedVehicleId,
    selectedServiceId,
    selectService: setSelectedServiceId,
    darkMode,
    toggleDarkMode,
    user: {
      name: "Nguyen Van An",
      phone: "+84 90 555 1234",
      email: "an.nguyen@email.com",
      avatar: "/young-vietnamese-man-portrait.jpg",
    },
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
