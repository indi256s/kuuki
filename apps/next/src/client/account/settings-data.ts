import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { getAllFlights } from '@kuuki/client/flights'
import type { CountryClaim } from '@kuuki/client/passport'
import { useEffect, useRef, useState } from 'react'

export type SettingsCounts = {
  flights: number
  completed: number
  claims: number
  ground: number
  drafts: number
}
export type ExportKind = 'flights' | 'claims' | 'ground'
const LIMIT = 5
const LEGACY_KEY = 'kuuki-export-count'
const day = () => new Date().toISOString().slice(0, 10)
function readCount(key: string): number {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    return value?.date === day() && Number.isInteger(value.count) && value.count >= 0
      ? value.count
      : 0
  } catch {
    return 0
  }
}
/** The existing browser-local five-per-UTC-day rule, scoped by owner. Preserve today's legacy usage. */
export function useSettingsExportLimit(ownerId: string) {
  const key = `${LEGACY_KEY}:${ownerId}`
  const memory = useRef({ date: day(), count: 0 })
  const currentCount = () =>
    Math.max(
      readCount(key),
      readCount(LEGACY_KEY),
      memory.current.date === day() ? memory.current.count : 0,
    )
  const [count, setCount] = useState<number | null>(null)
  const refresh = () => setCount(currentCount())
  useEffect(() => {
    const sync = () =>
      setCount(
        Math.max(
          readCount(key),
          readCount(LEGACY_KEY),
          memory.current.date === day() ? memory.current.count : 0,
        ),
      )
    sync()
    window.addEventListener('storage', sync)
    const timer = window.setInterval(sync, 60_000)
    return () => {
      window.removeEventListener('storage', sync)
      window.clearInterval(timer)
    }
  }, [key])
  return {
    remaining: count === null ? null : Math.max(0, LIMIT - count),
    retryAt: new Date(`${day()}T00:00:00.000Z`).getTime() + 86_400_000,
    available: () => currentCount() < LIMIT,
    record: () => {
      const next = currentCount() + 1
      memory.current = { date: day(), count: next }
      try {
        localStorage.setItem(key, JSON.stringify({ date: day(), count: next }))
      } catch {
        /* Retain usage for this mounted page when storage is unavailable. */
      }
      setCount(next)
    },
    refresh,
  }
}

/** Return the real downloaded row count; an empty response never consumes the daily allowance. */
export async function downloadSettingsData(
  ownerId: string,
  kind: ExportKind,
  signal: AbortSignal,
): Promise<number> {
  const generation = getAuthGeneration()
  const current = () => !signal.aborted && generation === getAuthGeneration()
  const helpers = await import('@kuuki/client/export')
  if (!current()) return 0
  if (kind === 'flights') {
    const rows = await getAllFlights(ownerId, { signal })
    if (!current() || rows.length === 0) return 0
    helpers.exportFlights(rows)
    return rows.length
  }
  if (kind === 'claims') {
    const rows = await api.get<Omit<CountryClaim, 'user_id'>[]>('/api/passport/claims', undefined, {
      signal,
    })
    if (!current() || rows.length === 0) return 0
    helpers.exportClaims(rows.map((row) => ({ ...row, user_id: ownerId })))
    return rows.length
  }
  const rows = await api.get<Parameters<typeof import('./ground-export').exportGroundVisits>[0]>(
    '/api/passport/ground-visits',
    undefined,
    { signal },
  )
  if (!current() || rows.length === 0) return 0
  const { exportGroundVisits } = await import('./ground-export')
  if (!current()) return 0
  await exportGroundVisits(rows)
  return rows.length
}
