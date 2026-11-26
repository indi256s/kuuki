'use client'

import { useId, useState } from 'react'
import { formatCount, formatNumber, type Locale } from '../../lib/format'
import { countryNamer } from '../passport/model'
import { CountryStamp } from '../stamps'
import { count } from './copy'
import { R, RC } from './route-copy'
import type { Reach } from './route-model'

const SHOWN = 10
const SIZE = 44

export function StampStrip({ locale, reach }: { locale: Locale; reach: Reach[] }) {
  const id = useId()
  const [baseline, setBaseline] = useState<ReadonlySet<string> | null>(null)
  const [presses, setPresses] = useState<Readonly<Record<string, number>>>({})
  const lit = reach.filter((item) => item.lit).map((item) => item.code)
  if (reach.length && baseline === null) setBaseline(new Set(lit))
  else if (baseline && (lit.some((code) => !baseline.has(code)) || lit.length < baseline.size)) {
    const next = { ...presses }
    for (const code of lit) if (!baseline.has(code)) next[code] = (next[code] ?? 0) + 1
    setPresses(next)
    setBaseline(new Set(lit))
  }
  if (!reach.length) return null
  const name = countryNamer(locale)
  const shown = reach.slice(0, SHOWN)
  const hidden = reach.length - shown.length
  return (
    <div className="stamp-strip">
      <p id={`${id}-label`} className="stamp-strip-count">
        {formatCount(locale, reach.length, RC.ofCountries).replace(
          '{lit}',
          formatNumber(locale, lit.length),
        )}
      </p>
      <ul className="stamp-strip-list" aria-labelledby={`${id}-label`}>
        {shown.map(({ code, lit: on }) => (
          <li key={code} data-lit={on ? '' : undefined} title={name(code)}>
            {on ? (
              <CountryStamp
                iso2={code}
                status="inked"
                size={SIZE}
                worn={false}
                static={!presses[code]}
                impressionId={
                  presses[code] ? `import-strip:${id}:${code}:${presses[code]}` : undefined
                }
              />
            ) : (
              <span className="stamp-ghost" aria-hidden="true">
                {code}
              </span>
            )}
            <span className="sr-only">
              {name(code)}
              {on ? '' : `, ${R.ghost[locale]}`}
            </span>
          </li>
        ))}
        {hidden > 0 ? <li className="stamp-strip-more">{count(locale, 'more', hidden)}</li> : null}
      </ul>
    </div>
  )
}
