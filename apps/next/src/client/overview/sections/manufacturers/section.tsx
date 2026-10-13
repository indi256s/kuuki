'use client'

import { Check } from '@keyline-icons/react'
import { MAKER_NAMES, type MakerKey } from '@kuuki/data/aircraft-makers'
import { formatDuration } from '../../../../lib/format'
import { MakerSwatch } from '../../../ui/category-mark'
import { Disclosure } from '../../../ui/disclosure'
import { useOverview } from '../../store/overview-context'
import { makerRows } from '../aircraft/model'
import { copy, flights, number } from '../rankings/display'
import { PayloadAircraftReview } from './aircraft-review'
import './manufacturers.css'

export const makerName = (key: MakerKey, locale: 'en' | 'ru') =>
  key === 'other'
    ? copy(locale, 'Other', 'Другие')
    : key === 'unknown'
      ? copy(locale, 'Unknown', 'Неизвестно')
      : MAKER_NAMES[key]

/** Details of the Aircraft card: every manufacturer with its flights, distance and time, the families folded into Other, and the review of flights still missing an aircraft. A manufacturer toggles its filter. */
export function ManufacturersDetails() {
  const { scope, locale, actions, isCurrent } = useOverview()
  if (!scope || scope.makers.status !== 'ready') return null
  const data = scope.makers.value
  const { rows } = makerRows(data)
  const approximate = data.totals.minutesApproximate ? '≈ ' : ''
  return (
    <div className="ov3-manufacturers">
      <div className="ov3-maker-legend">
        {rows.map((row) => {
          const active = scope.filter.makers?.includes(row.key) ?? false
          return (
            <div key={row.key}>
              <button
                aria-pressed={active}
                onClick={() => {
                  if (!isCurrent()) return
                  if (active) actions.remove('makers', row.key)
                  else actions.add('makers', row.key)
                }}
              >
                <MakerSwatch maker={row.key} /> {makerName(row.key, locale)}
                {active ? (
                  <Check className="ov3-maker-check" size={14} strokeWidth={2} aria-hidden="true" />
                ) : null}{' '}
                <strong>{flights(locale, row.flights)}</strong> ·{' '}
                {number(locale, Math.round(row.km))} {copy(locale, 'km', 'км')} · {approximate}
                {formatDuration(locale, row.minutes)}
              </button>
              {row.key === 'other' && data.other.length > 0 && (
                <Disclosure summary={copy(locale, 'Other families', 'Другие семейства')}>
                  {data.other.map((family) => (
                    <button
                      key={family.key}
                      onClick={() => {
                        if (isCurrent()) actions.add('families', family.family)
                      }}
                    >
                      {family.family} · {flights(locale, family.flights)}
                    </button>
                  ))}
                </Disclosure>
              )}
            </div>
          )
        })}
      </div>
      <PayloadAircraftReview />
    </div>
  )
}
