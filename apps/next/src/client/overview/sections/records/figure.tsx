'use client'

import { useMemo } from 'react'
import { IsoFigure } from '../../iso/iso-figure'
import { foldedMap, mapPin, type MapPin } from '../../iso/map'
import { useFigureK } from '../../layout/figure-box'
import { useRepin } from './use-repin'
import '../../iso/map.css'

export type Leg = { key: string; from: MapPin; to: MapPin; equator: boolean }

const SIZING = [mapPin('AAA'), mapPin('BBB')] as const

export function RecordMapFigure({
  legs,
  reading,
  picked,
}: {
  legs: ReadonlyMap<string, Leg>
  reading: string | null
  picked: boolean
}) {
  const { shown, down, host } = useRepin(reading ?? '', picked)
  const leg = legs.get(shown) ?? (reading === null ? undefined : legs.get(reading))
  const k = useFigureK('', (k) => foldedMap(...SIZING, k))
  const figure = useMemo(
    () =>
      leg ? foldedMap(leg.from, leg.to, k, leg.equator) : foldedMap(mapPin(''), mapPin(''), k),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `leg` is rebuilt every render; its route and coordinates are the key.
    [leg?.key, leg?.from.lat, leg?.from.lon, leg?.to.lat, leg?.to.lon, leg?.equator, k],
  )
  return (
    <div
      ref={host}
      className="iso-map-host"
      data-pins={down ? 'down' : undefined}
      data-blank={leg ? undefined : ''}
    >
      <IsoFigure figure={figure} className="iso-map-pick" />
    </div>
  )
}
