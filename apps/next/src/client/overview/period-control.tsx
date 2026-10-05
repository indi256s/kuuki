'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { SegmentedControl } from '../ui/segmented-control'
import type { Locale } from '../../lib/format'
import { S, t } from './copy'

const VISIBLE_YEARS = 4

/** All time plus the newest years as one control; older years stay in a native select. The URL is the only state. */
export function PeriodControl({ locale, period, years }: { locale: Locale; period: string; years: number[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const selected = period === 'all' ? null : Number(period)
  const list = [...new Set([...years, ...(selected ? [selected] : [])])].sort((a, b) => b - a)
  const visible = list.slice(0, VISIBLE_YEARS)
  if (selected && !visible.includes(selected)) visible.push(selected)
  const older = list.filter(year => !visible.includes(year))
  const go = (value: string) => start(() => router.push(value === 'all' ? '/overview' : `/overview?year=${value}`))
  return <div className="ov-period" aria-busy={pending ? 'true' : undefined}>
    <SegmentedControl label={t(S.period, locale)} value={period} onChange={go}
      options={[{ value: 'all', label: t(S.all, locale) }, ...visible.map(year => ({ value: String(year), label: String(year) }))]} />
    {older.length ? <label className="ov-older"><span className="sr-only">{t(S.earlier, locale)}</span>
      <select value="" onChange={event => event.target.value && go(event.target.value)}>
        <option value="">{t(S.earlier, locale)}</option>{older.map(year => <option key={year} value={year}>{year}</option>)}
      </select></label> : null}
  </div>
}
