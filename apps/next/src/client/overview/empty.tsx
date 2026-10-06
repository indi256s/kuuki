import type { Locale } from '../../lib/format'
import { S, fill, t } from './copy'
import type { OverviewLabels } from './labels'
import { SAMPLE_SUMMARY } from './sample-data'
import { OverviewFigures } from './figures'
import { OverviewMap } from './map-band'
import { OverviewNotable } from './notable'
import { OverviewRankings } from './rankings'
import { OverviewRhythm } from './rhythm'

/** First run: the way in sits above a labelled, inert preview made of the real modules and static sample data. */
export function OverviewFirstRun({ locale, labels }: { locale: Locale; labels: OverviewLabels }) {
  return <>
    <section className="read-panel empty-panel" data-testid="overview-empty" aria-labelledby="ov-empty-title">
      <h2 id="ov-empty-title">{t(S.emptyTitle, locale)}</h2>
      <p className="muted">{t(S.emptyBody, locale)}</p>
      <div className="read-actions"><a className="button primary" href="/import">{t(S.import, locale)}</a><a className="button secondary" href="/add">{t(S.add, locale)}</a></div>
    </section>
    <section className="ov-sample" aria-labelledby="ov-sample-label" data-testid="overview-sample">
      <p id="ov-sample-label" className="ov-sample-label">{t(S.sampleLabel, locale)}</p>
      {/* Inert and hidden from assistive technology: the label above says what it is, and nothing here is the member's. */}
      <div className="ov-sample-body" inert aria-hidden="true">
        <OverviewFigures summary={SAMPLE_SUMMARY} locale={locale} sample />
        <OverviewMap summary={SAMPLE_SUMMARY} locale={locale} labels={labels} />
        <OverviewNotable summary={SAMPLE_SUMMARY} locale={locale} labels={labels} />
        <OverviewRankings summary={SAMPLE_SUMMARY} locale={locale} labels={labels} />
        <OverviewRhythm summary={SAMPLE_SUMMARY} locale={locale} />
      </div>
    </section>
  </>
}

/** A year with no completed flights, in an account that has some: a sentence, not a page of zeros. */
export function OverviewEmptyYear({ period, locale }: { period: string; locale: Locale }) {
  return <section className="read-panel empty-panel" data-testid="overview-empty-year">
    <h2>{fill(t(S.noYear, locale), { year: period })}</h2>
    <p className="muted">{t(S.noYearHint, locale)}</p>
  </section>
}
