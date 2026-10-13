'use client'

import Link from 'next/link'
import { Button } from '../../ui/button'
import { Narrator } from '../narrator/narrator'
import { useOverview } from '../store/overview-context'
import { S, t } from '../copy'

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
  const { actions, locale } = useOverview()
  return (
    <div className="ov3-zero">
      <Narrator slot="zero" />
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
