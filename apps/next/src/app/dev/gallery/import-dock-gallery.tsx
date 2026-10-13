'use client'

import { useState } from 'react'
import { DOCK, FAILURE, count, progressLabel } from '../../../client/import/copy'
import {
  ImportDockView,
  byUrgency,
  type DockItem,
  type DockKind,
} from '../../../client/import/import-dock'
import { Button } from '../../../client/ui/button'
import type { Locale } from '../../../lib/format'

// Every import dock state from fixtures, rendered in place: the live dock needs a bound import job worker.
function fixtures(locale: Locale, found: number): Record<DockKind, DockItem> {
  const base = {
    need: 0,
    stage: 'recognizing' as const,
    routes: ['IST → LHR', 'LHR → JFK', 'JFK → BOS'],
    href: '/import?batch=fixture',
    actionLabel: DOCK.review[locale],
  }
  return {
    reading: {
      ...base,
      key: 'reading',
      kind: 'reading',
      label: 'boarding-passes.pdf',
      line: progressLabel(locale, base.stage),
      found,
      href: null,
      actionLabel: null,
    },
    need: {
      ...base,
      key: 'need',
      kind: 'need',
      label: DOCK.yourText[locale],
      need: 3,
      found: 12,
      line: `${count(locale, 'flightsN', 12)}. ${count(locale, 'needYou', 3)}`,
    },
    sorted: {
      ...base,
      key: 'sorted',
      kind: 'sorted',
      label: 'itinerary.png',
      found: 4,
      line: count(locale, 'allSorted', 4),
    },
    stopped: {
      ...base,
      key: 'stopped',
      kind: 'stopped',
      label: 'statement.pdf',
      found: 7,
      line: count(locale, 'stoppedKept', 7),
    },
    failed: {
      ...base,
      key: 'failed',
      kind: 'failed',
      label: 'scan.jpg',
      found: 0,
      line: FAILURE.unavailable[locale].title,
      href: '/import',
      actionLabel: DOCK.tryAgain[locale],
    },
  }
}

export function ImportDockGallery({ locale }: { locale: Locale }) {
  const [found, setFound] = useState(3)
  const items = fixtures(locale, found)
  const several = byUrgency([items.reading, items.need, items.failed])
  const layouts = [
    { name: 'Desktop', mobile: false, width: 320 },
    { name: 'Phone', mobile: true, width: 360 },
  ]
  return (
    <section>
      <h2>Import dock</h2>
      <div className="gallery-row">
        <Button dense onClick={() => setFound((value) => value + 1)}>
          +1
        </Button>
      </div>
      {layouts.map((layout) => (
        <div key={layout.name} className="gallery-dock-layout">
          <h3>{layout.name}</h3>
          <div className="gallery-dock-grid">
            {[...Object.values(items).map((item) => [item]), several].map((list) => (
              <div
                key={list.map((item) => item.key).join('+')}
                className="gallery-dock-cell"
                style={{ inlineSize: layout.width }}
              >
                <ImportDockView items={list} locale={locale} inline mobile={layout.mobile} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
