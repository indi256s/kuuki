'use client'

import Link from 'next/link'
import { Button } from '../../ui/button'
import { IsoFigure } from '../iso/iso-figure'
import { spike } from '../iso/spike'
import { Narrator } from '../narrator/narrator'
import { useOverview } from '../store/overview-context'
import { isAviationFacetNote } from '../store/scope-state'
import { S, t } from '../copy'
import { useAppliedFacets } from '../filters/use-applied-facets'

const SPIKE = spike(0.65, { stubs: 3 })

export function FirstRun() {
  const { locale } = useOverview()
  return (
    <section className="ov3-first-run" aria-labelledby="ov3-first-run-title">
      <div className="ov3-first-run-heading">
        <h2 id="ov3-first-run-title">{t(S.emptyTitle, locale)}</h2>
        <span className="ov3-first-run-drawing" aria-hidden="true">
          <IsoFigure figure={SPIKE} />
        </span>
      </div>
      <Narrator slot="firstRun" />
      <div className="ov3-first-run-actions">
        <Link className="ui-button" data-variant="primary" href="/import">
          {t(S.import, locale)}
        </Link>
        <Link className="ui-button" data-variant="secondary" href="/add">
          {t(S.add, locale)}
        </Link>
      </div>
    </section>
  )
}
export function ZeroResult() {
  const { actions, locale, scope, filter } = useOverview()
  const ground = scope?.figures.scope === 'ground'
  const facets = useAppliedFacets()
  const conditions = [
    ...(scope?.figures.scope === 'flights'
      ? [t(S.scopeFlights, locale)]
      : ground
        ? [t(S.scopeGround, locale)]
        : []),
    ...facets.map(({ label }) => label),
  ]
  return (
    <div className="ov3-zero">
      {conditions.length ? (
        <p className="ov3-zero-context">
          {locale === 'ru' ? 'Ничего не нашлось: ' : 'Nothing matches: '}
          {conditions.join(' · ')}
        </p>
      ) : null}
      {ground ? (
        <p className="narrator">
          {t(
            scope && isAviationFacetNote(scope, filter) ? S.aviationFacetNote : S.groundZero,
            locale,
          )}
        </p>
      ) : (
        <Narrator slot="zero" />
      )}
      <div className="ov3-actions">
        <Button onClick={actions.removeLast}>
          {t({ en: 'Remove last filter', ru: 'Убрать последний фильтр' }, locale)}
        </Button>
        <Button variant="ghost" onClick={actions.clear}>
          {t({ en: 'Clear filters', ru: 'Сбросить фильтры' }, locale)}
        </Button>
      </div>
    </div>
  )
}
