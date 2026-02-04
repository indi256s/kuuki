import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ExtractedFlight } from '../hooks/useImport'

/**
 * Background import job stored in localStorage.
 * Survives page refresh and enables "Continue in Background" flow.
 */
export interface BackgroundJob {
  jobId: string
  basicFlights: ExtractedFlight[]
  startedAt: number
  // Track which page the user was on when they clicked "Continue in Background"
  returnPath?: string
}

interface ImportStore {
  // Active background jobs (keyed by jobId)
  backgroundJobs: Record<string, BackgroundJob>

  // Add a new background job
  addBackgroundJob: (job: BackgroundJob) => void

  // Remove a background job (after user reviews or dismisses)
  removeBackgroundJob: (jobId: string) => void

  // Get all active jobs
  getActiveJobs: () => BackgroundJob[]

  // Clear all expired jobs (older than 10 minutes)
  clearExpiredJobs: () => void
}

const JOB_TTL_MS = 10 * 60 * 1000 // 10 minutes (matches backend KV TTL)

export const useImportStore = create<ImportStore>()(
  persist(
    (set, get) => ({
      backgroundJobs: {},

      addBackgroundJob: (job) => {
        set((state) => ({
          backgroundJobs: {
            ...state.backgroundJobs,
            [job.jobId]: job,
          },
        }))
      },

      removeBackgroundJob: (jobId) => {
        set((state) => {
          const { [jobId]: removed, ...rest } = state.backgroundJobs
          return { backgroundJobs: rest }
        })
      },

      getActiveJobs: () => {
        const now = Date.now()
        const jobs = get().backgroundJobs
        return Object.values(jobs).filter(
          (job) => now - job.startedAt < JOB_TTL_MS
        )
      },

      clearExpiredJobs: () => {
        const now = Date.now()
        set((state) => {
          const active: Record<string, BackgroundJob> = {}
          for (const [id, job] of Object.entries(state.backgroundJobs)) {
            if (now - job.startedAt < JOB_TTL_MS) {
              active[id] = job
            }
          }
          return { backgroundJobs: active }
        })
      },
    }),
    {
      name: 'kuuki-import-jobs', // localStorage key
      version: 1,
    }
  )
)
