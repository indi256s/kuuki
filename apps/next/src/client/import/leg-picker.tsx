'use client'

import type { Locale } from '../../lib/format'
import { AirportPicker } from './airport-picker'
import type { Endpoint } from './questions'
import { placeCity, type Leg } from './route-model'
import { useHeld } from './use-held'

export function LegPicker({
  locale,
  leg,
  picking,
  mobile,
  onPick,
  onClose,
  onClosed,
}: {
  locale: Locale
  leg: Leg
  picking: Endpoint | null
  mobile: boolean
  onPick: (endpoint: Endpoint, code: string) => void
  onClose: (restoreFocus: boolean) => void
  onClosed: () => void
}) {
  const [held, release] = useHeld(mobile && picking !== null)
  if (!picking && !held) return null
  return (
    <AirportPicker
      locale={locale}
      endpoint={picking}
      mobile={mobile}
      city={picking ? placeCity(leg[picking], locale) : null}
      onPick={onPick}
      onClose={onClose}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        release()
        onClosed()
      }}
    />
  )
}
