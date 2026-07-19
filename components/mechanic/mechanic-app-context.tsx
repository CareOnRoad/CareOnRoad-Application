"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  mockMechanicProfile,
  mockGarage,
  mockMechanicJobs,
  mockScheduleSlots,
  mockEarnings,
} from "@/lib/mechanic-mock-data"
import type {
  MechanicJob,
  MechanicJobStatus,
  MechanicProfile,
  GarageInfo,
  ScheduleSlot,
  MechanicEarnings,
} from "@/lib/mechanic-types"

export type MechanicScreenId =
  | "dashboard"
  | "jobs"
  | "schedule"
  | "profile"

export interface JobUpdatePayload {
  price: number
  notes?: string
  partsReplaced?: string[]
}

interface MechanicState {
  // Profile / garage
  mechanic: MechanicProfile
  garage: GarageInfo

  // Navigation
  screen: MechanicScreenId
  selectedJobId: string | null
  navigate: (screen: MechanicScreenId) => void
  openJob: (jobId: string) => void
  backToJobs: () => void

  // Jobs
  jobs: MechanicJob[]
  todayJobs: MechanicJob[]
  upcomingTodayJobs: MechanicJob[]
  getJob: (id: string) => MechanicJob | undefined
  updateJobStatus: (
    id: string,
    status: MechanicJobStatus,
    notes?: string,
  ) => void
  completeJob: (id: string, payload: JobUpdatePayload) => void

  // Schedule
  scheduleSlots: ScheduleSlot[]
  earnings: MechanicEarnings

  // Theme
  darkMode: boolean
  toggleDarkMode: () => void
}

const MechanicContext = createContext<MechanicState | null>(null)

const TODAY = "2026-07-19"

export function MechanicAppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<MechanicScreenId>("dashboard")
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<MechanicJob[]>(mockMechanicJobs)
  const [darkMode, setDarkMode] = useState(false)

  const navigate = useCallback((s: MechanicScreenId) => {
    setScreen(s)
    if (s !== "jobs") setSelectedJobId(null)
  }, [])

  const openJob = useCallback((jobId: string) => {
    setSelectedJobId(jobId)
  }, [])

  const backToJobs = useCallback(() => {
    setSelectedJobId(null)
  }, [])

  const updateJobStatus = useCallback(
    (id: string, status: MechanicJobStatus, notes?: string) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === id
            ? { ...j, status, notes: notes ?? j.notes }
            : j,
        ),
      )
    },
    [],
  )

  const completeJob = useCallback(
    (id: string, payload: JobUpdatePayload) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === id
            ? {
                ...j,
                status: "completed",
                price: payload.price,
                notes: payload.notes ?? j.notes,
                partsReplaced: payload.partsReplaced ?? j.partsReplaced,
                completedAt: new Date().toISOString(),
              }
            : j,
        ),
      )
    },
    [],
  )

  const toggleDarkMode = useCallback(() => {
    setDarkMode((d) => !d)
  }, [])

  const todayJobs = useMemo(
    () => jobs.filter((j) => j.scheduledDate === TODAY),
    [jobs],
  )

  const upcomingTodayJobs = useMemo(
    () =>
      todayJobs
        .filter((j) => j.status !== "completed")
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [todayJobs],
  )

  const getJob = useCallback(
    (id: string) => jobs.find((j) => j.id === id),
    [jobs],
  )

  const value: MechanicState = {
    mechanic: mockMechanicProfile,
    garage: mockGarage,
    screen,
    selectedJobId,
    navigate,
    openJob,
    backToJobs,
    jobs,
    todayJobs,
    upcomingTodayJobs,
    getJob,
    updateJobStatus,
    completeJob,
    scheduleSlots: mockScheduleSlots,
    earnings: mockEarnings,
    darkMode,
    toggleDarkMode,
  }

  return (
    <MechanicContext.Provider value={value}>
      {children}
    </MechanicContext.Provider>
  )
}

export function useMechanicApp() {
  const ctx = useContext(MechanicContext)
  if (!ctx)
    throw new Error("useMechanicApp must be used within MechanicAppProvider")
  return ctx
}
