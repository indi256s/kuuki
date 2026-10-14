import { CircleAlert } from '@keyline-icons/react'
import type { Locale } from '../../lib/format'
import { summarizeAircraftRun, type AircraftRunCounts } from './aircraft-review'

export function AircraftAnnouncement({
  locale,
  counts,
  status = '',
  statusClassName,
  alertClassName,
}: {
  locale: Locale
  counts: AircraftRunCounts | null
  status?: string
  statusClassName?: string
  alertClassName?: string
}) {
  const summary = summarizeAircraftRun(locale, counts)
  const saved = (counts?.saved ?? 0) > 0
  // Keep both regions mounted so each submission can update the appropriate live region.
  return (
    <>
      <p className={statusClassName} role="status">
        {[saved ? summary : '', status].filter(Boolean).join(' ')}
      </p>
      <p className={alertClassName} role="alert">
        {!saved && summary ? (
          <>
            <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
            <span>{summary}</span>
          </>
        ) : null}
      </p>
    </>
  )
}
