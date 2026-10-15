'use client'

import Link from 'next/link'
import { Button } from '../../ui/button'
import { Narrator } from '../narrator/narrator'
import { useOverview } from '../store/overview-context'
import { isAviationFacetNote } from '../store/scope-state'
import { S, t } from '../copy'
import { useAppliedFacets } from '../filters/use-applied-facets'

export function FirstRun() {
  const { locale } = useOverview()
  return (
    <div className="ov3-first-run">
      <h2>{t(S.emptyTitle, locale)}</h2>
      <Narrator slot="firstRun" />
      <div className="ov3-first-run-actions">
        <Link className="ui-button" data-variant="primary" href="/import">
          {t(S.import, locale)}
        </Link>
        <Link className="ui-button" data-variant="secondary" href="/add">
          {t(S.add, locale)}
        </Link>
      </div>
    </div>
  )
}
export function ZeroResult() {
  const { actions, locale, scope, filter } = useOverview()
  const ground = scope?.figures.scope === 'ground'
  const facets = useAppliedFacets()
  // Name what is filtering, so an empty result reads as these conditions, not as an empty journal.
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
