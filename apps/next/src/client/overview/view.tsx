import type { OverviewSummary } from '@kuuki/shared/overview'
import type { Locale } from '../../lib/format'
import { S, t } from './copy'
import { OverviewEmptyYear, OverviewFirstRun } from './empty'
import { OverviewFigures } from './figures'
import { OverviewHero } from './hero'
import type { OverviewLabels } from './labels'
import { OverviewMap } from './map-band'
import { overviewMode } from './model'
import { OverviewNotable } from './notable'
import { PeriodControl } from './period-control'
import { OverviewRankings } from './rankings'
import { OverviewRhythm } from './rhythm'
import './overview.css'

/** Server-rendered Overview for one summary. The hero (queue), the period control and the map's route arcs are client islands. */
export function OverviewView({ summary, locale, labels, ownerId }: { summary: OverviewSummary; locale: Locale; labels: OverviewLabels; ownerId: string }) {
  const mode = overviewMode(summary)
  return <div data-testid="overview-data" className="overview-data read-stack" data-mode={mode}>
    <PeriodControl locale={locale} period={summary.period} years={summary.years} />
    {summary.derivedState !== 'ready' ? <p role="status" className="status-note">{t(summary.derivedState === 'pending' ? S.pending : S.error, locale)}</p> : null}
    <OverviewHero locale={locale} upcoming={summary.nextFlight} />
    {mode === 'first-run' ? <OverviewFirstRun locale={locale} labels={labels} />
      : mode === 'empty-year' ? <OverviewEmptyYear period={summary.period} locale={locale} />
      : <>
        <OverviewFigures summary={summary} locale={locale} />
        <OverviewMap summary={summary} locale={locale} labels={labels} ownerId={ownerId} />
        <OverviewNotable summary={summary} locale={locale} labels={labels} />
        <OverviewRankings summary={summary} locale={locale} labels={labels} />
        <OverviewRhythm summary={summary} locale={locale} />
      </>}
  </div>
}

/** An explicit failure, never an empty summary: the period control stays so another period can be tried. */
export function OverviewFailure({ period, locale }: { period: string; locale: Locale }) {
  return <div data-testid="overview-data" className="overview-data read-stack" data-mode="failed">
    <PeriodControl locale={locale} period={period} years={[]} />
    <section className="read-panel" role="alert"><p>{t(S.failed, locale)}</p>
      <a className="button primary" href={period === 'all' ? '/overview' : `/overview?year=${period}`}>{t(S.retry, locale)}</a></section>
  </div>
}
