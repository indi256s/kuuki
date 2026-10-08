'use client'

import { useMemo, type ComponentProps } from 'react'
import { isEmptyFilter } from '@kuuki/shared/overview/filter'
import type { OverviewFilter } from '@kuuki/shared/overview/model'
import { OverviewProvider, useOverview } from '../store/overview-context'
import { OverviewFlightSheet } from '../store/open-flight'
import { HeroPanel } from '../hero/hero-panel'
import { NextStrip } from '../hero/next-strip'
import { GlobeCard } from '../globe/globe-card'
import { SvgGlobe } from '../globe/svg-globe'
import { referenceLabels } from '../labels'
import { S, t } from '../copy'
import { Skeleton } from '../../ui/skeleton'
import { Chip } from '../../ui/chip'
import { useMobile } from '../../ui/use-mobile'
import { formatNumber } from '../../../lib/format'
import { SECTIONS, type Span } from '../sections/registry'
import { scopeTitle } from './scope-title'
import { FirstRun, ZeroResult } from './page-states'
import './page.css'

type Props = Omit<ComponentProps<typeof OverviewProvider>, 'children'> & { name: string }
export function OverviewPage({ name, ...provider }: Props) {
  return <OverviewProvider {...provider}><PageContent name={name} /><OverviewFlightSheet /></OverviewProvider>
}
function PageContent({ name }: { name: string }) {
  const { scope, all, payload, filter, layout, locale, actions } = useOverview()
  const mobile = useMobile()
  const labels = useMemo(() => referenceLabels(locale), [locale])
  const firstRun = scope?.figures.flights === 0 && isEmptyFilter(filter)
  const zero = scope?.figures.flights === 0 && !isEmptyFilter(filter)
  const visible = layout.order.filter(id => !layout.hidden.includes(id))
  const greeting = t({ en: name ? `Hi, ${name}` : 'Hi', ru: name ? `Здравствуйте, ${name}` : 'Здравствуйте' }, locale)
  return <div className="ov3-page" lang={locale}>
    <h1 tabIndex={-1}>{greeting}<span className="ov3-scope">{scopeTitle(filter, labels, locale)}</span></h1>
    {!scope || !all || !payload ? <><p role="status">{t(S.loading, locale)}</p><Skeleton height={520} label={t(S.loading, locale)} /></> : <>
      <div data-region="next"><NextStrip /></div>
      <div className="ov3-globe-band">
        <section className="ov3-globe-region ov-globe" aria-label={t(S.map, locale)} data-globe={firstRun ? 'blank' : zero ? 'ghost' : 'ready'}>
          <GlobeCard locale={locale} topLeft={<div className="ov3-chips">
            {(Object.keys(filter) as Array<keyof OverviewFilter>).map(facet => {
              const label = scopeTitle({ [facet]: filter[facet] }, labels, locale).slice(3)
              return label ? <Chip key={facet} label={label}
                onOpen={() => { /* Task20 owns the facet panel. */ }}
                onRemove={() => facet === 'period' ? actions.setPeriod(null) : actions.removeFacet(facet)}
                removeLabel={t({ en: `Remove ${label}`, ru: `Убрать ${label}` }, locale)} /> : null
            })}
          </div>}>{({ fullscreen }) => <><SvgGlobe globe={scope.globe} all={all.globe} airports={payload.refs.airports} size={fullscreen ? 640 : 436} locale={locale} />{firstRun ? <FirstRun /> : null}</>}</GlobeCard>
        </section>
        {!firstRun ? <div data-region="figures"><HeroPanel /></div> : null}
      </div>
      {zero ? <ZeroResult /> : !firstRun && mobile !== null ? <div className="ov3-sections" data-surface={mobile ? 'tiles' : 'sections'}>
        {visible.map(id => {
          const { Section, Tile } = SECTIONS[id]
          const span: Span = id === 'manufacturers' || id === 'clock' ? 'narrow' : id === 'fleet' || id === 'rhythm' ? 'wide' : 'full'
          return <section className="ov3-section" data-section={id} data-span={span} key={id}>{mobile ? <Tile /> : <Section span={span} />}</section>
        })}
      </div> : null}
      {!firstRun && !zero ? <footer className="ov3-hidden" data-region="hidden">{layout.hidden.length ? t({ en: `Hidden sections: ${formatNumber(locale, layout.hidden.length)}`, ru: `Скрытые разделы: ${formatNumber(locale, layout.hidden.length)}` }, locale) : null}</footer> : null}
    </>}
  </div>
}
