'use client'

import { useState } from 'react'
import { SegmentedControl } from '../../../ui/segmented-control'
import { useOverview } from '../../store/overview-context'
import { FleetContent } from '../fleet/section'
import { MakersContent } from '../manufacturers/section'
import type { Span } from '../registry'
import { CoverageNote, copy } from '../rankings/display'
import './aircraft.css'

export function Section({ span }: { span: Span }) {
  const { scope, locale } = useOverview()
  const [view, setView] = useState<'makers' | 'fleet'>('makers')
  if (!scope) return null
  if (scope.fleet.status !== 'ready') return null
  return (
    <div className="ov3-aircraft" data-span={span}>
      <SegmentedControl
        value={view}
        onChange={setView}
        label={copy(locale, 'Aircraft view', 'Вид самолётов')}
        options={[
          { value: 'makers', label: copy(locale, 'Makers', 'Производители') },
          { value: 'fleet', label: copy(locale, 'Fleet', 'Парк') },
        ]}
      />
      <CoverageNote
        have={scope.coverage.typed}
        total={scope.coverage.total}
        en="Based on {n} of {m} flights with an aircraft"
        ru="По {n} из {m} перелётов с самолётом"
      />
      {view === 'makers' ? <MakersContent span={span} /> : <FleetContent span={span} />}
    </div>
  )
}
