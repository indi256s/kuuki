import { describe, expect, it, vi } from 'vitest'
import { recordLandVisit, recordLandVisits, type LandVisitApi } from './land-visits'

const visit = (id: string, visitYear: number | null = 2026) => ({
  id,
  countryCode: 'TR',
  visitYear,
})
const stored = (id: string, visitYear: number | null) => ({
  id,
  userId: 'u1',
  countryCode: 'TR',
  visitYear,
  entryMethod: 'land' as const,
  mode: null,
  note: null,
  createdAt: '2026-11-26T00:00:00.000Z',
  derived_state: 'ready' as const,
  revision: 1,
})

describe('land visits', () => {
  it('corrects the year of a replayed visit when the leg year changed after a lost response', async () => {
    const api = {
      add: vi.fn(async () => stored('d1', 2025)),
      update: vi.fn(async () => ({ ...stored('d1', 2026), revision: 2 })),
    } as unknown as LandVisitApi
    const result = await recordLandVisit('u1', visit('d1', 2026), api)
    expect(api.add).toHaveBeenCalledWith('u1', 'TR', { visitYear: 2026, entryMethod: 'land' }, 'd1')
    expect(api.update).toHaveBeenCalledWith('u1', 'd1', { visitYear: 2026 })
    expect(result).toMatchObject({ visitYear: 2026, revision: 2 })
  })

  it('leaves a matching visit alone and clears a year the leg no longer has', async () => {
    const api = {
      add: vi
        .fn()
        .mockResolvedValueOnce(stored('d1', 2026))
        .mockResolvedValueOnce(stored('d2', 2024)),
      update: vi.fn(async () => stored('d2', null)),
    } as unknown as LandVisitApi
    await recordLandVisit('u1', visit('d1', 2026), api)
    expect(api.update).not.toHaveBeenCalled()
    await recordLandVisit('u1', visit('d2', null), api)
    expect(api.update).toHaveBeenCalledWith('u1', 'd2', { visitYear: null })
  })

  it('records at most four at once, in order, and reports each failure on its own', async () => {
    let active = 0
    let peak = 0
    const api = {
      add: vi.fn(
        async (
          _owner: string,
          _country: string,
          data: { visitYear?: number | null },
          id?: string,
        ) => {
          active++
          peak = Math.max(peak, active)
          await new Promise((resolve) => setTimeout(resolve, 1))
          active--
          if (id === 'd3') throw new Error('down')
          return stored(id!, data.visitYear ?? null)
        },
      ),
      update: vi.fn(),
    } as unknown as LandVisitApi
    const recorded: string[] = []
    const visits = Array.from({ length: 9 }, (_, index) => visit(`d${index}`))
    const results = await recordLandVisits('u1', visits, (id) => recorded.push(id), api)
    expect(peak).toBe(4)
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ])
    expect(recorded.sort()).toEqual(['d0', 'd1', 'd2', 'd4', 'd5', 'd6', 'd7', 'd8'])
  })
})
