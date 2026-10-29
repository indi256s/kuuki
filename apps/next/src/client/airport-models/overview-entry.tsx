'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { encodeAirportScope } from '@kuuki/shared/airportHistory'
import { NavigationLink } from '../navigation-link'
import { useOverview } from '../overview/store/overview-context'
import { captureAirportReturn } from './return-session'

export function AirportOverviewEntry({ iata }: { iata: string }) {
  const { ownerKey, filter, locale, isCurrent, flushPrefs } = useOverview()
  const router = useRouter()
  const [error, setError] = useState(false)
  let scope: string | null = null
  try {
    scope = encodeAirportScope(filter)
  } catch {
    /* The explicit action below reports a transport failure. */
  }
  const label = locale === 'ru' ? 'Открыть аэропорт' : 'Open airport'
  return (
    <>
      <NavigationLink
        href={scope === null ? '/overview' : `/airports/${iata}?scope=${scope}`}
        prefetch={false}
        className="ui-button"
        data-variant="ghost"
        data-airport-opener={`airport-${iata}`}
        onClick={async (event) => {
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          )
            return
          event.preventDefault()
          if (!isCurrent()) return
          if (scope === null) {
            setError(true)
            return
          }
          const slide = event.currentTarget.closest<HTMLElement>('.ov3-sheet-slide')
          const snapshot = captureAirportReturn(ownerKey, filter, {
            category: 'airports',
            airport: iata,
            mobileChapter: slide ? 'rankings' : null,
            pageY: window.scrollY,
            sheetY: slide?.scrollTop ?? 0,
          })
          await flushPrefs()
          if (isCurrent()) router.push(`/airports/${iata}?scope=${scope}&back=${snapshot.token}`)
        }}
      >
        <span>{label}</span>
      </NavigationLink>
      {error ? (
        <span role="alert">
          {locale === 'ru'
            ? 'Выборку не удалось передать. Сократите фильтры.'
            : 'This selection is too large to open. Reduce the filters.'}
        </span>
      ) : null}
    </>
  )
}
