'use client'
import { useMemo } from 'react'
import { fleet } from '../../iso/fleet'
import { useOverview } from '../../store/overview-context'

/** The Fleet figure for the scope's three most flown types, `width` px wide. */
export function useFleetFigure(width: number, mode: 'podium' | 'lineup') {
  const { scope, payload } = useOverview()
  const types = (scope?.fleet.status === 'ready' ? scope.fleet.value.topTypes : [])
    .slice(0, 3)
    .map(({ key }) => ({ icao: key, body: payload?.refs.aircraft[key]?.type ?? null }))
  const key = types.map(({ icao, body }) => `${icao}:${body}`).join(',')
  return useMemo(
    () => fleet(types, width, mode),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `types` is rebuilt every render; its types and bodies are the key.
    [key, width, mode],
  )
}
